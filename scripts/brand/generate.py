"""Generates the Polo Coin logo files in public/brand/ (logo 1A, palette Forest Green / Old Cream / Burnt Orange).

Run:  python3 scripts/brand/generate.py
Text is converted to outlines (Liberation Sans Bold, metric-compatible with Arial), so the SVGs
look identical everywhere and need no font. PNGs are rendered with rsvg-convert if available.
"""
import math, os, shutil, subprocess
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

FOREST, CREAM, ORANGE = "#0F4027", "#EBCFAD", "#F26A1E"
BLACK, WHITE = "#000000", "#FFFFFF"
OUT = os.path.join(os.path.dirname(__file__), "..", "..", "public", "brand")
FONT_FILE = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
SW = 9  # one stroke weight for ring and shafts

font = TTFont(FONT_FILE)
glyphs = font.getGlyphSet(); cmap = font.getBestCmap(); upm = font["head"].unitsPerEm

def text_path(text, x, y, size, tracking=0.0, anchor="start"):
    """Outlined text. tracking in em. Returns (path_d, width)."""
    s = size / upm
    names = [cmap[ord(c)] for c in text]
    adv = [glyphs[n].width * s for n in names]
    width = sum(adv) + tracking * size * (len(text) - 1)
    x0 = x - width / 2 if anchor == "middle" else x - width if anchor == "end" else x
    pen = SVGPathPen(glyphs); cx = x0
    for n, a in zip(names, adv):
        glyphs[n].draw(TransformPen(pen, (s, 0, 0, -s, cx, y)))
        cx += a + tracking * size
    return pen.getCommands(), width

HEAD = "M -34 0 C -34 -10 -26 -10 -18 -10 L 22 -9 C 32 -9 36 -5 36 0 C 36 5 32 9 22 9 L -18 10 C -26 10 -34 10 -34 0 Z"
def mallet(x1, y1, x2, y2, col, extra=0):
    a = math.degrees(math.atan2(y2 - y1, x2 - x1))
    return (f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{col}" stroke-width="{SW + extra}" stroke-linecap="round"/>'
            f'<path d="{HEAD}" transform="translate({x2} {y2}) rotate({a + 90:.2f})" fill="{col}" stroke="{col}" stroke-width="{extra}" stroke-linejoin="round"/>')

def mark(fg, ball, uid):
    """Logo 1A. The gap where the mallets cross is a mask, so the files stay transparent."""
    return (f'<defs><mask id="gap-{uid}" maskUnits="userSpaceOnUse" x="-130" y="-130" width="260" height="260">'
            f'<rect x="-130" y="-130" width="260" height="260" fill="#fff"/>{mallet(58, -62, -46, 56, "#000", 12)}</mask></defs>'
            f'<circle r="116" fill="none" stroke="{fg}" stroke-width="{SW}"/>'
            f'<g mask="url(#gap-{uid})">{mallet(-58, -62, 46, 56, fg)}</g>{mallet(58, -62, -46, 56, fg)}'
            f'<circle cx="0" cy="84" r="15" fill="{ball}"/>')

def icon(fg, ball, uid):
    """Simplified mark for 32 px and below: ring, X, ball in the centre."""
    return (f'<defs><mask id="hole-{uid}" maskUnits="userSpaceOnUse" x="-130" y="-130" width="260" height="260">'
            f'<rect x="-130" y="-130" width="260" height="260" fill="#fff"/><circle r="32" fill="#000"/></mask></defs>'
            f'<circle r="106" fill="none" stroke="{fg}" stroke-width="24"/>'
            f'<g mask="url(#hole-{uid})" stroke="{fg}" stroke-width="24" stroke-linecap="round">'
            f'<line x1="-54" y1="-54" x2="54" y2="54"/><line x1="54" y1="-54" x2="-54" y2="54"/></g>'
            f'<circle r="22" fill="{ball}"/>')

def svg(w, h, body, bg=None, title="Polo Coin"):
    b = f'<rect width="{w}" height="{h}" fill="{bg}"/>' if bg else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" role="img">'
            f'<title>{title}</title>{b}{body}</svg>')

def write(name, content):
    with open(os.path.join(OUT, name), "w") as f: f.write(content)

COLOURWAYS = {  # name: (mark colour, ball colour, text colour)
    "on-dark": (CREAM, ORANGE, CREAM),
    "on-light": (FOREST, ORANGE, FOREST),
    "black": (BLACK, BLACK, BLACK),
    "white": (WHITE, WHITE, WHITE),
}
os.makedirs(OUT, exist_ok=True)
for cw, (fg, ball, txt) in COLOURWAYS.items():
    write(f"mark-{cw}.svg", svg(248, 248, f'<g transform="translate(124 124)">{mark(fg, ball, cw)}</g>'))
    d, _ = text_path("POLO COIN", 160, 352, 32, tracking=0.19, anchor="middle")
    write(f"lockup-vertical-{cw}.svg", svg(320, 372, f'<g transform="translate(160 132)">{mark(fg, ball, cw)}</g><path d="{d}" fill="{txt}"/>'))
    d, tw = text_path("Polo Coin", 128, 81, 54, tracking=-0.01)
    write(f"lockup-horizontal-{cw}.svg", svg(int(128 + tw + 8), 120, f'<g transform="translate(60 60) scale(0.47)">{mark(fg, ball, cw)}</g><path d="{d}" fill="{txt}"/>'))
    write(f"icon-{cw}.svg", svg(248, 248, f'<g transform="translate(124 124)">{icon(fg, ball, cw)}</g>'))

# App icon / favicon: simplified mark on a rounded Forest Green square
app = f'<rect width="512" height="512" rx="112" fill="{FOREST}"/><g transform="translate(256 256) scale(1.45)">{icon(CREAM, ORANGE, "app")}</g>'
write("app-icon.svg", svg(512, 512, app))
fav = os.path.join(OUT, "..", "favicon.svg")
with open(fav, "w") as f: f.write(svg(512, 512, app))

# Social preview (Open Graph) 1200 x 630
d1, _ = text_path("POLO COIN", 600, 455, 46, tracking=0.19, anchor="middle")
d2, _ = text_path("Instant, low-cost payments for the polo economy", 600, 520, 28, anchor="middle")
og = (f'<g transform="translate(600 250) scale(1.15)">{mark(CREAM, ORANGE, "og")}</g>'
      f'<path d="{d1}" fill="{CREAM}"/><path d="{d2}" fill="{CREAM}" fill-opacity="0.75"/>')
write("og-image.svg", svg(1200, 630, og, bg=FOREST))

if shutil.which("rsvg-convert"):
    for src, dst, w in [("app-icon.svg", "app-icon-512.png", 512), ("app-icon.svg", "apple-touch-icon.png", 180),
                        ("og-image.svg", "og-image.png", 1200), ("lockup-horizontal-on-light.svg", "lockup-horizontal-on-light.png", 1200)]:
        subprocess.run(["rsvg-convert", "-w", str(w), os.path.join(OUT, src), "-o", os.path.join(OUT, dst)], check=True)
print("brand files written to", os.path.abspath(OUT))
