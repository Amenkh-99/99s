// Personnage stylisé (formes géométriques simples) portant SENSIA.
// La personne regarde vers +z. Son côté gauche est +x, son côté droit −x.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createGlasses } from './glasses.js';
import { cable, MAT } from '../util.js';
import { createBeltBox } from './modules.js';

const SKIN = new THREE.MeshStandardMaterial({ color: '#c99474', roughness: 0.62 });
const HAIR = new THREE.MeshStandardMaterial({ color: '#2a1d16', roughness: 0.85 });
const SHIRT = new THREE.MeshStandardMaterial({ color: '#4c6f9e', roughness: 0.8 });
const PANTS = new THREE.MeshStandardMaterial({ color: '#232c3d', roughness: 0.85 });
const SHOE = new THREE.MeshStandardMaterial({ color: '#8e99a8', roughness: 0.75 });
const SOLE = new THREE.MeshStandardMaterial({ color: '#2b2f36', roughness: 0.9 });
const BUD = new THREE.MeshPhysicalMaterial({ color: '#1d222b', roughness: 0.3, clearcoat: 1 });
const CABLE = new THREE.MeshStandardMaterial({ color: '#20242c', roughness: 0.6 });

const UP_ARM = 0.29;
const FORE_ARM = 0.285;
const DOWN = new THREE.Vector3(0, -1, 0);

function limb(r, len, mat) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 16), mat);
  m.position.y = -len / 2;
  m.castShadow = true;
  return m;
}

