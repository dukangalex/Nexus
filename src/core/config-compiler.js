import { adapterFor } from "../adapters/index.js";
import { AdapterCapabilities, hasAdapterCapability } from "../adapters/contract.js";
import { validateUnifiedCompatibility } from "./compatibility.js";

export function compileUnifiedConfig(config, kernel = config && config.kernel) {
  if (!config || typeof config !== "object") {
    throw new TypeError("unified configuration is required");
  }

  const adapter = adapterFor(kernel);
  if (!adapter) throw new Error("unsupported kernel: " + kernel);
  if (!hasAdapterCapability(adapter, AdapterCapabilities.CONFIG_COMPILE)) {
    throw new Error("kernel does not implement config compilation: " + kernel);
  }

  const compatibility = validateUnifiedCompatibility(config, kernel);
  if (!compatibility.ok) {
    const ids = compatibility.unknown.concat(compatibility.unsupported).map((item) => item.id || "unknown");
    throw new Error("configuration is not safely compilable for " + kernel + ": " + ids.join(", "));
  }

  return {
    kernel,
    status: "compiled",
    config: adapter.compileConfig(config)
  };
}
