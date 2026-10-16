// Fonction 1 : détection d'obstacle (HC-SR04) et message vocal (DFPlayer Mini).
import * as THREE from 'three';
import { View, placeBubble } from './base.js';
import { createStage, createCardboardBox, createPillar } from '../models/props.js';
import { createPerson } from '../models/person.js';
import { SonarPulses, SoundRings, FlowLine, groundRing, dustField } from '../models/effects.js';
import { smooth, windowed, clamp, lerp } from '../util.js';

export const OBSTACLE_MESSAGE = 'Attention, il y a un obstacle devant vous.';

const Z0 = -1.6; // position de départ
const V = 0.26; // vitesse de marche (m/s, ralentie pour l'explication)

/** Distance parcourue à l'instant t (marche puis arrêt progressif). */
function walked(t) {
  const a = Math.min(t, 8.4);
  const u = clamp(t - 8.4, 0, 1);
  return V * a + V * (u - (u * u) / 2);
}

export class ObstacleView extends View {
  constructor(app, hud) {
    super(app);
    this.hud = hud;
    this.duration = 18;
    this.cues = [{ t: 10, fn: () => app.speak(OBSTACLE_MESSAGE) }];
  }

  build() {
    const { scene, lights } = createStage({ env: this.engine.envMap });
    this.scene = scene;
    lights.key.position.set(4, 7, 1);
    lights.key.shadow.camera.left = -4; lights.key.shadow.camera.right = 4;
    lights.key.shadow.camera.top = 4; lights.key.shadow.camera.bottom = -4;
    lights.key.target.position.set(0, 0, 0.5);

    // Pile de cartons : l'obstacle arrive à hauteur de tête, là où vise le capteur
    this.stack = new THREE.Group();
    const sizes = [[0.6, 0.5, 0.48], [0.56, 0.46, 0.46], [0.52, 0.44, 0.44], [0.44, 0.38, 0.4]];
    let y = 0;
    sizes.forEach(([w, h, d], i) => {
      const b = createCardboardBox(w, h, d);
      b.position.set((i % 2 ? 0.02 : -0.015), y, 0);
      b.rotation.y = [0.04, -0.05, 0.07, -0.03][i];
      y += h;
      this.stack.add(b);
    });
    this.stack.position.set(0, 0, 1.95);
    this.faceZ = 1.95 - 0.2;
    scene.add(this.stack);

    this.ring = groundRing('#2ee6f0', 0.55);
    this.ring.position.set(0, 0.004, 1.95);
    scene.add(this.ring);

    for (const z of [-2, 0, 2, 4]) {
      for (const x of [-1.9]) {
        const p = createPillar(3);
        p.position.set(x, 1.5, z);
        scene.add(p);
      }
    }
    this.dust = dustField(220, [6, 3, 8]);
    scene.add(this.dust);

    const p = createPerson();
    this.person = p;
    scene.add(p.root);

    this.sonar = new SonarPulses(scene, { start: 3, interval: 0.9, speed: 1.4 });
    this.sonar.enabledUntil = 11.5;
    this.measure = new FlowLine(scene, '#2ee6f0', 0.004, { speed: 1.5 });
    this.rings = [new SoundRings(p.buds[1], new THREE.Vector3(1, 0, 0)), new SoundRings(p.buds[-1], new THREE.Vector3(-1, 0, 0))];

    this.mid = new THREE.Object3D();
    scene.add(this.mid);
    this.lblObstacle = this.labels.add(this.stack, '<b>Obstacle</b>', { offset: [90, -60], local: new THREE.Vector3(0.25, 1.5, -0.2) });
    this.lblSensor = this.labels.add(p.glasses.parts.hc, '<b>HC-SR04</b> émet des ultrasons', { offset: [-40, -110] });
    this.lblDist = this.labels.add(this.mid, 'distance mesurée', { offset: [0, -60], cls: 'small' });

    this.bubble = document.createElement('div');
    this.bubble.className = 'bubble';
    this.bubble.innerHTML = `<div class="bubble-box"><span class="bubble-icon" aria-hidden="true"></span><span>« ${OBSTACLE_MESSAGE} »</span></div>`;
    this.labels.root.appendChild(this.bubble);

    // seuil illustratif = distance atteinte à t = 7,6 s (aucune valeur réelle n'est affirmée)
    this.threshold = this.distanceAt(7.6);
    this.maxD = this.distanceAt(0) * 1.05;
    this.hud.setThreshold(this.threshold / this.maxD);

    this._s = new THREE.Vector3();
    this._t = new THREE.Vector3();
    this._head = new THREE.Vector3();
  }

