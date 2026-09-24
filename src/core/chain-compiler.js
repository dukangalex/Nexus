import { adapterFor } from "../adapters/index.js";

export function compileChain(kernel, config, chain) {
  const adapter = adapterFor(kernel);
  if (!adapter) throw new Error("unsupported kernel");
  return adapter.compileChain(config, chain);
}
