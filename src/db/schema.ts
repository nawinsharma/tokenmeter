import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  integer,
  numeric,
  jsonb,
  customType,
  index,
} from "drizzle-orm/pg-core";

// Raw bytes column (for encrypted key material).
const bytea = customType<{ data: Buffer; default: false }>({
  dataType() {
    return "bytea";
  },
});

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// --- Better Auth tables ---------------------------------------------------
// Better Auth owns these. Column names are snake_case to match the rest of the
// schema; the camelCase JS keys are what the Better Auth drizzle adapter binds to.
// `orgId` is an app-specific additional field — each user belongs to one org.

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// The user's REAL upstream provider key, encrypted at rest (AES-256-GCM envelope).
export const providerKeys = pgTable("provider_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  provider: text("provider").notNull().default("anthropic"),
  label: text("label").notNull(),
  iv: bytea("iv").notNull(), // 12-byte GCM nonce
  ciphertext: bytea("ciphertext").notNull(), // ciphertext || 16-byte auth tag
  keyLast4: text("key_last4").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

// Keys WE issue. Presented as the Authorization on the proxy. We store only a hash.
export const proxyKeys = pgTable(
  "proxy_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    providerKeyId: uuid("provider_key_id")
      .notNull()
      .references(() => providerKeys.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    hash: text("hash").notNull().unique(), // sha256(full key)
    keyLast4: text("key_last4").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [index("proxy_keys_hash_idx").on(t.hash)],
);

// One row per proxied request — the hot table.
export const usageEvents = pgTable(
  "usage_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    proxyKeyId: uuid("proxy_key_id").references(() => proxyKeys.id, {
      onDelete: "set null",
    }),
    provider: text("provider").notNull().default("anthropic"),
    model: text("model").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    cacheCreationInputTokens: integer("cache_creation_input_tokens").notNull().default(0),
    // Cache-creation tokens split by TTL — priced differently (5m = 1.25x, 1h = 2x input).
    // Their sum equals cacheCreationInputTokens; kept separately for exact pricing.
    cacheCreation5mInputTokens: integer("cache_creation_5m_input_tokens").notNull().default(0),
    cacheCreation1hInputTokens: integer("cache_creation_1h_input_tokens").notNull().default(0),
    cacheReadInputTokens: integer("cache_read_input_tokens").notNull().default(0),
    costUsd: numeric("cost_usd", { precision: 20, scale: 10 }).notNull().default("0"),
    pricingVersion: integer("pricing_version"),
    status: text("status").notNull().default("ok"), // ok | error | refusal
    stopReason: text("stop_reason"),
    latencyMs: integer("latency_ms"),
    requestId: text("request_id"),
    tags: jsonb("tags").$type<Record<string, string>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("usage_events_org_created_idx").on(t.orgId, t.createdAt),
    index("usage_events_org_model_created_idx").on(t.orgId, t.model, t.createdAt),
    index("usage_events_proxy_key_created_idx").on(t.proxyKeyId, t.createdAt),
  ],
);

// Versioned pricing. Each usage_event records the version it was priced with.
export const modelPricing = pgTable("model_pricing", {
  id: uuid("id").primaryKey().defaultRandom(),
  provider: text("provider").notNull().default("anthropic"),
  model: text("model").notNull(),
  inputPerMtok: numeric("input_per_mtok", { precision: 12, scale: 4 }).notNull(),
  outputPerMtok: numeric("output_per_mtok", { precision: 12, scale: 4 }).notNull(),
  // 5-minute-TTL cache write multiplier (× input price). 1h writes use cacheWrite1hMult.
  cacheWriteMult: numeric("cache_write_mult", { precision: 6, scale: 4 }).notNull().default("1.25"),
  cacheWrite1hMult: numeric("cache_write_1h_mult", { precision: 6, scale: 4 }).notNull().default("2.0"),
  cacheReadMult: numeric("cache_read_mult", { precision: 6, scale: 4 }).notNull().default("0.1"),
  effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull().defaultNow(),
  version: integer("version").notNull(),
});
