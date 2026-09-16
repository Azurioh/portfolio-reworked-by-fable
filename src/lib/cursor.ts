import { gsap } from 'gsap';

const LABELS: Record<string, string> = {
  drag: 'Voir',
  expand: 'Lire',
  link: '',
};

/**
 * Mounts the custom cursor and the magnetic buttons on fine-pointer devices only.
 */
export function createCursor(): void {
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const root = document.querySelector<HTMLElement>('.cursor');
  if (!finePointer || !root) {
    return;
  }

  const ring = root.querySelector<HTMLElement>('.cursor__ring');
  if (!ring) {
    return;
  }

  const dotX = gsap.quickTo(root, 'x', { duration: 0.12, ease: 'power3.out' });
  const dotY = gsap.quickTo(root, 'y', { duration: 0.12, ease: 'power3.out' });
  const ringX = gsap.quickTo(ring, 'x', { duration: 0.42, ease: 'power3.out' });
  const ringY = gsap.quickTo(ring, 'y', { duration: 0.42, ease: 'power3.out' });

  root.classList.add('is-hidden');

  window.addEventListener(
    'pointermove',
    (e) => {
      root.classList.remove('is-hidden');
      dotX(e.clientX);
      dotY(e.clientY);
      ringX(0);
      ringY(0);
    },
    { passive: true },
  );

  document.addEventListener('mouseleave', () => root.classList.add('is-hidden'));
  document.addEventListener('mouseenter', () => root.classList.remove('is-hidden'));

  document.addEventListener('pointerover', (e) => {
    const target = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-cursor]');
    root.classList.remove('is-link', 'is-drag', 'is-expand');
    if (!target) {
      ring.removeAttribute('data-label');
      return;
    }
    const kind = target.dataset.cursor ?? 'link';
    root.classList.add(`is-${kind}`);
    ring.setAttribute('data-label', LABELS[kind] ?? '');
  });

  // Magnetic buttons
  for (const el of document.querySelectorAll<HTMLElement>('[data-magnetic]')) {
    const mx = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3.out' });
    const my = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3.out' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      mx((e.clientX - (r.left + r.width / 2)) * 0.25);
      my((e.clientY - (r.top + r.height / 2)) * 0.25);
    });
    el.addEventListener('pointerleave', () => {
      mx(0);
      my(0);
    });
  }
}
