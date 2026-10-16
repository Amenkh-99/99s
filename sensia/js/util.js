// Utilitaires : interpolations, textures procédurales (circuits imprimés,
// métal brossé, sol de studio…) et bibliothèque de matériaux PBR.
// Aucune image externe : tout est dessiné sur des canvas 2D.
import * as THREE from 'three';

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutExpo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
/** Fenêtre 0→1→0 : monte entre a et b, redescend entre c et d. */
export const windowed = (x, a, b, c, d) => smooth(a, b, x) * (1 - smooth(c, d, x));

/** Générateur pseudo-aléatoire déterministe (textures identiques à chaque chargement). */
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export const COLORS = {
  cyan: new THREE.Color('#2ee6f0'),
  sky: new THREE.Color('#5aa9ff'),
  violet: new THREE.Color('#b18cff'),
  amber: new THREE.Color('#ffc14d'),
  red: new THREE.Color('#ff3b3b'),
  warmWhite: new THREE.Color('#fff1d6'),
};

/** Texture générée sur un canvas 2D. */
export function canvasTexture(w, h, draw, { srgb = true, repeat = null } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}

/** Stries de métal brossé (utilisé comme carte de rugosité et de relief). */
export const brushedTex = canvasTexture(512, 512, (g, w, h) => {
  const r = rng(7);
  // valeurs claires (≈ 0,8–1) : la carte module la rugosité sans rendre le métal miroir
  g.fillStyle = '#d6d6d6';
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 2600; i++) {
    const y = r() * h;
    const v = 185 + r() * 70;
    g.strokeStyle = `rgba(${v},${v},${v},${0.18 + r() * 0.3})`;
    g.lineWidth = 0.6 + r() * 1.2;
    g.beginPath();
    const x = r() * w;
    g.moveTo(x - 260, y);
    g.lineTo(x + 260, y + (r() - 0.5) * 1.5);
    g.stroke();
  }
}, { srgb: false, repeat: [2, 2] });

/** Petite tache ronde et douce pour les particules. */
export const softDot = canvasTexture(64, 64, (g, w) => {
  const grd = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.65)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, w, w);
});

/**
 * Circuit imprimé procédural : vernis coloré, pistes de cuivre visibles sous
 * le vernis, pastilles dorées, vias et sérigraphie blanche.
 * Retourne { map, bump } (couleur + relief des pistes).
 * @param {object} o { w, h, mask, copper, seed, text:[[str,x,y,size,align]], pads:[[x,y,r]], draw(g,W,H) }
 * x/y en fraction de la taille (0..1).
 */
