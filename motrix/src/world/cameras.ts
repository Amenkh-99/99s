import type { CameraKey } from '../core/state';

export interface CameraPose {
  pos: [number, number, number];
  target: [number, number, number];
  fov: number;
}

/**
 * Cadrages. La colonne de texte occupe la gauche de l'écran : la cible est
 * décalée pour que le sujet se place dans les deux tiers droits.
 */
export const CAMERAS: Record<CameraKey, CameraPose> = {
  hero: { pos: [2.55, 0.62, 2.05], target: [0.86, 0.5, 0.15], fov: 30 },
  heroWide: { pos: [3.7, 1.25, 3.1], target: [0.75, 0.55, 0.1], fov: 32 },
  problem: { pos: [2.37, 0.62, 2.37], target: [0.27, 0.35, -0.32], fov: 42 },
  motorSide: { pos: [1.93, 1.38, 2.83], target: [0.4, 0.09, -0.47], fov: 36 },
  motorExplode: { pos: [1.55, 1.55, 4.15], target: [0.95, 0.4, 0.0], fov: 35 },
  motorCut: { pos: [2.45, 1.2, 1.75], target: [1.0, 0.44, 0.08], fov: 32 },
  orbitCalm: { pos: [3.9, 1.7, 3.6], target: [0.2, 0.7, -0.4], fov: 34 },
  benchWide: { pos: [-0.24, 2.47, 6.49], target: [-1.56, 0.69, -0.24], fov: 40 },
  panel: { pos: [-0.95, 1.56, 2.83], target: [-2.37, 1.28, -1.29], fov: 44 },
  powerRun: { pos: [1.31, 2.69, 5.09], target: [-1.08, 0.37, 0.22], fov: 44 },
  motorBox: { pos: [2.65, 1.45, 1.6], target: [0.9, 0.55, -0.35], fov: 36 },
  sensors: { pos: [1.63, 3.4, 4.9], target: [-1.66, 0.73, -0.85], fov: 38 },
  plc: { pos: [-1.02, 1.53, 2.98], target: [-2.16, 0.93, -1.68], fov: 34 },
  scenarioWide: { pos: [1.15, 1.86, 5.98], target: [-1.62, 1.02, -0.97], fov: 41 },
  supplyTop: { pos: [-1.35, 2.3, 1.35], target: [-2.6, 1.9, -1.0], fov: 38 },
  contactor: { pos: [-0.5, 1.73, 0.52], target: [-2.25, 1.42, -1.1], fov: 44 },
  cableToMotor: { pos: [2.6, 2.54, 4.06], target: [-1.61, -0.12, -0.48], fov: 44 },
  motorStop: { pos: [2.7, 1.0, 2.19], target: [0.23, 0.17, -0.14], fov: 40 },
  alarm: { pos: [-1.22, 1.72, 2.01], target: [-1.83, 1.06, -1.39], fov: 40 },
  backdrop: { pos: [2.27, 2.57, 4.04], target: [-0.46, 0.67, 0.51], fov: 44 },
  finale: { pos: [2.26, 1.01, 2.96], target: [0.43, 0.41, 0.02], fov: 37 },
};
