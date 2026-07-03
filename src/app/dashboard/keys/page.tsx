import { requireSession } from "@/lib/session";
import { getProviderKeys, getProxyKeys } from "@/lib/data/keys";
import { ProviderKeys } from "@/components/keys/ProviderKeys";
import { ProxyKeys } from "@/components/keys/ProxyKeys";

export default async function KeysPage() {
  const session = await requireSession();
  const [providerKeys, proxyKeys] = await Promise.all([
    getProviderKeys(session.orgId),
    getProxyKeys(session.orgId),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Keys</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Add your Anthropic key, then issue proxy keys to route traffic through the tracker.
        </p>
      </div>
      <ProviderKeys keys={providerKeys} />
      <ProxyKeys proxyKeys={proxyKeys} providerKeys={providerKeys} />
    </div>
  );
}
