import { afterEach, describe, expect, it, vi } from 'vitest';
import en from '../locales/en/runtime.json';
import fr from '../locales/fr/runtime.json';
import { getLocale, t, translate } from './i18n';

const stubHtmlLang = (lang: string): void => {
  vi.stubGlobal('document', { documentElement: { lang } });
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getLocale', () => {
  it('reads the locale from <html lang>', () => {
    stubHtmlLang('en');
    expect(getLocale()).toBe('en');
  });

  it('falls back to the default locale when <html lang> is unknown or empty', () => {
    stubHtmlLang('de');
    expect(getLocale()).toBe('fr');
    stubHtmlLang('');
    expect(getLocale()).toBe('fr');
  });
});

describe('t', () => {
  it('returns the string of the current locale', () => {
    stubHtmlLang('en');
    expect(t('menu.open')).toBe(en['menu.open']);
  });

  it('falls back to the French string on an unknown locale', () => {
    stubHtmlLang('de');
    expect(t('menu.open')).toBe(fr['menu.open']);
  });

  it('leaves placeholders verbatim', () => {
    stubHtmlLang('en');
    expect(t('footer.localTime')).toBe('Besançon, {time}');
  });
});

describe('translate', () => {
  it('interpolates {name} variables and leaves unknown ones untouched', () => {
    stubHtmlLang('en');
    expect(translate({ key: 'footer.localTime', vars: { time: '20:05' } })).toBe('Besançon, 20:05');
    expect(translate({ key: 'footer.localTime', vars: { other: 'x' } })).toBe('Besançon, {time}');
  });
});
