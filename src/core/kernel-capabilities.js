import { Kernels } from "./model.js";
import { adapters } from "../adapters/index.js";

export const CoreCapabilities = Object.freeze({
  CONFIG_COMPILE: "config-compile",
  CHAIN_COMPILE: "chain-compile",
  LIFECYCLE: "lifecycle",
  STATUS: "status",
  LOGS: "logs",
  HEALTH: "health",
});

function normalizeList(value) {
  return Array.isArray(value) ? [...new Set(value)] : [];
}

export function describeKernel(kernel) {
  if (!Object.values(Kernels).includes(kernel)) {
    throw new Error("unsupported kernel: " + kernel);
  }
  const adapter = adapters[kernel];
  return Object.freeze({
    kernel,
    capabilities: Object.freeze(normalizeList(adapter.capabilities)),
    chainMechanism: adapter.chainMechanism || null,
  });
}

export function describeKernels() {
  return Object.values(Kernels).map(describeKernel);
}

export function supportsKernelCapability(kernel, capability) {
  return describeKernel(kernel).capabilities.includes(capability);
}
