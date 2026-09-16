# Alan Cunin — portfolio

Immersive single-page portfolio. Vanilla TypeScript, Vite, GSAP (ScrollTrigger, SplitText) and Lenis, plus a small Hono server that serves the built site and forwards contact-form messages to a Discord webhook.

## Scripts

```bash
pnpm install
cp .env.example .env   # then fill DISCORD_WEBHOOK_URL
pnpm dev               # Vite on http://localhost:5173 (proxies /api → :8787)
pnpm dev:server        # Hono API on http://localhost:8787, in a second terminal
pnpm build             # type-check + build the site in dist/ and the server in dist-server/
pnpm test              # vitest (i18n rendering, dictionary parity, runtime strings)
pnpm start             # serve dist/ and /api/contact from dist-server/ (needs the env vars)
pnpm preview           # Vite preview of dist/ only (no API)
pnpm fonts             # regenerate public/fonts/ and src/fonts.css (committed); needs macOS for the Menlo fallback metrics
```

## Environment

| Variable | Scope | Required | Purpose |
|---|---|---|---|
| `DISCORD_WEBHOOK_URL` | server | yes | Discord → Server settings → Integrations → Webhooks. Messages land there as embeds. |
| `PORT` | server | no (8787) | HTTP port. |
| `STATIC_DIR` | server | no (`dist`) | Directory of the built site served next to the API. |
| `VITE_CONTACT_ENDPOINT` | client | no | Absolute URL of another endpoint accepting the same JSON POST; defaults to same-origin `/api/contact`. |

The server fails fast at boot when `DISCORD_WEBHOOK_URL` is missing or invalid.

## Contact API

`POST /api/contact` with `Content-Type: application/json` and `{ name, email, subject, message, website }` (`website` is the honeypot, left empty by humans). Answers `{ ok: true }` or `{ ok: false, code, message }` with `400` (validation), `415` (not JSON), `429` (more than 5 messages per hour per IP, read from `x-forwarded-for` / `x-real-ip`) or `502` (Discord unreachable). The browser falls back to a prefilled `mailto:` when delivery fails.

## Deploy on Dokploy

1. Create an application from this repository with the **Dockerfile** build type (multi-stage, `node:22-alpine`, non-root, healthcheck on `GET /`).
2. Add `DISCORD_WEBHOOK_URL` as a secret environment variable. `PORT` and `STATIC_DIR` already default to `8787` and `dist` in the image.
3. Expose container port `8787` behind Traefik; the rate limiter trusts the first `x-forwarded-for` entry set by the proxy.

The Hono handler (`server/app.ts` and `server/contact/`) only uses Web-standard APIs; only `server/index.ts` (`@hono/node-server`) and the static file middleware are Node-specific, so the API can move to Cloudflare Workers or Vercel by swapping that entry point.

## Structure