  distanceAt(t) {
    return this.faceZ - (Z0 + walked(t) + 0.105);
  }

  update(t, dt, clock) {
    const p = this.person;
    const z = Z0 + walked(t);
    // vitesse instantanée → amplitude de la marche
    const v = t < 8.4 ? V : V * (1 - clamp(t - 8.4, 0, 1));
    const amp = (v / V) * 0.85;

    // changement de direction prudent après l'alerte
    const turn = smooth(12.5, 14.5, t) * 0.95;
    const side = Math.max(0, t - 14) * 0.18 * smooth(14, 14.6, t);
    const stepX = Math.min(side, 0.5);
    p.root.position.set(Math.sin(turn) * stepX, 0, z + Math.cos(turn) * stepX * 0.3);
    p.root.rotation.y = turn;
    const walking = amp > 0.01 || (t > 14 && t < 16.8);
    const wAmp = t > 14 ? 0.6 * windowed(t, 14, 14.4, 16.4, 16.8) : amp;
    const phase = t > 14 ? (t - 14) * 4 : (walked(t) / 0.55) * Math.PI;
    p.walk(phase, wAmp);
    p.armSwing(phase, wAmp);
    p.headPivot.rotation.y = -0.15 * windowed(t, 10.5, 11.5, 12.5, 13.5);
    if (!walking) p.walk(0, 0);

    // ultrasons
    const hc = p.glasses.parts.hc;
    hc.getWorldPosition(this._s);
    this._t.set(this._s.x, this._s.y, this.faceZ);
    this.sonar.update(t, hc, this._t);

    const d = this._t.distanceTo(this._s);
    const measuring = t >= 5.5;
    this.measure.set(this._s, this._t, windowed(t, 5.5, 6, 11.5, 12) * 0.9, clock);
    this.mid.position.copy(this._s).add(this._t).multiplyScalar(0.5);

    const speaking = windowed(t, 9.2, 9.5, 12.2, 12.6);
    this.rings.forEach((r) => r.update(clock, speaking));
    this.ring.update(clock, windowed(t, 1.5, 2, 11.5, 12.5));
    this.dust.update(clock);

    this.lblObstacle.opacity = windowed(t, 1.5, 2.2, 11.5, 12.5);
    this.lblSensor.opacity = windowed(t, 3, 3.5, 5.5, 6);
    this.lblDist.opacity = windowed(t, 5.6, 6.2, 9.8, 10.2);
    this.labels.update(this.engine);

    p.head.getWorldPosition(this._head);
    this._head.y += 0.17;
    placeBubble(this.engine, this.bubble, this._head, t >= 10 && t < 16.5);

    // caméra latérale qui accompagne la marche
    const mid = (z + 1.95) / 2;
    const drift = Math.sin(clock * 0.15) * 0.15;
    this.camera.position.set(3.7 + drift, 2.05, mid - 2.3);
    this.camera.lookAt(0, 1.1, mid + 0.05);

    // interface (jauge + chaîne de traitement)
    const below = measuring && d < this.threshold;
    this.hud.update({
      t,
      dist: measuring ? clamp(d / this.maxD) : null,
      below,
      nodes: {
        hc: t >= 3 && t < 12,
        esp: t >= 6.8 && t < 12,
        df: t >= 8 && t < 12.5,
        sd: t >= 9.2 && t < 12.5,
        ear: t >= 9.2 && t < 12.6,
      },
    });
  }
}
