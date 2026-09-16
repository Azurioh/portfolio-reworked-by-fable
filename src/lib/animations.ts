import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(ScrollTrigger, SplitText);

const DESKTOP = '(min-width: 900px)';

/**
 * Plays the opening name reveal, then removes the overlay.
 * @param onDone - Called once the intro overlay has left the screen.
 */
export function playIntro(onDone: () => void): void {
  const intro = document.querySelector<HTMLElement>('.intro');
  if (!intro) {
    onDone();
    return;
  }
  const words = intro.querySelectorAll<HTMLElement>('.intro__line > span');
  const bar = intro.querySelector<HTMLElement>('.intro__bar i');

  gsap
    .timeline({
      defaults: { ease: 'power4.out' },
      onComplete: () => {
        intro.remove();
        onDone();
      },
    })
    .to(words, { y: 0, duration: 1.1, stagger: 0.12 }, 0.1)
    .to(bar, { scaleX: 1, duration: 1.4, ease: 'power2.inOut' }, 0.2)
    .to(words, { y: '-110%', duration: 0.8, stagger: 0.08, ease: 'power4.in' }, 1.7)
    .to(intro, { yPercent: -100, duration: 0.9, ease: 'expo.inOut' }, 2.1);
}

/**
 * Splits every `[data-split="lines"]` element into masked lines revealed on scroll.
 */
export function splitAll(): void {
  for (const el of document.querySelectorAll<HTMLElement>('[data-split="lines"]')) {
    const split = new SplitText(el, {
      type: 'lines',
      linesClass: 'split-line',
      aria: 'none',
      autoSplit: true,
      onSplit: (self) =>
        gsap.from(self.lines, {
          yPercent: 110,
          duration: 1.1,
          ease: 'power4.out',
          stagger: 0.07,
          scrollTrigger: { trigger: el, start: 'top 88%', once: true },
        }),
    });
    void split;
  }
}

/**
 * Animates the hero (name characters, lens, links), the pointer tilt and the scroll parallax.
 */
export function heroReveal(): void {
  const words = document.querySelectorAll<HTMLElement>('.hero__word');
  const splits = Array.from(words).map((w) => new SplitText(w, { type: 'chars', charsClass: 'char', aria: 'hidden' }));
  const chars = splits.flatMap((s) => s.chars);

  gsap
    .timeline({ defaults: { ease: 'power4.out' } })
    .from(chars, { yPercent: 120, rotate: 6, duration: 1.3, stagger: 0.035 }, 0)
    .from('.hero__eyebrow', { autoAlpha: 0, y: 12, duration: 0.8 }, 0.5)
    .from('.lens', { autoAlpha: 0, scale: 0.85, duration: 1.6, ease: 'expo.out' }, 0.2)
    .from('.hero__meta a, .hero__scroll', { autoAlpha: 0, y: 10, duration: 0.7, stagger: 0.06 }, 0.9);

  // Lens tilt on desktop pointer
  const lens = document.querySelector<HTMLElement>('.lens');
  if (lens && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const rx = gsap.quickTo(lens, 'rotationX', { duration: 0.8, ease: 'power3.out' });
    const ry = gsap.quickTo(lens, 'rotationY', { duration: 0.8, ease: 'power3.out' });
    gsap.set(lens, { transformPerspective: 900 });
    window.addEventListener(
      'pointermove',
      (e) => {
        const nx = e.clientX / window.innerWidth - 0.5;
        const ny = e.clientY / window.innerHeight - 0.5;
        rx(-ny * 10);
        ry(nx * 12);
      },
      { passive: true },
    );
  }

  // Parallax the hero title against scroll
  gsap.to('.hero__title', {
    yPercent: 18,
    ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
  });
  gsap.to('.lens', {
    yPercent: -12,
    ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
  });
}

type OrbKey = { id: string; edge: 'top' | 'bottom'; x: number; y: number; scale: number; opacity: number };

/**
 * The orb travels through the page as a single continuous path.
 * Keyframes are expressed in viewport units. A "top" key is reached when
 * the section's top passes 45% of the viewport; a "bottom" key when the
 * section (pin spacer included) leaves the viewport, which lets the orb
 * hold still over pinned scenes. Positions are re-measured on refresh.
 */
/**
 * Drives the floating orb along its page-long path from the current scroll position.
 */
