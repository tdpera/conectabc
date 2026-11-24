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
}

export const initialIntro = (): IntroState => ({ reveal: 0, logo: 0, burst: 0, flash: 0, coast: 0, tilt: 0, settle: 0, grid: 0, rise: 0, draw: 0, scroll: 0 });

