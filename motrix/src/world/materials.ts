import * as THREE from 'three';

/** Palette de présentation (cohérente avec tokens.css). */
export const COLORS = {
  bg: 0x070b14,
  cyan: 0x3cc6ee,
  amber: 0xf2a93b,
  red: 0xe5484d,
  white: 0xe8edf4,
} as const;

export const TONE_COLOR = {
  normal: new THREE.Color(COLORS.cyan),
  warning: new THREE.Color(COLORS.amber),
  fault: new THREE.Color(COLORS.red),
} as const;

function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  if (!g) throw new Error('Canvas 2D indisponible');
  draw(g);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Sol : grille discrète de type plan technique. */
export function floorTexture(): THREE.CanvasTexture {
  const t = canvasTexture(512, 512, (g) => {
    g.fillStyle = '#0b111c';
    g.fillRect(0, 0, 512, 512);
    g.strokeStyle = 'rgba(120,150,190,0.10)';
    g.lineWidth = 1;
    for (let i = 0; i <= 512; i += 64) {
      g.beginPath();
      g.moveTo(i + 0.5, 0);
      g.lineTo(i + 0.5, 512);
      g.moveTo(0, i + 0.5);
      g.lineTo(512, i + 0.5);
      g.stroke();
    }
    g.strokeStyle = 'rgba(120,150,190,0.18)';
    g.lineWidth = 2;
    g.strokeRect(1, 1, 510, 510);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(16, 16);
  return t;
}

/** Halo de lumière au sol (dégradé radial), pour donner de la profondeur. */
export function poolTexture(): THREE.CanvasTexture {
  return canvasTexture(256, 256, (g) => {
    const r = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    r.addColorStop(0, 'rgba(150,185,230,0.55)');
    r.addColorStop(0.45, 'rgba(110,150,210,0.18)');
    r.addColorStop(1, 'rgba(80,120,190,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, 256, 256);
  });
}

/** Plaque du moteur : volontairement sans caractéristiques (aucune donnée inventée). */
export function nameplateTexture(): THREE.CanvasTexture {
  return canvasTexture(512, 256, (g) => {
    g.fillStyle = '#b9c0c8';
    g.fillRect(0, 0, 512, 256);
    g.strokeStyle = '#59616b';
    g.lineWidth = 6;
    g.strokeRect(10, 10, 492, 236);
    g.fillStyle = '#2b3139';
    g.font = '600 64px "Barlow Condensed", Arial, sans-serif';
    g.fillText('MOTRIX', 34, 92);
    g.fillStyle = '#7b848f';
    for (let i = 0; i < 4; i++) g.fillRect(34, 128 + i * 26, 440 - i * 60, 6);
  });
}

export interface MaterialSet {
  paint: THREE.MeshPhysicalMaterial;
  cut: THREE.MeshStandardMaterial;
  steel: THREE.MeshStandardMaterial;
  lamination: THREE.MeshStandardMaterial;
  rotorCore: THREE.MeshStandardMaterial;
  alu: THREE.MeshStandardMaterial;
  brass: THREE.MeshStandardMaterial;
  dark: THREE.MeshStandardMaterial;
  plastic: THREE.MeshStandardMaterial;
  plasticDark: THREE.MeshStandardMaterial;
  plate: THREE.MeshStandardMaterial;
  duct: THREE.MeshStandardMaterial;
  glass: THREE.MeshStandardMaterial;
  floor: THREE.MeshStandardMaterial;
  nameplate: THREE.MeshStandardMaterial;
}

export function createMaterials(): MaterialSet {
  return {
    paint: new THREE.MeshPhysicalMaterial({
      color: 0x3b434e,
      metalness: 0.5,
      roughness: 0.38,
      clearcoat: 0.45,
      clearcoatRoughness: 0.35,
      emissive: 0x000000,
    }),
    cut: new THREE.MeshStandardMaterial({ color: 0x8e98a4, metalness: 0.85, roughness: 0.34 }),
    steel: new THREE.MeshStandardMaterial({ color: 0xc4cad2, metalness: 1, roughness: 0.24 }),
    lamination: new THREE.MeshStandardMaterial({ color: 0x66707c, metalness: 0.85, roughness: 0.36 }),
    rotorCore: new THREE.MeshStandardMaterial({ color: 0x4f5864, metalness: 0.85, roughness: 0.4 }),
    alu: new THREE.MeshStandardMaterial({ color: 0xb4bcc6, metalness: 0.9, roughness: 0.3 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xc6a24e, metalness: 1, roughness: 0.3 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x15191f, metalness: 0.2, roughness: 0.7 }),
    plastic: new THREE.MeshStandardMaterial({ color: 0xc9ced6, metalness: 0, roughness: 0.55 }),
    plasticDark: new THREE.MeshStandardMaterial({ color: 0x353b44, metalness: 0.1, roughness: 0.6 }),
    plate: new THREE.MeshStandardMaterial({ color: 0x3a414a, metalness: 0.7, roughness: 0.46 }),
    duct: new THREE.MeshStandardMaterial({ color: 0x555c66, metalness: 0.1, roughness: 0.7 }),
    glass: new THREE.MeshStandardMaterial({
      color: 0x0e1622,
      metalness: 0.2,
      roughness: 0.15,
      transparent: true,
      opacity: 0.55,
    }),
    floor: new THREE.MeshStandardMaterial({ color: 0xffffff, map: floorTexture(), metalness: 0.2, roughness: 0.85 }),
    nameplate: new THREE.MeshStandardMaterial({ map: nameplateTexture(), metalness: 0.6, roughness: 0.4 }),
  };
}

/** Matériau émissif de voyant / LED (couleur pilotée à l'exécution). */
export function emissiveMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0x1a2028,
    emissive: 0x000000,
    emissiveIntensity: 1,
    metalness: 0.1,
    roughness: 0.25,
  });
}