- `index.html` — locale-agnostic template of the whole page (sections are "planches" I → VI). Every visible string, `alt`, `aria-label`, `placeholder` and head tag is a `{{ section.key }}` placeholder; `{{ meta.lang }}`, `{{ meta.url }}`, `{{ meta.ogLocale }}`, `{{ meta.alternateLinks }}`, `{{ meta.image }}` and the language switcher (`{{ meta.alternate.path }}`, `.htmlLang`, `.ogLocale`, `.label`) come from the locale config.
- `src/locales/index.ts` — locale list (`code`, public `path`, `htmlLang`, `ogLocale`), `LocaleCode`, `defaultLocale` and `SITE_URL`.
- `src/locales/<code>/page.json` — one dictionary per locale, nested by section (`nav`, `hero`, `record`, …), values are trusted HTML (`<em>`, `&nbsp;` allowed). Rendered at build time only, never bundled in the client.
- `src/locales/<code>/runtime.json` — flat dictionary of the strings set from TypeScript (menu and pause `aria-label`s, form validation and status messages, terminal fallbacks, local-time label). `{name}` placeholders are filled by `translate()`. Bundled in the client (small).
- `src/lib/i18n.ts` — `getLocale()` reads `<html lang>` (unknown values fall back to `fr`), `t(key)` / `translate({ key, vars })` read the runtime dictionary. Keys are typed from the French file.
- `src/lib/contact-issues.ts` — maps a locale-neutral issue of the shared Zod schema (`path` + `code` + bounds) to a runtime key.
- `vite/i18n-html.ts` — Vite plugin that renders the template once per locale that has a dictionary: `/` → `dist/index.html`, `/<code>/` → `dist/<code>/index.html`, same hashed assets. In dev, `/` and `/<code>/` are rendered on the fly. A missing key, a leftover `{{` or a locale with no alternate to link to fails the build. Unit tests in `vite/i18n-html.test.ts`, dictionary parity in `src/locales/locales.test.ts` (`pnpm test`).
- `src/style.css` — design tokens, layout, responsive rules, reduced-motion fallbacks.
- `src/main.ts` — boot sequence (intro, smooth scroll, scenes).
- `src/lib/smooth.ts` — Lenis + GSAP ticker sync.
- `src/lib/animations.ts` — hero reveal, record scene, horizontal gallery, orb journey, reveals.
- `src/lib/sky.ts` — canvas star field with parallax and meteors.
- `src/lib/cursor.ts` — custom cursor and magnetic buttons (fine pointers only).
- `src/lib/ui.ts` — mobile menu, anchors, testimonials rotation, local time.
- `src/lib/contact.ts` — contact form: inline validation, honeypot, POST to `/api/contact`, mailto fallback.
- `src/shared/contact/` — Zod schema shared by the browser and the server (`#shared/*` import alias).
- `server/` — Hono server (`#server/*` alias): `env.ts` (the only reader of `process.env`), `app.ts` (composition), `contact/` split into `domain/`, `application/`, `infrastructure/`, `presentation/`.
- `public/img/` — optimised WebP assets; `public/cv.pdf`.

## Locales

`/` is French, `/en/` is English; both share the section ids, the assets and `/cv.pdf`. The switcher link (`.nav__lang`, in the header and in the mobile menu) points to the other locale and carries `hreflang`/`lang` plus an `aria-label` in the target language (`nav.langLabel`).

To edit a translation, change the value in `src/locales/<code>/page.json` (page content) or `src/locales/<code>/runtime.json` (strings set from TypeScript). Keep the key set identical across locales: `pnpm test` fails on a missing or extra key, on a non-string leaf and on a `{variable}` mismatch.

To add a locale:

1. Append `{ code, path: '/<code>/', htmlLang, ogLocale }` to `locales` in `src/locales/index.ts` and extend the `LocaleCode` union.
2. Copy `src/locales/fr/page.json` and `src/locales/fr/runtime.json` to `src/locales/<code>/` and translate every value (same keys, same `<em>`/`<b>` emphasis, no French `&nbsp;` before `?`/`:`/`!` where the target language has no such rule).
3. Register the runtime file in `dictionaries` in `src/lib/i18n.ts` (the type-check fails until every `LocaleCode` has one).
4. `pnpm build` emits `dist/<code>/index.html`; the switcher links to the first other locale, so with three or more locales replace it with a list built from `meta.alternates`.

## SEO

- Each page declares one `<link rel="canonical">` equal to its own URL, `hreflang` links for `fr`, `en` and `x-default` (the site root), `og:url` / `og:locale` / `og:locale:alternate`, Twitter card tags and the `robots` meta; all rendered from `meta.*` by the Vite plugin.
- The JSON-LD graph (`Person` + `WebSite` + `ProfilePage`) is built by `vite/json-ld.ts` with `JSON.stringify` (`<` escaped so no value can close the script) and rendered through `{{ meta.jsonLd }}`; `jobTitle` and `description` come from `head.*` in the dictionary, `inLanguage` and the page URL from the locale.
- `public/robots.txt` (blocks `/api/`, points to the sitemap), `public/sitemap.xml` (both locale URLs with `xhtml:link` alternates) and `public/manifest.webmanifest` are static. Update the sitemap by hand when a locale is added.
- The email address in the mobile menu is wrapped in `<!--email_off-->` … `<!--/email_off-->` so Cloudflare's Email Address Obfuscation leaves it alone and stops injecting `email-decode.min.js`. Keep the wrapper on any new occurrence in the body; `<head>` and `<script>` contents are never rewritten. The `mailto:` fallback of the contact form is built in JavaScript and needs no guard.

## Content sources

Personal portfolio: facts come from alancunin.fr, the CV, the GitHub profile (azurioh) and the Epitech article about the AWS Clash of Agents 2026. The freelance activity (azu-dev.fr) is only linked from the contact section.
