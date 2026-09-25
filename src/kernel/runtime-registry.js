import { createProcessKernelRuntime } from "./process-runtime.js";

const SPECS = Object.freeze({
  mihomo: Object.freeze({ reloadSignal: "SIGHUP" }),
  "sing-box": Object.freeze({ reloadSignal: null }),
  xray: Object.freeze({ reloadSignal: null }),
});

export function getKernelRuntimeSpec(kernel) {
  if (!SPECS[kernel]) throw new Error("unsupported kernel runtime: " + kernel);
  return SPECS[kernel];
}

export function createKernelRuntime(kernel, options = {}) {
  const spec = getKernelRuntimeSpec(kernel);
  return createProcessKernelRuntime({
    ...options,
    kernel,
    reloadSignal: options.reloadSignal === undefined ? spec.reloadSignal : options.reloadSignal,
  });
}
