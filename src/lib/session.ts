import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

// The app is organization-scoped and reads { userId, orgId, email } everywhere.
// These helpers adapt Better Auth's session into that shape so callers are unchanged.
export type SessionPayload = {
  userId: string;
  orgId: string;
  email: string;
};

export async function getSession(): Promise<SessionPayload | null> {
  const res = await auth.api.getSession({ headers: await headers() });
  if (!res) return null;
  const { user } = res;
  const orgId = (user as { orgId?: string }).orgId;
  if (!orgId) return null; // user without an org can't do anything useful
  return { userId: user.id, orgId, email: user.email };
}

/** Use in server components/actions that require auth. Redirects to /login if absent. */
export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
