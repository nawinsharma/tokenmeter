import Link from "next/link";
import { requireSession } from "@/lib/session";
import { logoutAction } from "@/lib/actions/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();

  return (
    <div className="min-h-screen">
      <header className="border-b border-neutral-800">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="h-5 w-5 rounded bg-indigo-500" />
              <span className="text-sm font-semibold text-white">Token Meter</span>
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/dashboard" className="text-neutral-300 hover:text-white">
                Overview
              </Link>
              <Link href="/dashboard/keys" className="text-neutral-300 hover:text-white">
                Keys
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-neutral-400">{session.email}</span>
            <form action={logoutAction}>
              <button className="rounded-md border border-neutral-700 px-3 py-1.5 text-neutral-300 hover:bg-neutral-800">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
