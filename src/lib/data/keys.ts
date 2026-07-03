import "server-only";
import { db } from "@/db";
import { providerKeys, proxyKeys } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export type ProviderKeyRow = {
  id: string;
  provider: string;
  label: string;
  keyLast4: string;
  createdAt: Date;
  revokedAt: Date | null;
};

export async function getProviderKeys(orgId: string): Promise<ProviderKeyRow[]> {
  return db
    .select({
      id: providerKeys.id,
      provider: providerKeys.provider,
      label: providerKeys.label,
      keyLast4: providerKeys.keyLast4,
      createdAt: providerKeys.createdAt,
      revokedAt: providerKeys.revokedAt,
    })
    .from(providerKeys)
    .where(eq(providerKeys.orgId, orgId))
    .orderBy(desc(providerKeys.createdAt));
}

export type ProxyKeyRow = {
  id: string;
  label: string;
  keyLast4: string;
  providerKeyId: string;
  providerLabel: string | null;
  createdAt: Date;
  revokedAt: Date | null;
};

export async function getProxyKeys(orgId: string): Promise<ProxyKeyRow[]> {
  return db
    .select({
      id: proxyKeys.id,
      label: proxyKeys.label,
      keyLast4: proxyKeys.keyLast4,
      providerKeyId: proxyKeys.providerKeyId,
      providerLabel: providerKeys.label,
      createdAt: proxyKeys.createdAt,
      revokedAt: proxyKeys.revokedAt,
    })
    .from(proxyKeys)
    .leftJoin(providerKeys, eq(proxyKeys.providerKeyId, providerKeys.id))
    .where(eq(proxyKeys.orgId, orgId))
    .orderBy(desc(proxyKeys.createdAt));
}
