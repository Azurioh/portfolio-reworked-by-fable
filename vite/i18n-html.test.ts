import { describe, expect, it } from 'vitest';
import { locales, SITE_URL } from '../src/locales/index.ts';
import { buildMeta, renderTemplate } from './i18n-html.ts';

describe('renderTemplate', () => {
  it('renders nested keys, with or without whitespace inside the braces', () => {
    const html = renderTemplate('<title>{{ head.title }}</title><p>{{nav.items.record}}</p>', {
      head: { title: 'Alan' },
      nav: { items: { record: 'Le record' } },
    });

    expect(html).toBe('<title>Alan</title><p>Le record</p>');
  });

  it('indexes arrays through numeric path segments', () => {
    const html = renderTemplate('<li>{{ pieces.items.1.title }}</li>', {
      pieces: { items: [{ title: 'VisiSurg' }, { title: 'ccprofile' }] },
    });

    expect(html).toBe('<li>ccprofile</li>');
  });

  it('renders inline HTML values verbatim', () => {
    const value = 'On se <em>parle</em>&nbsp;? Métal &amp; rock <b>2 min 20</b>';
    const html = renderTemplate('<h2>{{ contact.title }}</h2>', { contact: { title: value } });

    expect(html).toBe(`<h2>${value}</h2>`);
  });

  it('throws an error naming the key when it is missing', () => {
    expect(() => renderTemplate('<p>{{ hero.role }}</p>', { hero: {} })).toThrow(/hero\.role/);
  });

  it('throws when a key resolves to something that is not a string', () => {
    expect(() => renderTemplate('<p>{{ hero }}</p>', { hero: { role: 'x' } })).toThrow(/hero/);
  });

  it('throws when a placeholder survives rendering', () => {
    expect(() => renderTemplate('<p>{{ not a key }}</p>', {})).toThrow(/\{\{/);
  });
});

describe('buildMeta', () => {
  const [fr, en] = locales;

  it('resolves meta.url and meta.lang for the default locale', () => {
    const meta = buildMeta({ locale: fr, available: locales });

    expect(meta.url).toBe(`${SITE_URL}/`);
    expect(meta.lang).toBe('fr');
    expect(meta.ogLocale).toBe('fr_FR');
    expect(meta.path).toBe('/');
  });

  it('resolves meta.url for a prefixed locale', () => {
    const meta = buildMeta({ locale: en, available: locales });

    expect(meta.url).toBe(`${SITE_URL}/en/`);
    expect(meta.lang).toBe('en');
  });

  it('lists the other available locales as alternates, with an upper-case label', () => {
    expect(buildMeta({ locale: fr, available: locales }).alternates).toEqual([
      { code: 'en', htmlLang: 'en', path: '/en/', url: `${SITE_URL}/en/`, label: 'EN' },
    ]);
  });

  it('exposes the first alternate as the language switcher target', () => {
    expect(buildMeta({ locale: fr, available: locales }).alternate).toMatchObject({ path: '/en/', label: 'EN' });
    expect(buildMeta({ locale: en, available: locales }).alternate).toMatchObject({ path: '/', label: 'FR' });
  });

  it('throws when the page has no alternate locale to link to', () => {
    expect(() => buildMeta({ locale: fr, available: [fr] })).toThrow(/alternate locale/);
  });

  it('renders meta values through the template', () => {
    const html = renderTemplate('<html lang="{{ meta.lang }}"><a href="{{ meta.url }}">', {
      meta: buildMeta({ locale: en, available: locales }),
    });

    expect(html).toBe(`<html lang="en"><a href="${SITE_URL}/en/">`);
  });
});
