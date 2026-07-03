"use client";

import { useActionState, useState } from "react";
import {
  issueProxyKeyAction,
  revokeProxyKeyAction,
  type KeyActionState,
} from "@/lib/actions/keys";
import type { ProviderKeyRow, ProxyKeyRow } from "@/lib/data/keys";

export function ProxyKeys({
  proxyKeys,
  providerKeys,
}: {
  proxyKeys: ProxyKeyRow[];
  providerKeys: ProviderKeyRow[];
}) {
  const [state, formAction, pending] = useActionState<KeyActionState, FormData>(
    issueProxyKeyAction,
    {},
  );
  const activeProviders = providerKeys.filter((k) => !k.revokedAt);

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-5">
      <h2 className="text-base font-semibold text-white">Proxy keys</h2>
      <p className="mt-1 text-sm text-neutral-400">
        Keys you issue and use in your app. Point your SDK&apos;s <code>baseURL</code> at the proxy
        and use one of these instead of your Anthropic key.
      </p>

      {state.newProxyKey && <NewKeyBanner value={state.newProxyKey} />}

      <form action={formAction} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex-1">
          <span className="mb-1 block text-xs font-medium text-neutral-400">Label</span>
          <input
            name="label"
            placeholder="my-app-backend"
            className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white placeholder-neutral-600 outline-none focus:border-indigo-500"
          />
        </label>
        <label className="flex-1">
          <span className="mb-1 block text-xs font-medium text-neutral-400">Linked provider key</span>
          <select
            name="providerKeyId"
            className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
          >
            <option value="">Select…</option>
            {activeProviders.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label} (sk-ant-…{k.keyLast4})
              </option>
            ))}
          </select>
        </label>
        <button
          disabled={pending || activeProviders.length === 0}
          className="rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
        >
          {pending ? "Issuing…" : "Issue key"}
        </button>
      </form>
      {activeProviders.length === 0 && (
        <p className="mt-2 text-sm text-amber-400">Add a provider key first.</p>
      )}
      {state.error && <p className="mt-2 text-sm text-red-400">{state.error}</p>}

      <ul className="mt-5 divide-y divide-neutral-800">
        {proxyKeys.length === 0 && (
          <li className="py-3 text-sm text-neutral-500">No proxy keys yet.</li>
        )}
        {proxyKeys.map((k) => (
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
                tokenmeter_pk_…{k.keyLast4} · → {k.providerLabel ?? "—"}
              </div>
            </div>
            {!k.revokedAt && (
              <form action={revokeProxyKeyAction}>
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

function NewKeyBanner({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-4 rounded-md border border-indigo-800 bg-indigo-950/40 p-3">
      <p className="text-sm font-medium text-indigo-200">
        Copy your new proxy key now — it won&apos;t be shown again.
      </p>
      <div className="mt-2 flex items-center gap-2">
        <code className="flex-1 overflow-x-auto rounded bg-neutral-950 px-3 py-2 font-mono text-xs text-white">
          {value}
        </code>
        <button
          onClick={() => {
            navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="rounded-md bg-indigo-500 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-400"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}
