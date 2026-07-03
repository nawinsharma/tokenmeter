// Central env access. Next auto-loads .env.local for the app runtime.
// Standalone scripts (seed, drizzle) call loadEnv() first.
export function loadEnv() {
  if (!process.env.DATABASE_URL) {
    try {
      // Node >= 20.6 built-in .env loader; no dotenv dependency needed.
      process.loadEnvFile(".env.local");
    } catch {
      // ignore — env may already be provided by the platform
    }
  }
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const env = {
  get databaseUrl() {
    return required("DATABASE_URL");
  },
  get masterEncryptionKey() {
    return required("MASTER_ENCRYPTION_KEY");
  },
  get sessionSecret() {
    return required("SESSION_SECRET");
  },
  get anthropicBaseUrl() {
    return "https://api.anthropic.com";
  },
};
