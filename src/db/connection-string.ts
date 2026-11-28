const LEGACY_SSL_MODE = /([?&]sslmode=)(prefer|require|verify-ca)(?=(&|#|$)/i;

/**
 * Make pg-connection-string's current TLS behavior explicit.
 *
 * Recent pg-connection-string versions interpret these legacy libpq modes as
 * verify-full and warn that a future major version will use weaker libpq
 * semantics for them. Keeping verify-full explicit preserves today's strict
 * certificate and hostname verification across dependency upgrades.
 */
export function enforceVerifyFullSslMode(
  connectionString: string | undefined,
): string | undefined {
  if (!connectionString) return connectionString;
  return connectionString.replace(LEGACY_SSL_MODE, "$1verify-full");
}
