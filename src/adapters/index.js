import { Kernels } from "../core/model.js";
import { createKernelAdapter, AdapterCapabilities, hasAdapterCapability } from "./contract.js";
import { compileMihomoChain } from "./mihomo/compiler.js";
import { compileSingBoxChain } from "./sing-box/compiler.js";
import { compileXrayChain } from "./xray/compiler.js";

export { AdapterCapabilities, createKernelAdapter, hasAdapterCapability };

export const adapters = Object.freeze({
  [Kernels.MIHOMO]: createKernelAdapter({
    kernel: Kernels.MIHOMO,
    capabilities: [AdapterCapabilities.CHAIN_COMPILE],
    chainMechanism: "dialer-proxy",
    compileChain: compileMihomoChain,
  }),
  [Kernels.SING_BOX]: createKernelAdapter({
    kernel: Kernels.SING_BOX,
    capabilities: [AdapterCapabilities.CHAIN_COMPILE],
    chainMechanism: "detour",
    compileChain: compileSingBoxChain,
  }),
  [Kernels.XRAY]: createKernelAdapter({
    kernel: Kernels.XRAY,
    capabilities: [AdapterCapabilities.CHAIN_COMPILE],
    chainMechanism: "streamSettings.sockopt.dialerProxy",
    compileChain: compileXrayChain,
  }),
});

export function adapterFor(kernel) {
  return adapters[kernel] || null;
}
