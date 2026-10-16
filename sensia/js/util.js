// Petites fonctions utilitaires (interpolations, textures générées, matériaux).
import * as THREE from 'three';

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
/** Fenêtre 0→1→0 : monte entre a et b, redescend entre c et d. */
export const windowed = (x, a, b, c, d) => smooth(a, b, x) * (1 - smooth(c, d, x));

export const COLORS = {
  cyan: new THREE.Color('#2ee6f0'),
  sky: new THREE.Color('#5aa9ff'),
  violet: new THREE.Color('#b18cff'),
  amber: new THREE.Color('#ffc14d'),
  red: new THREE.Color('#ff3b3b'),
  warmWhite: new THREE.Color('#fff1d6'),
};

/** Texture générée sur un canvas 2D (aucun fichier image nécessaire). */
export function canvasTexture(w, h, draw, { srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Bibliothèque de matériaux réutilisés par les modèles. */
export const MAT = {
  acetate: new THREE.MeshPhysicalMaterial({ color: '#121419', roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.12 }),
  lens: new THREE.MeshPhysicalMaterial({
    color: '#0a1424', roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.62,
    envMapIntensity: 1.6, clearcoat: 1, side: THREE.DoubleSide,
  }),
  pcbBlue: new THREE.MeshStandardMaterial({ color: '#1747b8', roughness: 0.45, metalness: 0.1 }),
  pcbBlack: new THREE.MeshStandardMaterial({ color: '#15171c', roughness: 0.5, metalness: 0.1 }),
  steel: new THREE.MeshStandardMaterial({ color: '#d9dde3', roughness: 0.22, metalness: 1 }),
  mesh: new THREE.MeshStandardMaterial({ color: '#2a2d33', roughness: 0.9, metalness: 0.3 }),
  gold: new THREE.MeshStandardMaterial({ color: '#d8b25a', roughness: 0.3, metalness: 1 }),
  plasticBlack: new THREE.MeshStandardMaterial({ color: '#1b1d22', roughness: 0.55 }),
  plasticWhite: new THREE.MeshStandardMaterial({ color: '#eef1f5', roughness: 0.4 }),
  chip: new THREE.MeshStandardMaterial({ color: '#0e0f12', roughness: 0.35 }),
};

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
  return new THREE.Mesh(new THREE.TubeGeometry(curve, segments, radius, 8, false), material);
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