export function orbJourney(): void {
  const orb = document.querySelector<HTMLElement>('.orb');
  if (!orb) {
    return;
  }

  const isDesktop = (): boolean => window.matchMedia(DESKTOP).matches;

  const keysFor = (): OrbKey[] => {
    const d = isDesktop();
    // x/y are offsets from the viewport centre, in vw / vh.
    const record = { x: 0, y: -4, scale: d ? 1.1 : 0.9, opacity: 0.9 };
    const pieces = { x: d ? 38 : 30, y: -36, scale: 0.45, opacity: 0.5 };
    return [
      { id: 'hero', edge: 'top', x: d ? 31 : 0, y: d ? -6 : -22, scale: d ? 1 : 0.8, opacity: 1 },
      { id: 'record', edge: 'top', ...record },
      { id: 'record', edge: 'bottom', ...record },
      { id: 'atelier', edge: 'top', x: d ? -34 : -30, y: 10, scale: 0.6, opacity: 0.7 },
      { id: 'pieces', edge: 'top', ...pieces },
      { id: 'pieces', edge: 'bottom', ...pieces },
      { id: 'parcours', edge: 'top', x: d ? -36 : -30, y: -20, scale: 0.55, opacity: 0.6 },
      { id: 'voix', edge: 'top', x: d ? 34 : 25, y: 12, scale: 0.7, opacity: 0.7 },
      { id: 'contact', edge: 'top', x: 0, y: 40, scale: d ? 1.5 : 1.3, opacity: 0.85 },
    ];
  };

  let keys = keysFor();
  let marks: number[] = [];

  const measure = (): void => {
    keys = keysFor();
    const vh = window.innerHeight;
    marks = keys.map((k) => {
      const el = document.getElementById(k.id);
      if (!el) {
        return 0;
      }
      const rect = el.getBoundingClientRect();
      if (k.edge === 'bottom') {
        return rect.bottom + window.scrollY - vh * 1.2;
      }
      return rect.top + window.scrollY - vh * 0.45;
    });
  };

  const xTo = gsap.quickTo(orb, 'x', { duration: 0.9, ease: 'power2.out' });
  const yTo = gsap.quickTo(orb, 'y', { duration: 0.9, ease: 'power2.out' });
  const sxTo = gsap.quickTo(orb, 'scaleX', { duration: 0.9, ease: 'power2.out' });
  const syTo = gsap.quickTo(orb, 'scaleY', { duration: 0.9, ease: 'power2.out' });
  const oTo = gsap.quickTo(orb, 'opacity', { duration: 0.9, ease: 'power2.out' });

  const apply = (scroll: number): void => {
    const vw = window.innerWidth / 100;
    const vh = window.innerHeight / 100;
    let i = 0;
    while (i < marks.length - 1 && scroll > marks[i + 1]) {
      i += 1;
    }
    const a = keys[i];
    const b = keys[Math.min(i + 1, keys.length - 1)];
    const span = Math.max(1, marks[Math.min(i + 1, marks.length - 1)] - marks[i]);
    const raw = gsap.utils.clamp(0, 1, (scroll - marks[i]) / span);
    const t = a === b ? 0 : gsap.parseEase('power1.inOut')(raw);
    xTo(gsap.utils.interpolate(a.x, b.x, t) * vw);
    yTo(gsap.utils.interpolate(a.y, b.y, t) * vh);
    const scale = gsap.utils.interpolate(a.scale, b.scale, t);
    sxTo(scale);
    syTo(scale);
    oTo(gsap.utils.interpolate(a.opacity, b.opacity, t));
  };

  measure();
  gsap.set(orb, {
    x: (keys[0].x * window.innerWidth) / 100,
    y: (keys[0].y * window.innerHeight) / 100,
    scale: keys[0].scale,
    opacity: keys[0].opacity,
  });

  ScrollTrigger.addEventListener('refresh', () => {
    measure();
    apply(window.scrollY);
  });

  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: (self) => apply(self.scroll()),
  });
}

/**
 * Builds the pinned "2:20 → 10 s" scene (pinned on desktop, scrubbed in flow on mobile).
 */
