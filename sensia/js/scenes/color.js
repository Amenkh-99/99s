// Fonction 3 : identification de la couleur d'un objet à la demande
// (bouton poussoir → TCS3200 → ESP32 → DFPlayer Mini → écouteurs).
import * as THREE from 'three';
import { View, placeBubble } from './base.js';
import { createStage, createApple, createCube, createPlant } from '../models/props.js';
import { createPerson } from '../models/person.js';
import { SoundRings, FlowLine, outlineShell, makeBeam, dustField } from '../models/effects.js';
import { smooth, windowed, lerp } from '../util.js';

export const OBJECTS = {
  rouge: {
    label: 'Pomme rouge',
    message: "La couleur de l'objet est rouge.",
    result: 'ROUGE',
    rgb: [0.92, 0.2, 0.16],
    css: '#ff4545',
  },
  bleu: {
    label: 'Cube bleu',
    message: "La couleur de l'objet est bleue.",
    result: 'BLEU',
    rgb: [0.16, 0.32, 0.88],
    css: '#4d8bff',
  },
};

export class ColorView extends View {
  constructor(app, hud) {
    super(app);
    this.hud = hud;
    this.duration = 16;
    this.key = 'rouge';
    this.bloom = { strength: 0.7, radius: 0.55, threshold: 0.8 };
    this.cues = [{ t: 11, fn: () => app.speak(OBJECTS[this.key].message) }];
  }

  build() {
    const { scene, lights } = createStage({ env: this.engine.envMap, bg: '#0a1528' });
    this.scene = scene;
    lights.key.position.set(2, 5, 4);
    const plant = createPlant();
    plant.position.set(-1.3, 0, -1.2);
    scene.add(plant);
    this.dust = dustField(200, [4, 3, 4]);
    scene.add(this.dust);

    const p = createPerson();
    this.person = p;
    scene.add(p.root);

    this.objects = { rouge: createApple(), bleu: createCube('#1f5fe0') };
    this.shells = {};
    for (const [k, o] of Object.entries(this.objects)) {
      const shell = outlineShell(o.userData.geometry, '#2ee6f0', 1.12);
      (o.userData.inner || o).add(shell);
      this.shells[k] = shell;
      scene.add(o);
    }

    this.aim = new FlowLine(scene, '#2ee6f0', 0.0016, { speed: 1.4 });
    this.reflect = new FlowLine(scene, '#ff4545', 0.0022, { speed: -1.6 });
    this.beam = makeBeam('#ffffff', 1, 0.045, new THREE.Vector3(0, 0, 1));
    scene.add(this.beam);
    this.tcsLight = new THREE.PointLight('#ffffff', 0, 0.6, 2);
    scene.add(this.tcsLight);
    this.rings = [new SoundRings(p.buds[1], new THREE.Vector3(1, 0, 0)), new SoundRings(p.buds[-1], new THREE.Vector3(-1, 0, 0))];

    const g = p.glasses.parts;
    this.anchor = new THREE.Object3D();
    scene.add(this.anchor);
    this.lblTcs = this.labels.add(g.tcs, '<b>TCS3200</b> orienté vers l\'objet', { offset: [130, -70] });
    this.lblObj = this.labels.add(this.anchor, '', { offset: [120, 50] });
    this.lblBtn = this.labels.add(g.button, '<b>Bouton</b> poussoir', { offset: [-150, -60] });

    this.bubble = document.createElement('div');
    this.bubble.className = 'bubble side';
    this.labels.root.appendChild(this.bubble);
    this.setObject(this.key);

    this._v = new THREE.Vector3();
    this._w = new THREE.Vector3();
    this._b = new THREE.Vector3();
  }

  setObject(key) {
    this.key = key;
    const o = OBJECTS[key];
    for (const [k, obj] of Object.entries(this.objects)) obj.visible = k === key;
    this.reflect.mat.uniforms.uColor.value.set(o.css);
    this.lblObj.el.querySelector('.label3d-text').innerHTML = `<b>${o.label}</b> mise en évidence`;
    this.bubble.innerHTML = `<div class="bubble-box"><span class="bubble-icon" aria-hidden="true"></span><span>« ${o.message} »</span></div>`;
  }

