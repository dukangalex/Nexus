import { Kernels, NodeProtocols } from "./model.js";
import { UpstreamKernelRegistry } from "./kernel-registry.js";

// Protocol-level claims are deliberately kept in data, separate from compatibility logic.
// Update this manifest only after reviewing the corresponding upstream release/docs.
export const KernelCapabilityManifest = Object.freeze({
  [Kernels.MIHOMO]: Object.freeze({
    protocols: Object.freeze([
      NodeProtocols.HTTP, NodeProtocols.SOCKS, NodeProtocols.SHADOWSOCKS,
      NodeProtocols.VMESS, NodeProtocols.VLESS, NodeProtocols.TROJAN,
      NodeProtocols.HYSTERIA, NodeProtocols.WIREGUARD, NodeProtocols.TUIC, NodeProtocols.HYSTERIA2,
      NodeProtocols.ANYTLS
    ]),
    unsupported: Object.freeze([])
  }),
  [Kernels.SING_BOX]: Object.freeze({
    protocols: Object.freeze([
      NodeProtocols.HTTP, NodeProtocols.SOCKS, NodeProtocols.SHADOWSOCKS,
      NodeProtocols.VMESS, NodeProtocols.VLESS, NodeProtocols.TROJAN,
      NodeProtocols.HYSTERIA, NodeProtocols.HYSTERIA2,
      NodeProtocols.TUIC, NodeProtocols.ANYTLS
    ]),
    unsupported: Object.freeze([NodeProtocols.WIREGUARD])
  }),
  [Kernels.XRAY]: Object.freeze({
    protocols: Object.freeze([
      NodeProtocols.HTTP, NodeProtocols.SOCKS, NodeProtocols.SHADOWSOCKS,
      NodeProtocols.VMESS, NodeProtocols.VLESS, NodeProtocols.TROJAN,
      NodeProtocols.WIREGUARD, NodeProtocols.HYSTERIA
    ]),
    unsupported: Object.freeze([NodeProtocols.HYSTERIA2, NodeProtocols.TUIC, NodeProtocols.ANYTLS])
  })
});

export function getKernelCapabilityManifest(kernel) {
  const manifest = KernelCapabilityManifest[kernel];
  if (!manifest) throw new Error("unsupported kernel: " + kernel);
  return Object.freeze({
    kernel,
    version: UpstreamKernelRegistry[kernel],
    ...manifest
  });
}