export function createPerson({ cane = false } = {}) {
  const root = new THREE.Group();
  root.name = 'Personne';
  const body = new THREE.Group(); // tout sauf la translation globale (rebond de marche)
  root.add(body);

  // Tronc
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.3, 8, 24), SHIRT);
  torso.scale.set(1, 1, 0.62);
  torso.position.y = 1.2;
  torso.castShadow = true;
  const hips = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.08, 8, 20), PANTS);
  hips.scale.set(1.05, 1, 0.7);
  hips.position.y = 0.97;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.1, 16), SKIN);
  neck.position.y = 1.5;
  body.add(torso, hips, neck);

  // Tête (pivot au cou pour pouvoir l'incliner)
  const headPivot = new THREE.Group();
  headPivot.position.y = 1.53;
  body.add(headPivot);
  const head = new THREE.Group();
  head.position.y = 0.11;
  headPivot.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), SKIN);
  skull.scale.set(0.079, 0.104, 0.094);
  skull.castShadow = true;
  const hair = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 20, 0, Math.PI * 2, 0, 1.75), HAIR);
  hair.scale.set(0.083, 0.108, 0.099);
  hair.rotation.x = -0.42;
  hair.position.set(0, 0.006, -0.006);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.014, 16, 12), SKIN);
  nose.scale.set(0.8, 1.1, 1);
  nose.position.set(0, -0.012, 0.092);
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.011, 0.0018, 6, 20, Math.PI), new THREE.MeshStandardMaterial({ color: '#8a4b3c', roughness: 0.6 }));
  mouth.rotation.z = Math.PI;
  mouth.position.set(0, -0.05, 0.083);
  head.add(skull, hair, nose, mouth);
  for (const sx of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.02, 16, 12), SKIN);
    ear.scale.set(0.45, 1, 0.75);
    ear.position.set(sx * 0.078, -0.004, -0.004);
    head.add(ear);
  }

  // Lunettes SENSIA
  const glasses = createGlasses();
  glasses.group.position.set(0, 0.004, 0.091);
  glasses.group.rotation.x = 0.04;
  head.add(glasses.group);

  // Écouteurs intra-auriculaires
  const buds = {};
  for (const sx of [-1, 1]) {
    const bud = new THREE.Group();
    bud.position.set(sx * 0.084, -0.008, 0.002);
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.0105, 20, 14), BUD);
    shell.scale.set(0.8, 1, 1);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0075, 0.0012, 8, 24), new THREE.MeshBasicMaterial({ color: '#2ee6f0', toneMapped: false }));
    ring.rotation.y = Math.PI / 2;
    ring.position.x = sx * 0.006;
    const stem = new THREE.Mesh(new THREE.CapsuleGeometry(0.003, 0.014, 4, 8), BUD);
    stem.position.set(sx * 0.002, -0.013, -0.002);
    bud.add(shell, ring, stem);
    head.add(bud);
    buds[sx] = bud;
  }
  // Câbles des écouteurs vers la nuque
  head.add(cable([[0.086, -0.025, 0], [0.07, -0.07, -0.04], [0.03, -0.12, -0.07], [0, -0.15, -0.08]], 0.0012, CABLE, 24));
  head.add(cable([[-0.086, -0.025, 0], [-0.07, -0.07, -0.04], [-0.03, -0.12, -0.07], [0, -0.15, -0.08]], 0.0012, CABLE, 24));

  // Boîtier électronique à la ceinture (position illustrative)
  const box = createBeltBox();
  box.position.set(0.17, 0.98, -0.07);
  box.rotation.y = 0.5;
  body.add(box);
  // câble de la nuque vers le boîtier (dans le dos)
  body.add(cable([[0, 1.5, -0.08], [0.03, 1.4, -0.135], [0.1, 1.2, -0.13], [0.16, 1.06, -0.11], [0.17, 1.0, -0.09]], 0.0025, CABLE, 48));

  // Bras (épaule → coude → main)
  const arms = {};
  for (const sx of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(sx * 0.205, 1.41, 0);
    const upper = limb(0.047, UP_ARM - 0.04, SHIRT);
    const elbow = new THREE.Group();
    elbow.position.y = -UP_ARM;
    const fore = limb(0.04, FORE_ARM - 0.06, SKIN);
    const hand = new THREE.Group();
    hand.position.y = -FORE_ARM;
    const palm = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.075, 0.028, 3, 0.012), SKIN);
    palm.position.y = -0.01;
    palm.castShadow = true;
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.009, 0.025, 4, 8), SKIN);
    thumb.position.set(-sx * 0.0, -0.005, 0.02);
    thumb.rotation.x = 0.8;
    hand.add(palm, thumb);
    elbow.add(fore, hand);
    shoulder.add(upper, elbow);
    body.add(shoulder);
    arms[sx] = { shoulder, elbow, hand };
  }

  // Jambes (hanche → genou → pied)
  const legs = {};
  for (const sx of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(sx * 0.09, 0.93, 0);
    const thigh = limb(0.068, 0.36, PANTS);
    const knee = new THREE.Group();
    knee.position.y = -0.45;
    const shin = limb(0.056, 0.36, PANTS);
    const foot = new THREE.Group();
    foot.position.y = -0.45;
    const shoe = new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.07, 0.25, 3, 0.03), SHOE);
    shoe.position.set(0, -0.005, 0.05);
    shoe.castShadow = true;
    const sole = new THREE.Mesh(new RoundedBoxGeometry(0.104, 0.022, 0.255, 2, 0.01), SOLE);
    sole.position.set(0, -0.035, 0.05);
    foot.add(shoe, sole);
    knee.add(shin, foot);
    hip.add(thigh, knee);
    body.add(hip);
    legs[sx] = { hip, knee, foot };
  }

  // Canne blanche (aide de mobilité habituelle)
  let caneMesh = null;
  if (cane) {
    caneMesh = new THREE.Group();
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 1.15, 12), new THREE.MeshStandardMaterial({ color: '#d9dde2', roughness: 0.6 }));
    stick.position.y = -0.575;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.0095, 0.0095, 0.12, 12), new THREE.MeshStandardMaterial({ color: '#d32f2f', roughness: 0.4 }));
    band.position.y = -0.98;
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.16, 12), MAT.plasticBlack);
    grip.position.y = -0.03;
    caneMesh.add(stick, band, grip);
    caneMesh.rotation.x = 0.55;
    arms[-1].hand.add(caneMesh);
  }

  // ---- Poses ----
  const _S = new THREE.Vector3(), _u = new THREE.Vector3(), _p = new THREE.Vector3(), _E = new THREE.Vector3(), _q = new THREE.Quaternion(), _d = new THREE.Vector3();

  /** Bras en cinématique directe (angles en radians). */
  function armFK(sx, pitch, roll = 0, elbowBend = 0) {
    const a = arms[sx];
    a.shoulder.quaternion.setFromEuler(new THREE.Euler(pitch, 0, sx * roll, 'XYZ'));
    a.elbow.quaternion.setFromEuler(new THREE.Euler(-elbowBend, 0, 0));
  }

  /**
   * Bras en cinématique inverse à deux segments.
   * target et pole dans le repère de `body`.
   */
  function armIK(sx, target, pole) {
    const a = arms[sx];
    _S.copy(a.shoulder.position);
    _u.subVectors(target, _S);
    let d = _u.length();
    d = THREE.MathUtils.clamp(d, Math.abs(UP_ARM - FORE_ARM) + 0.01, UP_ARM + FORE_ARM - 0.005);
    _u.normalize();
    const cosA = (UP_ARM * UP_ARM + d * d - FORE_ARM * FORE_ARM) / (2 * UP_ARM * d);
    const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
    _p.copy(pole).addScaledVector(_u, -pole.dot(_u)).normalize();
    _E.copy(_S).addScaledVector(_u, UP_ARM * cosA).addScaledVector(_p, UP_ARM * sinA);
    _d.subVectors(_E, _S).normalize();
    a.shoulder.quaternion.setFromUnitVectors(DOWN, _d);
    const tgt = _S.clone().addScaledVector(_u, d);
    _d.subVectors(tgt, _E).normalize();
    _q.copy(a.shoulder.quaternion).invert();
    _d.applyQuaternion(_q);
    a.elbow.quaternion.setFromUnitVectors(DOWN, _d);
  }

  /** Cycle de marche. phase en radians, amp 0..1 */
  function walk(phase, amp) {
    for (const sx of [-1, 1]) {
      const s = Math.sin(phase + (sx > 0 ? 0 : Math.PI));
      const L = legs[sx];
      L.hip.rotation.x = -s * 0.42 * amp;
      L.knee.rotation.x = Math.max(0, Math.sin(phase + (sx > 0 ? 0 : Math.PI) + 1.2)) * 0.75 * amp;
      L.foot.rotation.x = -L.hip.rotation.x * 0.3 - L.knee.rotation.x * 0.3;
    }
    body.position.y = Math.abs(Math.cos(phase)) * 0.018 * amp - 0.009 * amp;
    torso.rotation.y = Math.sin(phase) * 0.05 * amp;
  }

  function armSwing(phase, amp, sides = [-1, 1]) {
    for (const sx of sides) {
      const s = Math.sin(phase + (sx > 0 ? Math.PI : 0));
      armFK(sx, -s * 0.38 * amp, 0.06, 0.25 + 0.15 * amp);
    }
  }

  function rest() {
    walk(0, 0);
    armFK(1, 0, 0.06, 0.15);
    armFK(-1, 0, 0.06, 0.15);
    headPivot.rotation.set(0, 0, 0);
  }
  rest();

  /** Convertit une position monde dans le repère `body`. */
  function toBody(world) {
    root.updateMatrixWorld(true);
    return body.worldToLocal(world.clone());
  }

  return { root, body, head, headPivot, glasses, buds, arms, legs, box, cane: caneMesh, armFK, armIK, walk, armSwing, rest, toBody };
}
