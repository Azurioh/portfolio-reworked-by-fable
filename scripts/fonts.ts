/**
 * Self-hosts the portfolio's web fonts and generates `src/fonts.css`:
 *   - Copies the latin-subset variable woff2 files shipped by the
 *     `@fontsource-variable/*` packages into public/fonts/ under stable names.
 *   - Pins Fraunces' `WONK` axis to 0 (the value Google Fonts served the site
 *     with). The fontsource file defaults WONK to 1, which would swap in the
 *     "wonky" leaning h/m/n/s/& forms at display optical sizes.
 *   - Emits one `@font-face` per file plus a metric-adjusted `<Family> Fallback`
 *     face per family (`size-adjust`, `ascent-override`, `descent-override`,
 *     `line-gap-override`) so the swap from the system fallback to the web
 *     font does not shift layout.
 *
 * Run with: pnpm fonts
 *
 * The script is idempotent: the harfbuzz subsetter and the woff2 encoder are
 * deterministic, so re-running it regenerates byte-identical output.
 *
 * Metrics use capsize's frequency-weighted latin `xWidthAvg` everywhere so
 * both sides of each `size-adjust` ratio are comparable:
 *   - Web fonts are measured from the published file with `@capsizecss/unpack`.
 *     Fraunces is measured at the instance the design uses for headings
 *     (opsz 144, wght 300) because its glyphs are ~20% narrower there than at
 *     the text optical size the prebuilt collection was measured at.
 *   - Georgia and Arial come from the prebuilt `@capsizecss/metrics` collection.
 *   - Menlo is not in that collection, so it is unpacked from the macOS system
 *     font.
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import arial from '@capsizecss/metrics/arial';
import georgia from '@capsizecss/metrics/georgia';
import { fromBuffer as unpackBuffer } from '@capsizecss/unpack';
import { fromFile as unpackFile } from '@capsizecss/unpack/fs';
import { create as createFont, type Font, type FontCollection } from 'fontkit';
import subsetFont from 'subset-font';
import { z } from 'zod';
import { FontBuildError } from './errors/font-build.error.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const FONTSOURCE = resolve(ROOT, 'node_modules', '@fontsource-variable');
const OUT_DIR = resolve(ROOT, 'public', 'fonts');
const CSS_OUT = resolve(ROOT, 'src', 'fonts.css');
const PUBLIC_FONT_PATH = '/fonts';

/**
 * macOS-only dependency: Menlo is not part of the `@capsizecss/metrics`
 * collection, so its metrics are unpacked from the system font at this path.
 * The script therefore only runs on macOS; its outputs are committed, so
 * other platforms never need to run it.
 */
const MENLO_SYSTEM_FONT = '/System/Library/Fonts/Menlo.ttc';
const MENLO_POSTSCRIPT_NAME = 'Menlo-Regular';

const LATIN_SUBSET = 'latin';
const WEIGHT_AXIS = 'wght';
const OVERRIDE_DECIMALS = 4;

const UNICODE_RANGES_SCHEMA = z.record(z.string(), z.string());

/** Shape shared by `@capsizecss/metrics` entries and `@capsizecss/unpack` results. */
interface CapsizeMetrics {
  fullName: string;
  postscriptName: string;
  unitsPerEm: number;
  ascent: number;
  descent: number;
  lineGap: number;
  subsets: { latin: { xWidthAvg: number } };
}

interface FontFace {
  /** File name inside the fontsource package's `files/` directory. */
  source: string;
  /** Stable file name written to public/fonts. */
  output: string;
  style: 'normal' | 'italic';
  /** Axes to pin before publishing (partial instancing), if any. */
  pin?: Record<string, number>;
}

type FallbackSource =
  | { kind: 'collection'; metrics: CapsizeMetrics }
  | { kind: 'system'; file: string; postscriptName: string };

interface FontFamily {
  name: string;
  /** Fontsource package directory under node_modules/@fontsource-variable. */
  pkg: string;
  /** The first face is the upright one the family's metrics are measured on. */
  faces: FontFace[];
  /** Variation axes the stylesheet relies on; the build fails if a published file lacks one. */
  requiredAxes: string[];
  /** Axes pinned on a throwaway instance before measuring, so the fallback is tuned to the design's instance. */
  measureAt?: Record<string, number>;
  fallback: FallbackSource;
}

interface BuiltFace {
  face: FontFace;
  buffer: Buffer;
  weightRange: { min: number; max: number };
  axes: string[];
}

function fontsourceFile(params: { pkg: string; file: string }): string {
  return resolve(FONTSOURCE, params.pkg, 'files', params.file);
}

