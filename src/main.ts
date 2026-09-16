import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { createSmooth } from './lib/smooth';
import { createCursor } from './lib/cursor';
import { createSky } from './lib/sky';
import { setupContactForm } from './lib/contact';
import { findLatestCommit } from './lib/github';
import { renderTerminalCommit, setupAnchors, setupLocalTime, setupMenu, setupQuotes } from './lib/ui';
import {
  heroReveal,
  marquee,
  orbJourney,
  playIntro,
  recordSequence,
  refresh,
  sectionReveals,
  splitAll,
  worksReveal,
} from './lib/animations';

gsap.registerPlugin(ScrollTrigger);

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}
window.scrollTo(0, 0);

const smooth = createSmooth(reduced);

const skyCanvas = document.querySelector<HTMLCanvasElement>('#sky');
if (skyCanvas) {
  const sky = createSky(skyCanvas, reduced);
  if (smooth.lenis) {
    smooth.lenis.on('scroll', ({ scroll }) => sky.setScroll(scroll));
  } else {
    window.addEventListener('scroll', () => sky.setScroll(window.scrollY), { passive: true });
  }
}

setupMenu(smooth);
setupAnchors(smooth);
setupQuotes();
setupLocalTime();
setupContactForm();
createCursor();
void findLatestCommit().then((result) => renderTerminalCommit({ result }));

const boot = (): void => {
  splitAll();
  orbJourney();
  recordSequence();
  worksReveal();
  sectionReveals();
  marquee();
  heroReveal();
  refresh();
};

const start = (): void => {
  if (reduced) {
    document.querySelector('.intro')?.remove();
    smooth.start();
    boot();
    return;
  }
  smooth.stop();
  playIntro(() => {
    smooth.start();
  });
  // Build scroll scenes while the intro plays so the page is ready underneath.
  window.setTimeout(boot, 1300);
};

if (document.fonts) {
  Promise.race([document.fonts.ready, new Promise((r) => window.setTimeout(r, 1200))]).then(start);
} else {
  start();
}

window.addEventListener('load', () => refresh());
