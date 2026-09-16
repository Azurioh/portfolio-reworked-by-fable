import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export type Smooth = {
  lenis: Lenis | null;
  scrollTo: (target: string | HTMLElement) => void;
  stop: () => void;
  start: () => void;
};

/**
 * Creates the smooth-scroll controller (Lenis synced with the GSAP ticker).
 * @param reduced - When true, returns a native-scroll fallback.
 * @returns Scroll controller.
 */
export function createSmooth(reduced: boolean): Smooth {
  if (reduced) {
    return {
      lenis: null,
      scrollTo: (target) => {
        const el = typeof target === 'string' ? document.querySelector<HTMLElement>(target) : target;
        if (el) {
          el.scrollIntoView({ block: 'start' });
        }
      },
      stop: () => undefined,
      start: () => undefined,
    };
  }

  const lenis = new Lenis({
    autoRaf: false,
    lerp: 0.09,
    smoothWheel: true,
    anchors: false,
  });

  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
  });
  gsap.ticker.lagSmoothing(0);

  return {
    lenis,
    scrollTo: (target) => {
      lenis.scrollTo(target, { offset: 0, duration: 1.4, easing: (t) => 1 - Math.pow(1 - t, 4) });
    },
    stop: () => lenis.stop(),
    start: () => lenis.start(),
  };
}