function latinUnicodeRange(pkg: string): string {
  const unicodeJson = resolve(FONTSOURCE, pkg, 'unicode.json');
  const ranges = UNICODE_RANGES_SCHEMA.parse(JSON.parse(readFileSync(unicodeJson, 'utf8')));
  const latin = ranges[LATIN_SUBSET];
  if (latin === undefined) {
    throw new FontBuildError({ message: `no "${LATIN_SUBSET}" range in ${unicodeJson}` });
  }
  return latin;
}

function isCollection(font: Font | FontCollection): font is FontCollection {
  return 'fonts' in font;
}

function loadWebFont(buffer: Buffer): Font {
  const font = createFont(buffer);
  if (isCollection(font)) {
    throw new FontBuildError({ message: 'expected a single font, got a collection' });
  }
  return font;
}

/** Full-coverage subset text: every code point the source file maps, so only the pinned axes change. */
function coverageText(font: Font): string {
  return font.characterSet.map((codePoint) => String.fromCodePoint(codePoint)).join('');
}

async function instance(params: { source: Buffer; axes: Record<string, number>; format: 'woff2' | 'sfnt' }): Promise<Buffer> {
  return subsetFont(params.source, coverageText(loadWebFont(params.source)), {
    targetFormat: params.format,
    variationAxes: params.axes,
  });
}

async function buildFace(params: { pkg: string; face: FontFace }): Promise<BuiltFace> {
  const { pkg, face } = params;
  const source = readFileSync(fontsourceFile({ pkg, file: face.source }));
  const buffer = face.pin === undefined ? source : await instance({ source, axes: face.pin, format: 'woff2' });

  const font = loadWebFont(buffer);
  const wght = font.variationAxes[WEIGHT_AXIS];
  if (wght === undefined) {
    throw new FontBuildError({ message: `${face.source} has no ${WEIGHT_AXIS} axis` });
  }

  const outPath = resolve(OUT_DIR, face.output);
  writeFileSync(outPath, buffer);
  const { size } = statSync(outPath);
  const axes = Object.keys(font.variationAxes);
  console.log(`  wrote public/fonts/${face.output} (${size} bytes) axes: ${axes.join(', ')}`);

  return { face, buffer, weightRange: { min: wght.min, max: wght.max }, axes };
}

function assertRequiredAxes(params: { built: BuiltFace; requiredAxes: string[] }): void {
  const missing = params.requiredAxes.filter((axis) => !params.built.axes.includes(axis));
  if (missing.length > 0) {
    throw new FontBuildError({ message: `${params.built.face.output} is missing required axes: ${missing.join(', ')}` });
  }
}

async function measureWebFont(params: { built: BuiltFace; measureAt: Record<string, number> | undefined }): Promise<CapsizeMetrics> {
  const { built, measureAt } = params;
  const buffer = measureAt === undefined ? built.buffer : await instance({ source: built.buffer, axes: measureAt, format: 'sfnt' });
  return unpackBuffer(buffer);
}

async function resolveFallback(fallback: FallbackSource): Promise<CapsizeMetrics> {
  if (fallback.kind === 'collection') {
    return fallback.metrics;
  }
  if (!existsSync(fallback.file)) {
    throw new FontBuildError({
      message: `system font ${fallback.file} not found; the fallback metrics for ${fallback.postscriptName} are read from the macOS system fonts, so \`pnpm fonts\` must run on macOS`,
    });
  }
  return unpackFile(fallback.file, { postscriptName: fallback.postscriptName });
}

function percent(value: number): string {
  return `${(value * 100).toFixed(OVERRIDE_DECIMALS)}%`;
}

/** `local()` matches a font's full name or PostScript name, never its family name. */
function localSources(font: CapsizeMetrics): string {
  const names = [...new Set([font.fullName, font.postscriptName])];
  return names.map((name) => `local('${name}')`).join(', ');
}

function fallbackFace(params: { family: FontFamily; web: CapsizeMetrics; fallback: CapsizeMetrics }): string {
  const { family, web, fallback } = params;
  const sizeAdjust = web.subsets.latin.xWidthAvg / web.unitsPerEm / (fallback.subsets.latin.xWidthAvg / fallback.unitsPerEm);
  const ascent = web.ascent / web.unitsPerEm / sizeAdjust;
  const descent = Math.abs(web.descent) / web.unitsPerEm / sizeAdjust;
  const lineGap = web.lineGap / web.unitsPerEm / sizeAdjust;

  return [
    `/* ${family.name} → ${fallback.fullName}, metric-adjusted */`,
    '@font-face {',
    `  font-family: '${family.name} Fallback';`,
    `  src: ${localSources(fallback)};`,
    `  size-adjust: ${percent(sizeAdjust)};`,
    `  ascent-override: ${percent(ascent)};`,
    `  descent-override: ${percent(descent)};`,
    `  line-gap-override: ${percent(lineGap)};`,
    '}',
  ].join('\n');
}