export function recordSequence(): void {
  const mm = gsap.matchMedia();

  mm.add(
    { desktop: DESKTOP, mobile: '(max-width: 899px)' },
    (ctx) => {
      const isDesktop = Boolean(ctx.conditions?.desktop);
      const mult = document.querySelector<HTMLElement>('[data-mult]');
      const counter = { value: 1 };

      const tl = gsap.timeline({
        scrollTrigger: isDesktop
          ? { trigger: '.record', start: 'top top', end: '+=120%', scrub: 1, pin: '.record__pin', anticipatePin: 1 }
          : { trigger: '.bench', start: 'top 75%', once: true },
        defaults: { ease: 'power2.out' },
      });

      tl.from('.bench', { autoAlpha: 0, y: 40, duration: 0.6 }, 0)
        .to('.bench__fill--before', { scaleX: 1, duration: 0.9, ease: 'power1.inOut' }, 0.2)
        .to('.bench__v--before', { opacity: 1, duration: 0.3 }, 0.9)
        .to('.bench__fill--after', { scaleX: 1, duration: 0.25 }, 1.2)
        .to('.bench__v--after', { opacity: 1, duration: 0.3 }, 1.3)
        .to(
          counter,
          {
            value: 14,
            duration: 1.2,
            ease: 'power2.inOut',
            onUpdate: () => {
              if (mult) {
                mult.textContent = String(Math.round(counter.value));
              }
            },
          },
          1.0,
        )
        .to('.bench__meta li', { opacity: 1, y: 0, stagger: 0.15, duration: 0.5 }, 1.9);
    },
  );
}

/**
 * Reveals each project block and adds a light parallax on its media panel.
 */
export function worksReveal(): void {
  for (const work of document.querySelectorAll<HTMLElement>('.work')) {
    const media = work.querySelector<HTMLElement>('.work__media');
    const body = work.querySelectorAll<HTMLElement>('.work__body > *');
    const tl = gsap.timeline({
      scrollTrigger: { trigger: work, start: 'top 80%', once: true },
      defaults: { ease: 'power3.out' },
    });
    tl.from(media, { autoAlpha: 0, y: 40, scale: 0.96, duration: 1.1 }, 0).from(
      body,
      { autoAlpha: 0, y: 24, duration: 0.9, stagger: 0.07 },
      0.15,
    );
    if (media) {
      gsap.to(media, {
        yPercent: -6,
        ease: 'none',
        scrollTrigger: { trigger: work, start: 'top bottom', end: 'bottom top', scrub: true },
      });
    }
  }
}

/**
 * Registers the generic scroll reveals: rows, timeline, laurels, marquee.
 */
export function sectionReveals(): void {
  for (const el of gsap.utils.toArray<HTMLElement>('.craft__row, .method__item, .tl, .laurel, .contact__mail, .contact__links, .works__more')) {
    gsap.from(el, {
      y: 36,
      autoAlpha: 0,
      duration: 1,
      ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 90%', once: true },
    });
  }

  gsap.fromTo(
    '.timeline__progress',
    { scaleY: 0 },
    { scaleY: 1, ease: 'none', scrollTrigger: { trigger: '.timeline', start: 'top 62%', end: 'bottom 62%', scrub: 0.6 } },
  );

  for (const item of document.querySelectorAll<HTMLElement>('.tl')) {
    ScrollTrigger.create({
      trigger: item,
      start: 'top 62%',
      onEnter: () => item.classList.add('is-lit'),
      onLeaveBack: () => item.classList.remove('is-lit'),
    });
  }

  ScrollTrigger.create({
    trigger: '.laurels',
    start: 'top 78%',
    onEnter: () => {
      for (const el of document.querySelectorAll<HTMLElement>('.laurel')) {
        el.classList.add('is-lit');
      }
    },
  });

  gsap.from('.marquee__track span, .marquee__track i', {
    autoAlpha: 0,
    duration: 0.6,
    stagger: 0.02,
    scrollTrigger: { trigger: '.marquee', start: 'top 95%', once: true },
  });
}

/**
 * Runs the stack marquee and speeds it up with scroll velocity while it is visible.
 */
export function marquee(): void {
  const track = document.querySelector<HTMLElement>('.marquee__track');
  if (!track) {
    return;
  }
  const half = track.scrollWidth / 2;
  const tween = gsap.to(track, { x: -half, duration: 38, ease: 'none', repeat: -1 });

  ScrollTrigger.create({
    trigger: '.marquee',
    start: 'top bottom',
    end: 'bottom top',
    onUpdate: (self) => {
      const v = Math.abs(self.getVelocity()) / 1200;
      gsap.to(tween, { timeScale: 1 + Math.min(v, 4), duration: 0.3, overwrite: true });
    },
    onLeave: () => tween.pause(),
    onEnterBack: () => tween.play(),
    onLeaveBack: () => tween.pause(),
    onEnter: () => tween.play(),
  });
  tween.pause();
}

/**
 * Recomputes every ScrollTrigger position (after layout changes).
 */
export function refresh(): void {
  ScrollTrigger.refresh();
}
