import { Kernels } from "../core/model.js";

export const AdapterCapabilities = Object.freeze({
  CONFIG_COMPILE: "config-compile",
  CHAIN_COMPILE: "chain-compile",
  CONFIG_COMPILE: "config-compile",
  LIFECYCLE: "lifecycle",
  STATUS: "status",
  LOGS: "logs",
  HEALTH: "health",
});

const REQUIRED = [
  "kernel",
  "capabilities",
  "compileChain",
];

export function createKernelAdapter(implementation) {
  if (!implementation || typeof implementation !== "object") {
    throw new TypeError("kernel adapter is required");
  }

  for (const key of REQUIRED) {
    if (typeof implementation[key] === "undefined") {
      throw new TypeError("kernel adapter missing: " + key);
    }
  }

  if (!Object.values(Kernels).includes(implementation.kernel)) {
    throw new TypeError("unsupported kernel adapter: " + implementation.kernel);
  }

  if (!Array.isArray(implementation.capabilities)) {
    throw new TypeError("kernel adapter capabilities must be an array");
  }

  return Object.freeze({
    ...implementation,
    capabilities: Object.freeze([...new Set(implementation.capabilities)]),
  });
}

export function hasAdapterCapability(adapter, capability) {
  return Boolean(adapter && Array.isArray(adapter.capabilities) && adapter.capabilities.includes(capability));
}
