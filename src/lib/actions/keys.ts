"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { providerKeys, proxyKeys } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { encryptSecret, last4, generateProxyKey } from "@/lib/crypto";

export type KeyActionState = {
  error?: string;
  // Set once, right after issuing a proxy key — shown to the user a single time.
  newProxyKey?: string;
};

export async function addProviderKeyAction(
  _prev: KeyActionState,
  formData: FormData,
): Promise<KeyActionState> {
  const session = await requireSession();
  const label = String(formData.get("label") ?? "").trim();
  const rawKey = String(formData.get("key") ?? "").trim();

  if (!label) return { error: "Label is required" };
  if (!rawKey) return { error: "API key is required" };
  if (!rawKey.startsWith("sk-ant-")) {
    return { error: "That doesn't look like an Anthropic key (expected sk-ant-…)" };
  }

  const { iv, ciphertext } = encryptSecret(rawKey);
  await db.insert(providerKeys).values({
    orgId: session.orgId,
    provider: "anthropic",
    label,
    iv,
    ciphertext,
    keyLast4: last4(rawKey),
  });

  revalidatePath("/dashboard/keys");
  return {};
}

export async function revokeProviderKeyAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  const id = String(formData.get("id") ?? "");
  await db
    .update(providerKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(providerKeys.id, id), eq(providerKeys.orgId, session.orgId)));
  revalidatePath("/dashboard/keys");
}

export async function issueProxyKeyAction(
  _prev: KeyActionState,
  formData: FormData,
): Promise<KeyActionState> {
  const session = await requireSession();
  const label = String(formData.get("label") ?? "").trim();
  const providerKeyId = String(formData.get("providerKeyId") ?? "");

  if (!label) return { error: "Label is required" };
  if (!providerKeyId) return { error: "Select a provider key to link" };

  // Ensure the provider key belongs to this org and is active.
  const [pk] = await db
    .select({ id: providerKeys.id, revokedAt: providerKeys.revokedAt })
    .from(providerKeys)
    .where(and(eq(providerKeys.id, providerKeyId), eq(providerKeys.orgId, session.orgId)))
    .limit(1);
  if (!pk) return { error: "Provider key not found" };
  if (pk.revokedAt) return { error: "That provider key is revoked" };

  const { full, hash, last4: pkLast4 } = generateProxyKey();
  await db.insert(proxyKeys).values({
    orgId: session.orgId,
    providerKeyId,
    label,
    hash,
    keyLast4: pkLast4,
  });

  revalidatePath("/dashboard/keys");
  return { newProxyKey: full };
}

export async function revokeProxyKeyAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  const id = String(formData.get("id") ?? "");
  await db
    .update(proxyKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(proxyKeys.id, id), eq(proxyKeys.orgId, session.orgId)));
  revalidatePath("/dashboard/keys");
}
