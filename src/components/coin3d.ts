/** The gold Polo Coin as a real 3D object (Three.js). Loaded lazily by <Coin />, so the rest of the
 *  site does not pay for the 3D library. Obverse: logo 1A as a struck design with an orange enamel ball.
 *  Reverse: the denomination. Edge: reeded like a real coin.
 *  Proof finish: mirror-polished field, frosted relief. Reflections come from a generated studio room,
 *  so no image file has to be downloaded. */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const S = 1024;                       // texture size per face
const GOLD = new THREE.Color('#d9ad4c');
const ORANGE = '#f26a1e';
const TURN_OBVERSE = Math.PI / 2;
const TURN_REVERSE = Math.PI / 2;

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

function canvas() {
  const c = document.createElement('canvas');
  c.width = c.height = S;
  return [c, c.getContext('2d')!] as const;
}

/** Text along a circle, centred on an angle (radians, 0 = top). */
function arcText(g: CanvasRenderingContext2D, text: string, radius: number, centre: number, bottom: boolean) {
  const chars = [...text];
  const widths = chars.map((ch) => g.measureText(ch).width);
  const spacing = 6;
  const total = widths.reduce((a, b) => a + b + spacing, -spacing);
  let a = centre - (bottom ? -1 : 1) * (total / 2) / radius;
  for (let i = 0; i < chars.length; i++) {
    const w = widths[i];
    const mid = a + (bottom ? -1 : 1) * (w / 2) / radius;
    g.save();
    g.translate(S / 2 + Math.sin(mid) * radius, S / 2 - Math.cos(mid) * radius);
    g.rotate(bottom ? mid + Math.PI : mid);
    g.fillText(chars[i], -w / 2, 0);
    g.restore();
    a += (bottom ? -1 : 1) * (w + spacing) / radius;
  }
}

/** Height map of a face: white = raised. Used for bump and roughness. */
async function faceHeight(side: 'obverse' | 'reverse') {
  const [c, g] = canvas();
  g.fillStyle = '#000';
  g.fillRect(0, 0, S, S);
  // raised outer rim
  g.strokeStyle = '#fff';
  g.lineWidth = S * 0.035;
  g.beginPath(); g.arc(S / 2, S / 2, S / 2 - g.lineWidth / 2 - 2, 0, Math.PI * 2); g.stroke();
  // fine bead ring inside the rim
  g.fillStyle = '#fff';
  for (let i = 0; i < 120; i++) {
    const a = (i / 120) * Math.PI * 2;
    const r = S * 0.437;
    g.beginPath(); g.arc(S / 2 + Math.cos(a) * r, S / 2 + Math.sin(a) * r, S * 0.0045, 0, Math.PI * 2); g.fill();
  }
  if (side === 'obverse') {
    const logo = await loadImage('/brand/mark-white.svg');
    const d = S * 0.66;
    g.drawImage(logo, (S - d) / 2, (S - d) / 2, d, d);
  } else {
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `700 ${S * 0.34}px Arial, Helvetica, sans-serif`;
    g.fillText('1', S / 2, S * 0.47);
    g.font = `700 ${S * 0.07}px Arial, Helvetica, sans-serif`;
    g.fillText('US DOLLAR', S / 2, S * 0.7);
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    g.font = `700 ${S * 0.052}px Arial, Helvetica, sans-serif`;
    arcText(g, 'POLO COIN', S * 0.36, 0, false);
    arcText(g, 'BACKED ONE TO ONE', S * 0.36, Math.PI, true);
  }
  return c;
}

/** Colour, roughness and metalness maps derived from the height map. */
function faceMaps(height: HTMLCanvasElement, side: 'obverse' | 'reverse') {
  const [color, cg] = canvas();
  cg.fillStyle = '#fff';
  cg.fillRect(0, 0, S, S);
  const [rough, rg] = canvas();
  rg.fillStyle = '#5c5c5c';           // polished field
  rg.fillRect(0, 0, S, S);
  rg.globalAlpha = 0.85;
  rg.drawImage(height, 0, 0);          // frosted relief (lighter = rougher)
  rg.globalAlpha = 1;
  const [metal, mg] = canvas();
  mg.fillStyle = '#fff';
  mg.fillRect(0, 0, S, S);

  if (side === 'obverse') {
    // orange enamel ball of the logo: viewBox 248, ball at (124, 208), r 15, logo drawn at 66% of the face
    const k = (S * 0.66) / 248;
    const off = (S - S * 0.66) / 2;
    const bx = off + 124 * k, by = off + 208 * k, br = 15 * k;
    cg.fillStyle = ORANGE;
    cg.beginPath(); cg.arc(bx, by, br, 0, Math.PI * 2); cg.fill();
    mg.fillStyle = '#000';
    mg.beginPath(); mg.arc(bx, by, br, 0, Math.PI * 2); mg.fill();
    rg.fillStyle = '#555';
    rg.beginPath(); rg.arc(bx, by, br, 0, Math.PI * 2); rg.fill();
  }
  return { color, rough, metal };
}

