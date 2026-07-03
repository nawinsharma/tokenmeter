import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "crypto";
import { env } from "@/lib/env";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function masterKey(): Buffer {
  const key = Buffer.from(env.masterEncryptionKey, "base64");
  if (key.length !== 32) {
    throw new Error("MASTER_ENCRYPTION_KEY must be 32 bytes (base64-encoded)");
  }
  return key;
}

/**
 * Encrypt a plaintext secret (e.g. a provider API key).
 * Returns the 12-byte nonce and ciphertext (with the 16-byte GCM auth tag appended).
 */
export function encryptSecret(plaintext: string): { iv: Buffer; ciphertext: Buffer } {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, masterKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { iv, ciphertext: Buffer.concat([enc, tag]) };
}

/** Decrypt what encryptSecret produced. Throws if the ciphertext was tampered with. */
export function decryptSecret(iv: Buffer, ciphertext: Buffer): string {
  const tag = ciphertext.subarray(ciphertext.length - TAG_LEN);
  const enc = ciphertext.subarray(0, ciphertext.length - TAG_LEN);
  const decipher = createDecipheriv(ALGO, masterKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

/** Last 4 chars of a secret, for display. */
export function last4(secret: string): string {
  return secret.slice(-4);
}

// ---- Proxy key issuance ----

const PROXY_KEY_PREFIX = "tokenmeter_pk_";

/** Generate a new proxy key (shown to the user once) + its storable sha256 hash. */
export function generateProxyKey(): { full: string; hash: string; last4: string } {
  const full = PROXY_KEY_PREFIX + randomBytes(24).toString("base64url");
  return { full, hash: hashProxyKey(full), last4: full.slice(-4) };
}

export function hashProxyKey(full: string): string {
  return createHash("sha256").update(full).digest("hex");
}
