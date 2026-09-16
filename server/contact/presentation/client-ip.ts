/**
 * Resolves the client IP from reverse-proxy headers: first `x-forwarded-for`
 * entry, then `x-real-ip`. Returns `null` when neither header is present.
 */
export const resolveClientIp = (params: { forwardedFor: string | undefined; realIp: string | undefined }): string | null => {
  const forwarded = params.forwardedFor?.split(',')[0]?.trim();
  if (forwarded) {
    return forwarded;
  }
  const real = params.realIp?.trim();
  if (real) {
    return real;
  }
  return null;
};