/** Reeded edge: fine vertical ridges. */
function edgeBump() {
  const c = document.createElement('canvas');
  c.width = 2048; c.height = 8;
  const g = c.getContext('2d')!;
  for (let x = 0; x < c.width; x += 8) {
    const grd = g.createLinearGradient(x, 0, x + 8, 0);
    grd.addColorStop(0, '#000'); grd.addColorStop(0.5, '#fff'); grd.addColorStop(1, '#000');
    g.fillStyle = grd;
    g.fillRect(x, 0, 8, c.height);
  }
  return c;
}

function tex(c: HTMLCanvasElement, srgb = false, flip = false) {
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (flip) { t.wrapS = THREE.RepeatWrapping; t.repeat.x = -1; }
  return t;
}

/** Cap UVs of a cylinder are turned by 90 degrees: rotate face textures so the logo stands upright. */
function faceTex(c: HTMLCanvasElement, srgb: boolean, flip: boolean, turn: number) {
  const t = tex(c, srgb, flip);
  t.center.set(0.5, 0.5);
  t.rotation = turn;
  return t;
}

async function faceMaterial(side: 'obverse' | 'reverse', flip: boolean, turn: number) {
  const h = await faceHeight(side);
  const m = faceMaps(h, side);
  const tex = (c: HTMLCanvasElement, srgb = false, f = false) => faceTex(c, srgb, f, turn);
  return new THREE.MeshStandardMaterial({
    color: GOLD,
    map: tex(m.color, true, flip),
    metalness: 1,
    metalnessMap: tex(m.metal, false, flip),
    roughness: 1,
    roughnessMap: tex(m.rough, false, flip),
    bumpMap: tex(h, false, flip),
    bumpScale: 3,
  });
}

export interface CoinScene { dispose(): void }

export async function mountCoin(host: HTMLElement, opts: { still: boolean }): Promise<CoinScene> {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;

  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 50);
  camera.position.set(0, 0, 5.4);

  const key = new THREE.DirectionalLight('#fff4df', 2.2);
  key.position.set(-3, 4, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight('#ebcfad', 1.4);
  rim.position.set(4, -2, -3);
  scene.add(rim);

  const edge = edgeBump();
  const edgeTex = tex(edge);
  edgeTex.wrapS = THREE.RepeatWrapping;
  const sideMat = new THREE.MeshStandardMaterial({ color: GOLD, metalness: 1, roughness: 0.32, bumpMap: edgeTex, bumpScale: 2 });
  const [obverse, reverse] = await Promise.all([faceMaterial('obverse', false, TURN_OBVERSE), faceMaterial('reverse', false, TURN_REVERSE)]);

  // Cylinder axis is Y: groups are [side, top cap, bottom cap]. Tilt it so the caps face the camera.
  const geo = new THREE.CylinderGeometry(1, 1, 0.13, 160, 1);
  const coin = new THREE.Mesh(geo, [sideMat, obverse, reverse]);
  coin.rotation.x = Math.PI / 2;
  const pivot = new THREE.Group();
  pivot.add(coin);
  scene.add(pivot);

  const resize = () => {
    const w = host.clientWidth, h = host.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(host);

  // Pointer gently tilts the coin.
  const target = { x: 0, y: 0 };
  const onMove = (e: PointerEvent) => {
    const r = host.getBoundingClientRect();
    target.x = ((e.clientY - r.top) / r.height - 0.5) * 0.5;
    target.y = ((e.clientX - r.left) / r.width - 0.5) * 0.7;
  };
  window.addEventListener('pointermove', onMove);

  let visible = true;
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
  io.observe(host);

  let frame = 0;
  let spin = -0.5;
  const clock = new THREE.Clock();
  const tick = () => {
    frame = requestAnimationFrame(tick);
    if (!visible) { clock.getDelta(); return; }
    const dt = Math.min(clock.getDelta(), 0.05);
    spin += dt * 0.42;                                     // one turn in about 15 seconds
    pivot.rotation.y = spin;
    pivot.rotation.x += (target.x + Math.sin(spin * 0.7) * 0.08 - pivot.rotation.x) * 0.06;
    pivot.rotation.z += (-target.y * 0.25 - pivot.rotation.z) * 0.06;
    renderer.render(scene, camera);
  };

  if (opts.still) {
    pivot.rotation.set(0.12, -0.45, 0);
    renderer.render(scene, camera);
  } else {
    tick();
  }

  return {
    dispose() {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
      ro.disconnect();
      io.disconnect();
      geo.dispose();
      [sideMat, obverse, reverse].forEach((m) => {
        Object.values(m).forEach((v) => { if (v instanceof THREE.Texture) v.dispose(); });
        m.dispose();
      });
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
