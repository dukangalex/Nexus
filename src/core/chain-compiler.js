import { Kernels } from "./model.js";
import { compileMihomoChain } from "../adapters/mihomo/compiler.js";
import { compileSingBoxChain } from "../adapters/sing-box/compiler.js";
import { compileXrayChain } from "../adapters/xray/compiler.js";

export function compileChain(kernel, config, chain) {
  if (kernel === Kernels.MIHOMO) return compileMihomoChain(config, chain);
  if (kernel === Kernels.SING_BOX) return compileSingBoxChain(config, chain);
  if (kernel === Kernels.XRAY) return compileXrayChain(config, chain);
  throw new Error("unsupported kernel");
}