export function pcbTextures(o) {
  const W = o.w || 512, H = o.h || 256;
  const r = rng(o.seed || 3);
  // tracés communs aux deux canvas (pistes Manhattan à angles de 45°)
  const tracks = [];
  for (let i = 0; i < (o.tracks ?? 26); i++) {
    let x = r() * W, y = r() * H;
    const pts = [[x, y]];
    for (let k = 0; k < 3; k++) {
      const horiz = r() > 0.5, len = 20 + r() * W * 0.35;
      const d = r() > 0.5 ? 1 : -1;
      const diag = 10 + r() * 16;
      x += horiz ? d * len : d * diag;
      y += horiz ? d * diag : d * len * 0.5;
      pts.push([Math.max(4, Math.min(W - 4, x)), Math.max(4, Math.min(H - 4, y))]);
    }
    tracks.push({ pts, w: 1.5 + r() * 2.5 });
  }
  const vias = Array.from({ length: o.vias ?? 22 }, () => [r() * W, r() * H]);
  const pads = (o.pads || []).map(([x, y, rad]) => [x * W, y * H, rad]);

  const paint = (g, relief) => {
    if (relief) {
      g.fillStyle = '#000';
      g.fillRect(0, 0, W, H);
    } else {
      const grd = g.createLinearGradient(0, 0, W, H);
      grd.addColorStop(0, o.mask);
      grd.addColorStop(1, o.maskDark || o.mask);
      g.fillStyle = grd;
      g.fillRect(0, 0, W, H);
      // grain du vernis
      for (let i = 0; i < 1800; i++) {
        g.fillStyle = `rgba(255,255,255,${r() * 0.035})`;
        g.fillRect(r() * W, r() * H, 1.5, 1.5);
      }
    }
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const t of tracks) {
      g.strokeStyle = relief ? '#9a9a9a' : o.copper;
      g.lineWidth = t.w;
      g.beginPath();
      t.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.stroke();
    }
    for (const [x, y] of vias) {
      g.fillStyle = relief ? '#c0c0c0' : '#d8b25a';
      g.beginPath();
      g.arc(x, y, 3.2, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = relief ? '#202020' : '#1a1206';
      g.beginPath();
      g.arc(x, y, 1.3, 0, Math.PI * 2);
      g.fill();
    }
    for (const [x, y, rad] of pads) {
      g.fillStyle = relief ? '#ffffff' : '#e2bb63';
      g.beginPath();
      g.arc(x, y, rad, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = relief ? '#303030' : '#3b2a0e';
      g.beginPath();
      g.arc(x, y, rad * 0.45, 0, Math.PI * 2);
      g.fill();
    }
    if (o.draw) o.draw(g, W, H, relief);
    if (!relief && o.text) {
      g.fillStyle = 'rgba(245,248,255,0.92)';
      for (const [s, x, y, size, align] of o.text) {
        g.font = `600 ${size}px "JetBrains Mono", Consolas, monospace`;
        g.textAlign = align || 'center';
        g.textBaseline = 'middle';
        g.fillText(s, x * W, y * H);
      }
    }
  };
  const map = canvasTexture(W, H, (g) => paint(g, false));
  const bump = canvasTexture(W, H, (g) => paint(g, true), { srgb: false });
  return { map, bump };
}

/** Matériau de carte électronique : face supérieure texturée, tranches unies. */
export function pcbMaterials(tex, edgeColor, faceIndex = 4) {
  const top = new THREE.MeshPhysicalMaterial({
    map: tex.map, bumpMap: tex.bump, bumpScale: 1.2, roughness: 0.42, metalness: 0.05,
    clearcoat: 0.6, clearcoatRoughness: 0.25,
  });
  const edge = new THREE.MeshStandardMaterial({ color: edgeColor, roughness: 0.55 });
  const mats = [edge, edge, edge, edge, edge, edge];
  mats[faceIndex] = top;
  return mats;
}

/** Bibliothèque de matériaux PBR réutilisés par les modèles. */
export const MAT = {
  // monture : titane graphite brossé (face avant) et titane plus clair (branches)
  frame: new THREE.MeshPhysicalMaterial({
    color: '#23272e', metalness: 0.85, roughness: 0.36, roughnessMap: brushedTex,
    anisotropy: 0.6, clearcoat: 0.45, clearcoatRoughness: 0.18,
  }),
  titanium: new THREE.MeshPhysicalMaterial({
    color: '#6f7680', metalness: 1, roughness: 0.42, roughnessMap: brushedTex,
    anisotropy: 0.55, anisotropyRotation: Math.PI / 2,
  }),
  // verre teinté : transmission + réfraction + léger reflet irisé (traitement antireflet)
  lens: new THREE.MeshPhysicalMaterial({
    color: '#cfe3ff', metalness: 0, roughness: 0.03, transmission: 1, thickness: 0.0016, ior: 1.52,
    attenuationColor: '#1d2f4d', attenuationDistance: 0.0035, specularIntensity: 1,
    iridescence: 0.35, iridescenceIOR: 1.3, iridescenceThicknessRange: [180, 420],
    clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.5, side: THREE.DoubleSide,
  }),
  // variante légère du verre (sans passe de transmission) pour les plans larges
  lensLight: new THREE.MeshPhysicalMaterial({
    color: '#0c1a2e', metalness: 0.1, roughness: 0.04, transparent: true, opacity: 0.72,
    iridescence: 0.4, iridescenceIOR: 1.3, iridescenceThicknessRange: [180, 420],
    clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.6, side: THREE.DoubleSide,
  }),
  pcbBlue: new THREE.MeshStandardMaterial({ color: '#1747b8', roughness: 0.45, metalness: 0.1 }),
  pcbBlack: new THREE.MeshStandardMaterial({ color: '#15171c', roughness: 0.5, metalness: 0.1 }),
  steel: new THREE.MeshPhysicalMaterial({ color: '#dfe3e8', roughness: 0.22, roughnessMap: brushedTex, metalness: 1, anisotropy: 0.5 }),
  mesh: new THREE.MeshStandardMaterial({ color: '#2a2d33', roughness: 0.9, metalness: 0.3 }),
  gold: new THREE.MeshStandardMaterial({ color: '#e7bd62', roughness: 0.22, metalness: 1 }),
  plasticBlack: new THREE.MeshPhysicalMaterial({ color: '#16181d', roughness: 0.48, clearcoat: 0.25, clearcoatRoughness: 0.4 }),
  plasticWhite: new THREE.MeshPhysicalMaterial({ color: '#eef1f5', roughness: 0.35, clearcoat: 0.4 }),
  chip: new THREE.MeshPhysicalMaterial({ color: '#0d0e11', roughness: 0.38, clearcoat: 0.3 }),
  rubber: new THREE.MeshStandardMaterial({ color: '#0f1114', roughness: 0.85 }),
  silicone: new THREE.MeshPhysicalMaterial({ color: '#dfe8f2', roughness: 0.25, transmission: 0.6, thickness: 0.002, ior: 1.4 }),
};

/** Matériau de câble gainé silicone (léger vernis). */
export function wireMaterial(color) {
  return new THREE.MeshPhysicalMaterial({ color, roughness: 0.42, clearcoat: 0.7, clearcoatRoughness: 0.3 });
}

/** Matériau additif "lumineux" (ondes, faisceaux) piloté par une opacité. */
export function glowMaterial(color, opacity = 1) {
  return new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, blending: THREE.AdditiveBlending,
    depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
  });
}

/** Tube lisse le long d'une liste de points (câbles, fils). */
export function cable(points, radius, material, segments = 64) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  return new THREE.Mesh(new THREE.TubeGeometry(curve, segments, radius, 10, false), material);
}

/** Forme 2D : polygone aux coins arrondis (contours des verres, etc.). */
export function roundedPolygon(pts, r) {
  const shape = new THREE.Shape();
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n];
    const v1 = new THREE.Vector2(p0[0] - p1[0], p0[1] - p1[1]).normalize();
    const v2 = new THREE.Vector2(p2[0] - p1[0], p2[1] - p1[1]).normalize();
    const a = [p1[0] + v1.x * r, p1[1] + v1.y * r];
    const b = [p1[0] + v2.x * r, p1[1] + v2.y * r];
    if (i === 0) shape.moveTo(a[0], a[1]);
    else shape.lineTo(a[0], a[1]);
    shape.quadraticCurveTo(p1[0], p1[1], b[0], b[1]);
  }
  shape.closePath();
  return shape;
}

/** Recherche récursive des meshes d'un groupe (pour surligner une pièce). */
export function meshesOf(obj) {
  const out = [];
  obj.traverse((o) => o.isMesh && out.push(o));
  return out;
}
