// Vue "vitrine" : les lunettes SENSIA en lévitation (problématique, conclusion).
import * as THREE from 'three';
import { View } from './base.js';
import { createGlasses } from '../models/glasses.js';
import { SonarPulses, dustField, makeBeam } from '../models/effects.js';
import { windowed } from '../util.js';

export class HeroView extends View {
  constructor(app) {
    super(app);
    this.duration = 12;
    this.loop = true;
    this.bloom = { strength: 0.65, radius: 0.55, threshold: 1.0 };
  }

  build() {
    const scene = new THREE.Scene();
    this.scene = scene;
    scene.background = new THREE.Color('#050c19');
    scene.environment = this.engine.envMap;
    scene.environmentIntensity = 0.9;
    const key = new THREE.DirectionalLight('#ffffff', 2.4);
    key.position.set(2, 3, 4);
    const rim = new THREE.DirectionalLight('#38d6ff', 3);
    rim.position.set(-3, 1, -3);
    const fill = new THREE.HemisphereLight('#bcd7ff', '#050c19', 0.5);
    scene.add(key, rim, fill);

    const g = createGlasses({ withWires: false });
    this.glasses = g;
    this.pivot = new THREE.Group();
    this.pivot.scale.setScalar(6);
    this.pivot.add(g.group);
    scene.add(this.pivot);

    // halo circulaire au sol
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.005, 8, 128), new THREE.MeshBasicMaterial({ color: '#2ee6f0', toneMapped: false, transparent: true, opacity: 0.6 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.55;
    const ring2 = ring.clone();
    ring2.scale.setScalar(0.7);
    ring2.material = ring.material.clone();
    ring2.material.opacity = 0.25;
    const top = makeBeam('#9fd0ff', 4, 1.0, new THREE.Vector3(0, -1, 0));
    top.position.y = 3.4;
    top.material.uniforms.uOpacity.value = 0.06;
    top.onBeforeRender = () => (top.material.uniforms.uTime.value = performance.now() / 1000);
    scene.add(ring, ring2, top);
    this.dust = dustField(400, [6, 3, 6]);
    this.dust.position.y = -1.2;
    scene.add(this.dust);

    this.sonar = new SonarPulses(scene, { start: 0.5, interval: 1.2, speed: 0.9, count: 10, echo: false });
    this.sonar.gain = 0.3;
    this.target = new THREE.Vector3();
  }

  enter() {
    super.enter();
    // décalage de l'image quand la vue est plein écran (conclusion)
    this.shift = this.app.currentArea === 'full' ? 0.2 : 0;
    this.engine.fitCamera(this.camera);
  }

  update(t, dt, clock, realDt = dt) {
    // caméra recalculée à chaque image (compatible avec le travelling d'entrée)
    this.camera.position.set(Math.sin(clock * 0.1) * 0.12, 0.12, 2.05);
    this.camera.lookAt(0, -0.02, 0);
    this.applyEntrance(realDt);
    this.pivot.rotation.y = Math.sin(clock * 0.35) * 0.65;
    this.pivot.rotation.x = 0.08 + Math.sin(clock * 0.5) * 0.04;
    this.pivot.position.y = Math.sin(clock * 0.9) * 0.03;
    this.glasses.api.setLeds(windowed(t, 4, 5, 10, 11));
    this.glasses.api.setTcsLight(0.4 + 0.4 * Math.sin(clock * 2.2));
    this.dust.update(clock);
    const hc = this.glasses.parts.hc;
    hc.getWorldPosition(this.target);
    const dir = new THREE.Vector3(0, 0, 1).applyQuaternion(this.pivot.quaternion);
    this.target.addScaledVector(dir, 0.75);
    this.sonar.update(t, hc, this.target);
  }
}
