import type { MiddlewareHandler } from 'hono';
import { secureHeaders } from 'hono/secure-headers';

const ONE_YEAR_SECONDS = 31536000;
const STRICT_TRANSPORT_SECURITY = `max-age=${ONE_YEAR_SECONDS}; includeSubDomains`;
const REFERRER_POLICY = 'strict-origin-when-cross-origin';
const GITHUB_API_ORIGIN = 'https://api.github.com';

/**
 * Hardened response headers for the whole origin. Scripts stay strict (`'self'` only);
 * `'unsafe-inline'` is granted to styles because the page ships an inline critical `<style>`
 * and GSAP writes inline `style` attributes. `connect-src` allows the GitHub API the client
 * queries; an external `VITE_CONTACT_ENDPOINT` origin has to be added there too.
 * @returns The Hono middleware.
 */
export const securityHeaders = (): MiddlewareHandler =>
  secureHeaders({
    strictTransportSecurity: STRICT_TRANSPORT_SECURITY,
    referrerPolicy: REFERRER_POLICY,
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      fontSrc: ["'self'"],
      connectSrc: ["'self'", GITHUB_API_ORIGIN],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: [],
    },
    permissionsPolicy: { camera: [], microphone: [], geolocation: [], payment: [], usb: [] },
  });
