/**
 * Generates all raster image assets for the portfolio from their source files:
 *   - Responsive portrait WebP variants (public/img/portrait-{320,480,640,960}.webp)
 *   - The Open Graph share image (public/img/og.jpg)
 *   - App/browser icons derived from public/favicon.svg (apple-touch-icon.png,
 *     icon-192.png, icon-512.png, favicon.ico)
 *
 * Run with: pnpm images
 *
 * The script is idempotent: sharp's encoders are deterministic for a given
 * input and option set, so re-running it regenerates byte-identical output.
 *
 * NOTE: the OG image text uses `Georgia, serif` instead of the self-hosted
 * Fraunces font. sharp rasterises SVG text through librsvg, which resolves
 * `font-family` against the host's installed system fonts, not the site's
 * web fonts under public/fonts/ — a self-hosted `@font-face` is invisible to
 * it. Georgia is a serif that ships on every supported platform, so it is
 * the closest stand-in available to the rasteriser.
 */
import { existsSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { ImageBuildError } from './errors/image-build.error.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const PUBLIC = resolve(ROOT, 'public');
const IMG = resolve(PUBLIC, 'img');

const PORTRAIT_SOURCE = resolve(IMG, 'portrait.webp');
const FAVICON_SOURCE = resolve(PUBLIC, 'favicon.svg');
const FAVICON_VIEWBOX_SIZE = 64;
const BASE_SVG_DENSITY = 72;

const BACKGROUND = '#0a0e1a';
const ACCENT = '#6ee7f9';
const TEXT_PRIMARY = '#eef2ff';

const PORTRAIT_WIDTHS = [320, 480, 640, 960] as const;

function logOutput(path: string): void {
  const { size } = statSync(path);
  console.log(`  wrote ${path.replace(`${ROOT}/`, '')} (${size} bytes)`);
}

async function generatePortraitVariants(): Promise<void> {
  console.log('Generating responsive portrait variants...');
  for (const width of PORTRAIT_WIDTHS) {
    const outPath = resolve(IMG, `portrait-${width}.webp`);
    await sharp(PORTRAIT_SOURCE)
      .resize(width, width, { fit: 'cover' })
      .webp({ quality: 82, effort: 6 })
      .toFile(outPath);
    logOutput(outPath);
  }
}

async function generateOgImage(): Promise<void> {
  console.log('Generating OG image...');

  const canvasWidth = 1200;
  const canvasHeight = 630;
  const portraitDiameter = 470;
  const portraitRadius = portraitDiameter / 2;
  const portraitRightMargin = 60;
  // Centered vertically, within the right third of the canvas. Offset from
  // the canvas edge by a fixed margin so the full circle stays on-canvas
  // instead of being clipped by the right edge.
  const portraitCenterX = canvasWidth - portraitRightMargin - portraitRadius;
  const portraitCenterY = canvasHeight / 2;
  const portraitLeft = Math.round(portraitCenterX - portraitRadius);
  const portraitTop = Math.round(portraitCenterY - portraitRadius);

  const circleMaskSvg = `<svg width="${portraitDiameter}" height="${portraitDiameter}" xmlns="http://www.w3.org/2000/svg"><circle cx="${portraitRadius}" cy="${portraitRadius}" r="${portraitRadius}" fill="#fff"/></svg>`;

  const circularPortrait = await sharp(
    await sharp(PORTRAIT_SOURCE)
      .resize(portraitDiameter, portraitDiameter, { fit: 'cover' })
      .ensureAlpha()
      .toBuffer(),
  )
    .composite([{ input: Buffer.from(circleMaskSvg), blend: 'dest-in' }])
    .png()
    .toBuffer();

  const textSvg = `<svg width="${canvasWidth}" height="${canvasHeight}" xmlns="http://www.w3.org/2000/svg">
  <text x="80" y="300" font-family="Georgia, serif" font-size="92" font-weight="700" fill="${TEXT_PRIMARY}">Alan Cunin</text>
  <text x="80" y="356" font-family="Georgia, serif" font-size="30" fill="${ACCENT}">Epitech &#183; Cloud &amp; DevOps &#183; Hackathons</text>
</svg>`;

  const outPath = resolve(IMG, 'og.jpg');
  await sharp({
    create: {
      width: canvasWidth,
      height: canvasHeight,
      channels: 3,
      background: BACKGROUND,
    },
  })
    .composite([
      { input: circularPortrait, left: portraitLeft, top: portraitTop },
      { input: Buffer.from(textSvg), left: 0, top: 0 },
    ])
    .jpeg({ quality: 85, progressive: true })
    .toFile(outPath);
  logOutput(outPath);
}

async function rasterizeFavicon(size: number): Promise<Buffer> {
  const density = BASE_SVG_DENSITY * (size / FAVICON_VIEWBOX_SIZE);
  return sharp(FAVICON_SOURCE, { density })
    .resize(size, size, { fit: 'cover' })
    .flatten({ background: BACKGROUND })
    .png()
    .toBuffer();
}

function buildIco(pngBuffer: Buffer, size: number): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: 1 = icon
  header.writeUInt16LE(1, 4); // image count

  const entry = Buffer.alloc(16);
  entry.writeUInt8(size, 0); // width
  entry.writeUInt8(size, 1); // height
  entry.writeUInt8(0, 2); // colour palette size (0 = no palette)
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // colour planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(pngBuffer.length, 8); // image data size
  entry.writeUInt32LE(header.length + entry.length, 12); // offset to image data

  return Buffer.concat([header, entry, pngBuffer]);
}

async function generateIcons(): Promise<void> {
  console.log('Generating icons...');

  const appleTouchIcon = await rasterizeFavicon(180);
  const appleTouchIconPath = resolve(PUBLIC, 'apple-touch-icon.png');
  writeFileSync(appleTouchIconPath, appleTouchIcon);
  logOutput(appleTouchIconPath);

  const icon192 = await rasterizeFavicon(192);
  const icon192Path = resolve(PUBLIC, 'icon-192.png');
  writeFileSync(icon192Path, icon192);
  logOutput(icon192Path);

  const icon512 = await rasterizeFavicon(512);
  const icon512Path = resolve(PUBLIC, 'icon-512.png');
  writeFileSync(icon512Path, icon512);
  logOutput(icon512Path);

  const favicon32 = await rasterizeFavicon(32);
  const favicon = buildIco(favicon32, 32);
  const faviconPath = resolve(PUBLIC, 'favicon.ico');
  writeFileSync(faviconPath, favicon);
  logOutput(faviconPath);
}

async function main(): Promise<void> {
  // Ensure the portrait source exists before doing any work.
  if (!existsSync(PORTRAIT_SOURCE)) {
    throw new ImageBuildError({ message: `portrait source not found: ${PORTRAIT_SOURCE}` });
  }

  await generatePortraitVariants();
  await generateOgImage();
  await generateIcons();

  console.log('Done.');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
