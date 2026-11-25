import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db } from "@/db";
import { account, session, user, verification } from "@/db/schema";

const secret = process.env.BETTER_AUTH_SECRET;
if (!secret || secret.length < 32) throw new Error("BETTER_AUTH_SECRET must be configured with at least 32 characters.");

const deploymentOrigin = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined;
const trustedOrigins = Array.from(new Set([
  process.env.NEXT_PUBLIC_APP_URL,
  process.env.BETTER_AUTH_URL,
  deploymentOrigin,
  "http://localhost:3000",
].filter((origin): origin is string => Boolean(origin))));

export const auth = betterAuth({
  appName: "INSIGHT",
  baseURL: process.env.BETTER_AUTH_URL || deploymentOrigin || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  secret,
  database: drizzleAdapter(db, { provider: "pg", schema: { user, session, account, verification } }),
  emailAndPassword: { enabled: true, minPasswordLength: 10, maxPasswordLength: 128, autoSignIn: true },
  advanced: { cookiePrefix: "insight", useSecureCookies: process.env.NODE_ENV === "production" },
  trustedOrigins,
  rateLimit: { enabled: true, window: 60, max: 30 },
});
