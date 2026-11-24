import { PageHero, Section } from '../../ui';

const COLOURS = [
  { name: 'Forest Green', hex: '#0F4027', role: 'Base, about 60%', use: 'Hero areas, navigation, text on light backgrounds', ink: '#EBCFAD' },
  { name: 'Old Cream', hex: '#EBCFAD', role: 'Secondary, about 30%', use: 'Sections, cards, text on green', ink: '#0F4027' },
  { name: 'Burnt Orange', hex: '#F26A1E', role: 'Accent, at most 10%', use: 'One main button per view, highlights, the ball in the logo', ink: '#0A2E1C' },
];

const LOGOS = [
  { file: 'lockup-vertical-on-dark', label: 'Primary, on green', bg: 'var(--forest)' },
  { file: 'lockup-vertical-on-light', label: 'Primary, on cream', bg: 'var(--cream)' },
  { file: 'lockup-horizontal-on-light', label: 'Horizontal', bg: 'var(--paper)' },
  { file: 'mark-black', label: 'One colour', bg: 'var(--paper)' },
  { file: 'icon-on-dark', label: 'Icon, 32 px and below', bg: 'var(--forest)' },
  { file: 'app-icon', label: 'App icon', bg: 'var(--cream-soft)' },
];

export default function Brand() {
  return (
    <>
      <PageHero eyebrow="Brand" title="The Polo Coin brand"
        lede="A coin, two crossed mallets and a ball: polo and money in one mark. Quiet colours, one loud accent, and Helvetica." />

      <Section title="Logo" intro="The ring is the coin, the crossed mallets are polo, the orange ball is the payment in play. Below 32 px use the simplified icon. Logo files are in /brand.">
        <div className="logo-grid">
          {LOGOS.map((l) => (
            <figure key={l.file}>
              <div className="logo-tile" style={{ background: l.bg }}><img src={`/brand/${l.file}.svg`} alt={`Polo Coin logo: ${l.label}`} /></div>
              <figcaption>{l.label} · <a href={`/brand/${l.file}.svg`} download>SVG</a></figcaption>
            </figure>
          ))}
        </div>
      </Section>

      <Section tone="cream" title="Colours">
        <div className="swatches">
          {COLOURS.map((c) => (
            <div key={c.hex} className="swatch" style={{ background: c.hex, color: c.ink }}>
              <strong>{c.name}</strong>
              <span>{c.hex}</span>
              <small>{c.role}</small>
              <p>{c.use}</p>
            </div>
          ))}
        </div>
        <p className="muted small">Contrast: cream on green 7.9 : 1 (default for text on dark). Orange on green 3.9 : 1, for large text and buttons only. Orange on cream 2 : 1, never for text.</p>
      </Section>

      <Section title="Typography" intro="Helvetica throughout, Arial where Helvetica is not installed. Figures are tabular so amounts line up.">
        <div className="type-scale">
          <p style={{ fontSize: '3.5rem', fontWeight: 700, letterSpacing: '-0.025em' }}>Display 56</p>
          <p style={{ fontSize: '2.5rem', fontWeight: 700 }}>Headline 40</p>
          <p style={{ fontSize: '1.75rem', fontWeight: 700 }}>Section 28</p>
          <p style={{ fontSize: '1rem' }}>Body 16/24 – Pay your polo team in Argentina the same minute.</p>
          <p className="eyebrow">Eyebrow 12, uppercase, tracked</p>
        </div>
      </Section>

      <Section tone="cream" title="Do and don’t">
        <div className="grid-2">
          <ul className="checklist"><li>Give the logo room: at least the ball’s diameter on every side</li><li>Use one orange element per view</li><li>Write numbers, not adjectives: “1%”, “in seconds”</li></ul>
          <ul className="crosslist"><li>Recolour, stretch or add effects to the logo</li><li>Set text in orange on cream</li><li>Use the full logo below 32 px</li></ul>
        </div>
      </Section>
    </>
  );
}
