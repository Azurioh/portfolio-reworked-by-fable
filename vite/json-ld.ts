import { z } from 'zod';
import { SITE_URL, type Locale } from '../src/locales/index.ts';

const PERSON_ID = `${SITE_URL}/#person`;
const WEBSITE_ID = `${SITE_URL}/#website`;
const SITE_ROOT_URL = `${SITE_URL}/`;
const PERSON_NAME = 'Alan Cunin';
const PERSON_IMAGE = `${SITE_URL}/img/portrait.webp`;
const PERSON_EMAIL = 'mailto:alancunin@gmail.com';
const SCHOOL = { '@type': 'EducationalOrganization', name: 'Epitech' } as const;
const ADDRESS = { '@type': 'PostalAddress', addressLocality: 'Besançon', addressCountry: 'FR' } as const;
const SAME_AS = [
  'https://github.com/azurioh',
  'https://www.linkedin.com/in/alancunin',
  'https://www.malt.fr/profile/alancunin',
  'https://azu-dev.fr',
] as const;

/** Localized fields the graph reads from the page dictionary. */
const JSON_LD_STRINGS_SCHEMA = z.object({
  head: z.object({
    jobTitle: z.string(),
    description: z.string(),
  }),
});

/**
 * Serializes the structured data of a page: `Person`, `WebSite` and
 * `ProfilePage` in one `@graph`. `<` is escaped so no value can close the
 * `<script>` block, whatever the dictionary contains.
 * @param params.locale - Locale of the page being rendered.
 * @param params.dictionary - Page dictionary providing `head.jobTitle` and `head.description`.
 * @returns JSON text safe to inline in `<script type="application/ld+json">`.
 * @throws {ZodError} When the dictionary lacks one of the localized fields.
 */
export const buildJsonLd = (params: { locale: Locale; dictionary: Record<string, unknown> }): string => {
  const { head } = JSON_LD_STRINGS_SCHEMA.parse(params.dictionary);
  const pageUrl = `${SITE_URL}${params.locale.path}`;
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Person',
        '@id': PERSON_ID,
        name: PERSON_NAME,
        url: SITE_ROOT_URL,
        image: PERSON_IMAGE,
        jobTitle: head.jobTitle,
        description: head.description,
        email: PERSON_EMAIL,
        alumniOf: SCHOOL,
        affiliation: SCHOOL,
        address: ADDRESS,
        sameAs: SAME_AS,
      },
      {
        '@type': 'WebSite',
        '@id': WEBSITE_ID,
        url: SITE_ROOT_URL,
        name: PERSON_NAME,
        inLanguage: params.locale.htmlLang,
        publisher: { '@id': PERSON_ID },
      },
      {
        '@type': 'ProfilePage',
        url: pageUrl,
        inLanguage: params.locale.htmlLang,
        mainEntity: { '@id': PERSON_ID },
      },
    ],
  };
  return JSON.stringify(graph).replaceAll('<', '\\u003c');
};
