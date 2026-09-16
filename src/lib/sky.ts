type Node = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  depth: number;
  accent: boolean;
};

export type Sky = {
  setScroll: (y: number) => void;
};

const LINK_DISTANCE = 130;
const POINTER_DISTANCE = 190;
const NODE_AREA = 16000;
const DRIFT = 0.012;

/**
 * Starts the ambient network canvas: drifting nodes linked when close,
 * with a light parallax on scroll and links drawn towards the pointer.
 * @param canvas - Full-screen canvas to draw into.
 * @param reduced - When true, draws one static frame without motion.
 * @returns Handle used to feed the current scroll offset for parallax.
 */
export function createSky(canvas: HTMLCanvasElement, reduced: boolean): Sky {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { setScroll: () => undefined };
  }

  let width = 0;
  let height = 0;
  let scrollY = 0;
  let nodes: Node[] = [];
  const pointer = { x: -9999, y: -9999 };

  const seed = (): void => {
    const count = Math.round((width * height) / NODE_AREA);
    nodes = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * DRIFT,
      vy: (Math.random() - 0.5) * DRIFT,
      r: Math.random() * 1.2 + 0.6,
      depth: 0.3 + Math.random() * 0.7,
      accent: Math.random() < 0.18,
    }));
  };

  const resize = (): void => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seed();
  };

  const screenY = (n: Node): number => {
    const shifted = (n.y - scrollY * n.depth * 0.18) % height;
    return shifted < 0 ? shifted + height : shifted;
  };

  const draw = (): void => {
    ctx.clearRect(0, 0, width, height);
    const positions = nodes.map((n) => ({ x: n.x, y: screenY(n), n }));

    ctx.lineWidth = 1;
    for (let i = 0; i < positions.length; i += 1) {
      const a = positions[i];
      for (let j = i + 1; j < positions.length; j += 1) {
        const b = positions[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d = Math.hypot(dx, dy);
        if (d < LINK_DISTANCE) {
          const alpha = (1 - d / LINK_DISTANCE) * 0.16 * Math.min(a.n.depth, b.n.depth);
          ctx.strokeStyle = `rgba(238,242,255,${alpha})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
      const pd = Math.hypot(a.x - pointer.x, a.y - pointer.y);
      if (pd < POINTER_DISTANCE) {
        const alpha = (1 - pd / POINTER_DISTANCE) * 0.5;
        ctx.strokeStyle = `rgba(110,231,249,${alpha})`;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(pointer.x, pointer.y);
        ctx.stroke();
      }
    }

    for (const p of positions) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.n.r, 0, Math.PI * 2);
      const alpha = 0.35 + p.n.depth * 0.5;
      ctx.fillStyle = p.n.accent ? `rgba(110,231,249,${alpha})` : `rgba(238,242,255,${alpha * 0.8})`;
      ctx.fill();
    }
  };

  let last = performance.now();
  const frame = (now: number): void => {
    const dt = Math.min(now - last, 50);
    last = now;
    for (const n of nodes) {
      n.x = (n.x + n.vx * dt + width) % width;
      n.y = (n.y + n.vy * dt + height) % height;
    }
    draw();
    requestAnimationFrame(frame);
  };

  resize();
  window.addEventListener('resize', resize, { passive: true });

  if (reduced) {
    draw();
    return {
      setScroll: (y) => {
        scrollY = y;
        draw();
      },
    };
  }

  window.addEventListener(
    'pointermove',
    (e) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
    },
    { passive: true },
  );
  window.addEventListener('pointerleave', () => {
    pointer.x = -9999;
    pointer.y = -9999;
  });

  requestAnimationFrame(frame);
  return {
    setScroll: (y) => {
      scrollY = y;
    },
  };
}
