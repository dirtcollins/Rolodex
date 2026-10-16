import "server-only";

// Every setting Rolodex reads, in one place.
function env(name: string, fallback = ""): string {
  const value = process.env[name];
  return value !== undefined && value !== "" ? value : fallback;
}

export const config = {
  /** Supabase Postgres when set; empty = a local PGlite database in .data (this Mac). */
  databaseUrl: env("DATABASE_URL"),
  /** Its own schema in that database, so Rolodex never mixes with anything else there. */
  schema: env("RX_SCHEMA", "rolodex"),
  /** Signs the sign-in cookie: at least 32 random bytes. A local copy without one gets a key per run. */
  authSecret: env("RX_AUTH_SECRET"),
  /** The first owner, created on first start when there are no users yet. */
  ownerName: env("RX_OWNER_NAME", "Brendan Collins"),
  ownerEmail: env("RX_OWNER_EMAIL", "brendan@collinscrtv.com"),
  ownerPassword: env("RX_OWNER_PASSWORD"),
  /** Resend (send-only email, like Light Ops). Without a key, or with RX_EMAIL_TEST=1, emails go to a test log instead. */
  resendKey: env("RESEND_API_KEY"),
  emailTest: env("RX_EMAIL_TEST") === "1",
  /** On this Mac only: open the app without signing in, as the first owner. */
  noLogin: env("RX_NO_LOGIN") === "1",
};

export const localDb = config.databaseUrl === "";
