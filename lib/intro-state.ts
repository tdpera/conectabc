/** Estado da coreografia da abertura 3D (animado pelo GSAP, lido pela cena). */
export interface IntroState {
  reveal: number;
  logo: number;
  burst: number;
  flash: number;
  coast: number;
  tilt: number;
  settle: number;
  grid: number;
  rise: number;
  draw: number;
  scroll: number;
  /** 0→1→0: viagem pelo túnel de luz antes do logotipo. */
  warp: number;
  /** 0→1: estilhaços de cristal voam quando o logotipo explode. */
  shatter: number;
  /** 0→1: a cidade 3D (prédios, morros, roda-gigante) sobe do chão. */
  city: number;
}

/** Ponteiro (mouse/toque) compartilhado entre o herói e a cena; mutável, sem re-render. */
export interface PointerState {
  /** 0..1 na tela, origem no topo esquerdo. */
  x: number;
  y: number;
  /** velocidade suavizada, em telas por segundo. */
  vx: number;
  vy: number;
  down: boolean;
  touch: boolean;
  /** já houve interação real. */
  active: boolean;
  /** últimos toques/cliques: posição 0..1 e performance.now()/1000. */
  taps: { x: number; y: number; t: number }[];
}

export const initialPointer = (): PointerState => ({ x: 0.5, y: 0.5, vx: 0, vy: 0, down: false, touch: false, active: false, taps: [] });

export const initialIntro = (): IntroState => ({ reveal: 0, logo: 0, burst: 0, flash: 0, coast: 0, tilt: 0, settle: 0, grid: 0, rise: 0, draw: 0, scroll: 0, warp: 0, shatter: 0, city: 0 });

