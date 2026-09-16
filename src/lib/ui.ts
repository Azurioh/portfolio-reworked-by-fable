import type { LatestCommitResult } from './github';
import type { Smooth } from './smooth';

/**
 * Wires the mobile burger menu (open/close, Escape, anchor navigation).
 * @param smooth - Scroll controller used to lock and scroll the page.
 */
export function setupMenu(smooth: Smooth): void {
  const burger = document.querySelector<HTMLButtonElement>('.nav__burger');
  const menu = document.querySelector<HTMLElement>('#menu');
  if (!burger || !menu) {
    return;
  }

  const setOpen = (open: boolean): void => {
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
    if (open) {
      menu.hidden = false;
      requestAnimationFrame(() => menu.classList.add('is-open'));
      smooth.stop();
    } else {
      menu.classList.remove('is-open');
      window.setTimeout(() => {
        menu.hidden = true;
      }, 350);
      smooth.start();
    }
  };

  burger.addEventListener('click', () => {
    setOpen(burger.getAttribute('aria-expanded') !== 'true');
  });

  for (const a of menu.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')) {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      setOpen(false);
      window.setTimeout(() => smooth.scrollTo(a.getAttribute('href') ?? '#'), 360);
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && burger.getAttribute('aria-expanded') === 'true') {
      setOpen(false);
    }
  });
}

/**
 * Routes in-page anchor clicks through the smooth scroller.
 * @param smooth - Scroll controller.
 */
export function setupAnchors(smooth: Smooth): void {
  for (const a of document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]:not(.menu a)')) {
    a.addEventListener('click', (e) => {
      const href = a.getAttribute('href');
      if (!href || href === '#') {
        return;
      }
      const target = document.querySelector<HTMLElement>(href);
      if (!target) {
        return;
      }
      e.preventDefault();
      smooth.scrollTo(target);
      history.replaceState(null, '', href);
    });
  }
}

const QUOTE_INTERVAL_MS = 8000;

/**
 * Rotates the testimonials: previous / next / pause controls, keyboard arrows,
 * pause on hover and focus, progress bar, auto-pause when the section is off-screen.
 */
export function setupQuotes(): void {
  const wrap = document.querySelector<HTMLElement>('[data-quotes]');
  const ctl = document.querySelector<HTMLElement>('[data-quotes-ctl]');
  if (!wrap || !ctl) {
    return;
  }
  const quotes = Array.from(wrap.querySelectorAll<HTMLElement>('.quote'));
  const prev = ctl.querySelector<HTMLButtonElement>('[data-quotes-prev]');
  const next = ctl.querySelector<HTMLButtonElement>('[data-quotes-next]');
  const toggle = ctl.querySelector<HTMLButtonElement>('[data-quotes-toggle]');
  const current = ctl.querySelector<HTMLElement>('[data-quotes-current]');
  const total = ctl.querySelector<HTMLElement>('[data-quotes-total]');
  const progress = ctl.querySelector<HTMLElement>('[data-quotes-progress]');
  if (!prev || !next || !toggle || !current || !total || !progress) {
    return;
  }

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let index = 0;
  let paused = reduced;
  let hovering = false;
  let visible = true;
  let elapsed = 0;
  let last = 0;
  let raf = 0;

  total.textContent = String(quotes.length);

  const running = (): boolean => !paused && !hovering && visible;

  const render = (): void => {
    for (const [k, q] of quotes.entries()) {
      q.classList.toggle('is-active', k === index);
    }
    current.textContent = String(index + 1);
  };

  const show = (i: number): void => {
    index = (i + quotes.length) % quotes.length;
    elapsed = 0;
    render();
  };

  const tick = (now: number): void => {
    if (running()) {
      elapsed += now - last;
      if (elapsed >= QUOTE_INTERVAL_MS) {
        show(index + 1);
      }
    }
    last = now;
    progress.style.transform = `scaleX(${elapsed / QUOTE_INTERVAL_MS})`;
    raf = requestAnimationFrame(tick);
  };

  const setPaused = (value: boolean): void => {
    paused = value;
    toggle.setAttribute('aria-pressed', String(value));
    toggle.setAttribute('aria-label', value ? 'Reprendre la lecture' : 'Mettre en pause');
  };

  prev.addEventListener('click', () => show(index - 1));
  next.addEventListener('click', () => show(index + 1));
  toggle.addEventListener('click', () => setPaused(!paused));

  const section = wrap.closest('section') ?? wrap;
  section.addEventListener('pointerenter', () => {
    hovering = true;
  });
  section.addEventListener('pointerleave', () => {
    hovering = false;
  });
  section.addEventListener('focusin', () => {
    hovering = true;
  });
  section.addEventListener('focusout', () => {
    hovering = false;
  });
  section.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') {
      show(index - 1);
    } else if (e.key === 'ArrowRight') {
      show(index + 1);
    }
  });

  new IntersectionObserver(
    (entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
    },
    { threshold: 0.2 },
  ).observe(section);

  setPaused(paused);
  render();
  last = performance.now();
  raf = requestAnimationFrame(tick);
  window.addEventListener('pagehide', () => cancelAnimationFrame(raf));
}

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

const formatRelative = (date: Date): string => {
  const diff = Date.now() - date.getTime();
  const rtf = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });
  if (diff < HOUR_MS) {
    return rtf.format(-Math.max(1, Math.round(diff / MINUTE_MS)), 'minute');
  }
  if (diff < DAY_MS) {
    return rtf.format(-Math.round(diff / HOUR_MS), 'hour');
  }
  return rtf.format(-Math.round(diff / DAY_MS), 'day');
};

/**
 * Fills the hero terminal with the latest public GitHub commit.
 * @param params - Result of the GitHub lookup.
 */
export function renderTerminalCommit(params: { result: LatestCommitResult }): void {
  const out = document.querySelector<HTMLElement>('[data-terminal-commit]');
  if (!out) {
    return;
  }
  const { result } = params;
  if (result.status === 'unavailable') {
    out.textContent = 'fatal: api.github.com injoignable · voir github.com/azurioh';
    return;
  }
  if (result.status === 'none') {
    out.textContent = 'aucun push public récent · voir github.com/azurioh';
    return;
  }
  const { commit } = result;
  out.replaceChildren();
  const sha = document.createElement('i');
  sha.className = 'term__sha';
  sha.textContent = commit.shortSha;
  const text = document.createTextNode(` ${commit.subject}  `);
  const meta = document.createElement('span');
  meta.className = 'term__meta';
  meta.textContent = `${commit.repo} · ${formatRelative(commit.date)}`;
  out.append(sha, text, meta);
}

/**
 * Displays and refreshes the local time in Besançon in the footer.
 */
export function setupLocalTime(): void {
  const el = document.querySelector<HTMLElement>('[data-local-time]');
  if (!el) {
    return;
  }
  const fmt = new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Paris',
  });
  const tick = (): void => {
    el.textContent = `Besançon, ${fmt.format(new Date())}`;
  };
  tick();
  window.setInterval(tick, 30_000);
}