  update(t, dt, clock) {
    const p = this.person;
    const o = OBJECTS[this.key];
    const obj = this.objects[this.key];
    p.body.position.y = Math.sin(clock * 1.6) * 0.0025;
    this.dust.update(clock);

    // tête légèrement inclinée vers l'objet
    p.headPivot.rotation.x = 0.32 * smooth(0.8, 2, t);
    p.headPivot.rotation.y = 0.05 * smooth(0.8, 2, t);

    // bras gauche : tient l'objet devant le visage
    const raise = smooth(0, 1.6, t);
    const hold = new THREE.Vector3(lerp(0.24, 0.07, raise), lerp(0.86, 1.33, raise), lerp(0.05, 0.36, raise));
    p.armIK(1, hold, new THREE.Vector3(1, -1, -0.3));
    obj.position.copy(hold).add(new THREE.Vector3(0, 0.055, 0.0));
    obj.position.applyMatrix4(p.body.matrixWorld);
    if (obj.userData.inner) obj.userData.inner.rotation.y = 0.5 + Math.sin(clock * 0.6) * 0.1;

    // bras droit : appuie sur le bouton de la branche droite
    p.root.updateMatrixWorld(true);
    p.glasses.parts.button.getWorldPosition(this._b);
    const btn = p.toBody(this._b).add(new THREE.Vector3(-0.03, -0.005, 0.01));
    const restR = new THREE.Vector3(-0.24, 0.86, 0.04);
    const reach = windowed(t, 4, 5, 6, 7);
    p.armIK(-1, restR.clone().lerp(btn, reach), new THREE.Vector3(-1, -0.6, -0.4));
    const press = windowed(t, 5.05, 5.25, 5.7, 5.95);
    p.glasses.api.press(press);

    // TCS3200 : LED blanches, faisceau vers l'objet, lumière réfléchie
    const tcs = p.glasses.parts.tcs;
    tcs.getWorldPosition(this._v);
    obj.getWorldPosition(this._w);
    const measure = windowed(t, 6, 6.4, 8.4, 8.8);
    p.glasses.api.setTcsLight(measure);
    const dir = this._w.clone().sub(this._v);
    const dist = dir.length();
    dir.normalize();
    this.beam.position.copy(this._v);
    this.beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
    this.beam.scale.set(1, dist * 0.92, 1);
    this.beam.material.uniforms.uOpacity.value = measure * 0.22;
    this.beam.visible = measure > 0.01;
    this.tcsLight.position.copy(this._w).addScaledVector(dir, -0.06);
    this.tcsLight.intensity = measure * 0.2;
    this.aim.set(this._v, this._w, windowed(t, 1.8, 2.3, 5.6, 6) * 0.9, clock);
    this.reflect.set(this._w.clone().addScaledVector(dir, -0.03), this._v, windowed(t, 6.4, 6.8, 8.4, 8.8), clock);

    this.shells[this.key].update(windowed(t, 3, 3.5, 14.5, 15.5) * (0.55 + 0.2 * Math.sin(clock * 4)));
    const speaking = windowed(t, 10.5, 10.8, 13.6, 14);
    this.rings.forEach((r) => r.update(clock, speaking));

    this.anchor.position.copy(this._w);
    this.lblTcs.opacity = windowed(t, 1.8, 2.4, 5.8, 6.3);
    this.lblObj.opacity = windowed(t, 3, 3.6, 5.8, 6.3);
    this.lblBtn.opacity = windowed(t, 4, 4.5, 6.5, 7);
    this.labels.update(this.engine);

    p.head.getWorldPosition(this._b);
    this._b.x -= 0.12;
    placeBubble(this.engine, this.bubble, this._b, t >= 11);

    // caméra en gros plan, légère respiration
    const az = 0.62 + Math.sin(clock * 0.2) * 0.06;
    this.camera.position.set(Math.sin(az) * 1.25, 1.62, Math.cos(az) * 1.25 + 0.15);
    this.camera.lookAt(0.02, 1.5, 0.2);

    const bars = o.rgb.map((v) => v * smooth(6.4, 8, t));
    this.hud.update({
      pressed: t >= 5.2 && t < 7.8,
      bars,
      measuring: t >= 6.2,
      result: t >= 8.6 ? o.result : null,
      color: o.css,
      nodes: {
        btn: t >= 5.2 && t < 8,
        tcs: t >= 6 && t < 8.8,
        esp: t >= 6.6 && t < 10.5,
        df: t >= 9.5 && t < 13.8,
        sd: t >= 9.5 && t < 13.8,
        ear: t >= 10.5 && t < 14,
      },
    });
  }
}