function webFace(params: { family: FontFamily; built: BuiltFace; unicodeRange: string }): string {
  const { family, built, unicodeRange } = params;
  return [
    `/* ${built.face.output} */`,
    '@font-face {',
    `  font-family: '${family.name}';`,
    `  font-style: ${built.face.style};`,
    `  font-weight: ${built.weightRange.min} ${built.weightRange.max};`,
    '  font-display: swap;',
    `  src: url('${PUBLIC_FONT_PATH}/${built.face.output}') format('woff2');`,
    `  unicode-range: ${unicodeRange};`,
    '}',
  ].join('\n');
}

const FAMILIES: FontFamily[] = [
  {
    name: 'Fraunces',
    pkg: 'fraunces',
    requiredAxes: ['wght', 'opsz', 'SOFT'],
    // The upright headings (.hero__title, .h2, .work__title, .quote p, .contact__title) render at
    // opsz 144 / wght 300 / SOFT 0; SOFT 100 is only used on the italic accent words. SOFT widens
    // the latin xWidthAvg from 718 to 742 (+3.3%), so the upright fallback is tuned to SOFT 0.
    measureAt: { opsz: 144, wght: 300, SOFT: 0 },
    faces: [
      {
        source: 'fraunces-latin-full-normal.woff2',
        output: 'fraunces-latin-full.woff2',
        style: 'normal',
        pin: { WONK: 0 },
      },
      {
        source: 'fraunces-latin-full-italic.woff2',
        output: 'fraunces-latin-full-italic.woff2',
        style: 'italic',
        pin: { WONK: 0 },
      },
    ],
    fallback: { kind: 'collection', metrics: georgia },
  },
  {
    name: 'Instrument Sans',
    pkg: 'instrument-sans',
    requiredAxes: ['wght'],
    faces: [
      {
        source: 'instrument-sans-latin-wght-normal.woff2',
        output: 'instrument-sans-latin-wght.woff2',
        style: 'normal',
      },
      {
        source: 'instrument-sans-latin-wght-italic.woff2',
        output: 'instrument-sans-latin-wght-italic.woff2',
        style: 'italic',
      },
    ],
    fallback: { kind: 'collection', metrics: arial },
  },
  {
    name: 'JetBrains Mono',
    pkg: 'jetbrains-mono',
    requiredAxes: ['wght'],
    faces: [
      {
        source: 'jetbrains-mono-latin-wght-normal.woff2',
        output: 'jetbrains-mono-latin-wght.woff2',
        style: 'normal',
      },
    ],
    fallback: { kind: 'system', file: MENLO_SYSTEM_FONT, postscriptName: MENLO_POSTSCRIPT_NAME },
  },
];

async function buildFamily(family: FontFamily): Promise<{ css: string[]; bytes: number }> {
  console.log(`Building ${family.name}...`);
  const unicodeRange = latinUnicodeRange(family.pkg);
  const css: string[] = [];
  const builtFaces: BuiltFace[] = [];
  let bytes = 0;

  for (const face of family.faces) {
    const built = await buildFace({ pkg: family.pkg, face });
    assertRequiredAxes({ built, requiredAxes: family.requiredAxes });
    builtFaces.push(built);
    bytes += built.buffer.length;
    css.push(webFace({ family, built, unicodeRange }));
  }

  const [upright] = builtFaces;
  if (upright === undefined) {
    throw new FontBuildError({ message: `${family.name} declares no face` });
  }
  const web = await measureWebFont({ built: upright, measureAt: family.measureAt });
  const fallback = await resolveFallback(family.fallback);
  console.log(`  ${family.name} xWidthAvg ${web.subsets.latin.xWidthAvg}/${web.unitsPerEm}, ${fallback.fullName} ${fallback.subsets.latin.xWidthAvg}/${fallback.unitsPerEm}`);
  css.push(fallbackFace({ family, web, fallback }));

  return { css, bytes };
}

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });

  const blocks: string[] = ['/* Generated by scripts/fonts.ts — run `pnpm fonts` to regenerate. Do not edit by hand. */'];
  let totalBytes = 0;

  for (const family of FAMILIES) {
    const { css, bytes } = await buildFamily(family);
    blocks.push(...css);
    totalBytes += bytes;
  }

  writeFileSync(CSS_OUT, `${blocks.join('\n\n')}\n`);
  console.log('  wrote src/fonts.css');
  console.log(`Total public/fonts size: ${totalBytes} bytes (${(totalBytes / 1024).toFixed(1)} KiB)`);
  console.log('Done.');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
