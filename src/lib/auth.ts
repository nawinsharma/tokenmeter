import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db, schema } from "@/db";
import { organizations } from "@/db/schema";

/**
 * Better Auth is the source of truth for authentication (email/password + Google).
 * It owns the `user`/`session`/`account`/`verification` tables. The rest of the app
 * is organization-scoped, so every user carries an `orgId` (an additional field);
 * a fresh organization is created for each new user in the create hook below.
 */
export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,

  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },

  // Let a Google sign-in attach to an existing email/password account (and vice
  // versa) since Google verifies the email it returns.
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google"],
    },
  },

  user: {
    additionalFields: {
      // Server-controlled (input: false) — set by the create hook, never by the client.
      orgId: { type: "string", required: false, input: false },
    },
  },

  databaseHooks: {
    user: {
      create: {
        // Give every new user their own organization and stamp it onto the user row.
        before: async (user) => {
          const [org] = await db
            .insert(organizations)
            .values({ name: `${user.name || user.email}'s workspace` })
            .returning();
          return { data: { ...user, orgId: org.id } };
        },
      },
    },
  },

  plugins: [nextCookies()],
});
