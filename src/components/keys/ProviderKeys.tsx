"use client";

import { useActionState } from "react";
import {
  addProviderKeyAction,
  revokeProviderKeyAction,
  type KeyActionState,
} from "@/lib/actions/keys";
import type { ProviderKeyRow } from "@/lib/data/keys";

export function ProviderKeys({ keys }: { keys: ProviderKeyRow[] }) {
  const [state, formAction, pending] = useActionState<KeyActionState, FormData>(
    addProviderKeyAction,
    {},
  );

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-5">
      <h2 className="text-base font-semibold text-white">Provider keys</h2>
      <p className="mt-1 text-sm text-neutral-400">
        Your real Anthropic API key. Encrypted at rest; we only ever show the last 4 characters.
      </p>

      <form action={formAction} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex-1">
          <span className="mb-1 block text-xs font-medium text-neutral-400">Label</span>
          <input
            name="label"
            placeholder="Production"
            className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white placeholder-neutral-600 outline-none focus:border-indigo-500"
          />
        </label>
        <label className="flex-[2]">
          <span className="mb-1 block text-xs font-medium text-neutral-400">Anthropic API key</span>
          <input
            name="key"
            type="password"
            placeholder="sk-ant-api03-…"
            className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white placeholder-neutral-600 outline-none focus:border-indigo-500"
          />
        </label>
        <button
          disabled={pending}
          className="rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add key"}
        </button>
      </form>
      {state.error && <p className="mt-2 text-sm text-red-400">{state.error}</p>}

      <ul className="mt-5 divide-y divide-neutral-800">
        {keys.length === 0 && (
          <li className="py-3 text-sm text-neutral-500">No provider keys yet.</li>
        )}
        {keys.map((k) => (
          <li key={k.id} className="flex items-center justify-between py-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white">{k.label}</span>
                {k.revokedAt ? (
                  <span className="rounded bg-red-950 px-1.5 py-0.5 text-xs text-red-400">
                    revoked
                  </span>
                ) : (
                  <span className="rounded bg-emerald-950 px-1.5 py-0.5 text-xs text-emerald-400">
                    active
                  </span>
                )}
              </div>
              <div className="mt-0.5 font-mono text-xs text-neutral-500">
                {k.provider} · sk-ant-…{k.keyLast4}
              </div>
            </div>
            {!k.revokedAt && (
              <form action={revokeProviderKeyAction}>
                <input type="hidden" name="id" value={k.id} />
                <button className="text-xs text-neutral-400 hover:text-red-400">Revoke</button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
