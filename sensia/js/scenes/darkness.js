// Fonction 2 : la LDR détecte l'obscurité, l'ESP32 allume les deux LED.
import * as THREE from 'three';
import { View } from './base.js';
import { createStage, createBench, createPillar, createPlant } from '../models/props.js';
import { createPerson } from '../models/person.js';
import { dustField } from '../models/effects.js';
import { smooth, windowed, lerp, clamp } from '../util.js';

const THRESHOLD = 0.35; // position illustrative du seuil sur la jauge (pas une valeur réelle)
const HYST = 0.03;
const DAY = new THREE.Color('#1a3157');
const NIGHT = new THREE.Color('#050a16');

export class DarknessView extends View {
  constructor(app, hud) {
    super(app);
    this.hud = hud;
    this.duration = 18;
    this.manual = false;
    this.manualLevel = 1;
    this.led = 0;
    this.ledOn = false;
    this.bloom = { strength: 0.9, radius: 0.6, threshold: 0.88 };
    hud.setThreshold(THRESHOLD);
  }

  build() {
    const st = createStage({ env: this.engine.envMap, bg: '#1a3157', fog: [5, 18] });
    this.st = st;
    this.scene = st.scene;
    const bench = createBench();
    bench.position.set(-0.35, 0, 2.3);
    bench.rotation.y = 0.12;
    const plant = createPlant();
    plant.position.set(-1.1, 0, 2.9);
    this.scene.add(bench, plant);
    for (const [x, z] of [[-1.9, -1.2], [1.9, -1.4], [-1.9, 1.5], [-2.2, 4]]) {
      const p = createPillar(3);
      p.position.set(x, 1.5, z);
      this.scene.add(p);
    }
    this.dust = dustField(260, [6, 3, 7], '#9fdcff');
    this.scene.add(this.dust);

    const p = createPerson();
    this.person = p;
    p.root.rotation.y = 0.12;
    this.scene.add(p.root);


    const g = p.glasses.parts;
    this.lblLdr = this.labels.add(g.ldr, '<b>LDR</b> mesure la luminosité', { offset: [-150, -90] });
    this.lblL = this.labels.add(g.ledL, '<b>LED</b> gauche', { offset: [140, 30] });
    this.lblR = this.labels.add(g.ledR, '<b>LED</b> droite', { offset: [-170, 30] });
    this._a = new THREE.Vector3();
  }

  setManual(on, level) {
    this.manual = on;
    if (level !== undefined) this.manualLevel = level;
  }

  /** Niveau de lumière ambiante 0..1 selon la timeline (ou le curseur). */
  ambient(t) {
    if (this.manual) return this.manualLevel;
    if (t < 12) return 1 - 0.94 * smooth(2, 7.5, t);
    return 0.06 + 0.94 * smooth(12, 15.5, t);
  }

  update(t, dt, clock, realDt = dt) {
    const L = this.ambient(t);
    const { hemi, key, rim } = this.st.lights;
    hemi.intensity = 0.14 + 0.76 * L;
    key.intensity = 0.12 + 2.28 * L;
    rim.intensity = 0.25 + 1.35 * L;
    this.scene.environmentIntensity = 0.05 + 0.5 * L;
    const bg = NIGHT.clone().lerp(DAY, L);
    this.scene.background.copy(bg);
    this.scene.fog.color.copy(bg);

    // mesure de la LDR (petite fluctuation) et logique à seuil avec hystérésis
    const reading = clamp(L + Math.sin(clock * 7) * 0.008);
    if (!this.ledOn && reading < THRESHOLD) this.ledOn = true;
    if (this.ledOn && reading > THRESHOLD + HYST) this.ledOn = false;
    const step = this.manual ? realDt : dt;
    this.led = lerp(this.led, this.ledOn ? 1 : 0, 1 - Math.exp(-step * 8));
    if (step === 0) this.led = this.ledOn ? 1 : 0;
    this.person.glasses.api.setLeds(this.led);

    const p = this.person;
    p.body.position.y = Math.sin(clock * 1.6) * 0.003;
    p.headPivot.rotation.x = 0.12;
    this.dust.update(clock);

    const az = 0.55 + Math.sin(clock * 0.12) * 0.15;
    this.camera.position.set(Math.sin(az) * 4.2, 2.0, Math.cos(az) * 4.2 + 0.8);
    this.camera.lookAt(0, 0.85, 1.0);

    this.lblLdr.opacity = this.manual ? 1 : windowed(t, 2.6, 3.2, 8, 8.6);
    this.lblL.opacity = this.lblR.opacity = this.led;
    this.labels.update(this.engine);

    this.hud.update({
      light: reading,
      on: this.ledOn,
      nodes: { ldr: true, esp: this.manual || t >= 5, leds: this.led > 0.5 },
    });
  }
}
