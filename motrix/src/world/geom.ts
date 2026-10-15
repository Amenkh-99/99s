import * as THREE from 'three';

export type V3 = [number, number, number];

/**
 * Profil fermé (r, axial) avec chanfreins : chaque angle devient un petit biseau,
 * et des points jumeaux gardent les grandes faces nettes (normales non lissées).
 * Le profil doit être parcouru dans le sens trigonométrique dans le plan (r, axial)
 * pour que les normales pointent vers l'extérieur.
 */
export function bevelProfile(corners: [number, number][], bevel = 0.004): THREE.Vector2[] {
  const out: THREE.Vector2[] = [];
  const n = corners.length;
  const eps = 0.0004;
  for (let i = 0; i < n; i++) {
    const p = new THREE.Vector2(...corners[i]);
    const prev = new THREE.Vector2(...corners[(i - 1 + n) % n]);
    const next = new THREE.Vector2(...corners[(i + 1) % n]);
    const toPrev = prev.clone().sub(p).normalize();
    const toNext = next.clone().sub(p).normalize();
    const a = p.clone().addScaledVector(toPrev, bevel);
    const b = p.clone().addScaledVector(toNext, bevel);
    out.push(a.clone().addScaledVector(toPrev, eps), a, b, b.clone().addScaledVector(toNext, eps));
  }
  out.push(out[0].clone());
  // LatheGeometry exige r > 0
  for (const v of out) v.x = Math.max(v.x, 0.0005);
  return out;
}

/**
 * Révolution autour de l'axe X du monde. phiStart/phiLength suivent la convention
 * de LatheGeometry ; après rotation : y = -r·sin(phi), z = r·cos(phi).
 */
export function latheX(profile: THREE.Vector2[], segments = 64, phiStart = 0, phiLength = Math.PI * 2): THREE.BufferGeometry {
  const g = new THREE.LatheGeometry(profile, segments, phiStart, phiLength);
  g.rotateZ(-Math.PI / 2);
  return g;
}

/** Anneau plein (tube épais) autour de X, de x0 à x1. */
export function ringX(rIn: number, rOut: number, x0: number, x1: number, segments = 64, phiStart = 0, phiLength = Math.PI * 2, bevel = 0.004): THREE.BufferGeometry {
  // parcours trigonométrique dans le plan (r, axial)
  const prof = bevelProfile(
    [
      [rOut, x0],
      [rOut, x1],
      [rIn, x1],
      [rIn, x0],
    ],
    bevel,
  );
  return latheX(prof, segments, phiStart, phiLength);
}

/** Cylindre plein d'axe X. */
export function cylX(r: number, x0: number, x1: number, segments = 32): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r, r, x1 - x0, segments);
  g.rotateZ(-Math.PI / 2);
  g.translate((x0 + x1) / 2, 0, 0);
  return g;
}

/** Boîte avec arêtes légèrement arrondies (approximée par un biseau de 3 segments). */
export function box(w: number, h: number, d: number): THREE.BufferGeometry {
  return new THREE.BoxGeometry(w, h, d);
}

/**
 * Décalage d'une polyligne : chaque point reçoit son vecteur latéral r (déjà
 * « mitré » aux angles par l'appelant), multiplié par le décalage d.
 */
export function offsetPath(points: V3[], rights: V3[], d: number): THREE.Vector3[] {
  return points.map((p, i) => new THREE.Vector3(p[0] + rights[i][0] * d, p[1] + rights[i][1] * d, p[2] + rights[i][2] * d));
}

/** Arrondit les angles d'une polyligne (rayon r) pour une courbe Catmull-Rom propre. */
export function roundCorners(pts: THREE.Vector3[], r = 0.05): THREE.Vector3[] {
  if (pts.length < 3) return pts.map((p) => p.clone());
  const out: THREE.Vector3[] = [pts[0].clone()];
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i];
    const a = pts[i - 1].clone().sub(p);
    const b = pts[i + 1].clone().sub(p);
    const la = a.length();
    const lb = b.length();
    const rr = Math.min(r, la * 0.45, lb * 0.45);
    const pa = p.clone().addScaledVector(a.normalize(), rr);
    const pb = p.clone().addScaledVector(b.normalize(), rr);
    const mid = pa.clone().add(pb).multiplyScalar(0.5).lerp(p, 0.4);
    out.push(pa, mid, pb);
  }
  out.push(pts[pts.length - 1].clone());
  return out;
}

/** Courbe polyligne lisse et longueur associée. */
export function smoothCurve(pts: THREE.Vector3[], cornerRadius = 0.05): THREE.CatmullRomCurve3 {
  return new THREE.CatmullRomCurve3(roundCorners(pts, cornerRadius), false, 'centripetal');
}

export function v3(p: V3): THREE.Vector3 {
  return new THREE.Vector3(p[0], p[1], p[2]);
}
