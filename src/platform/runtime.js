import { PlatformCapabilities } from "./contract.js";
import { createPlatformBridge } from "./bridge.js";

export function createPlatformRuntime(implementation, runtime) {
  if (!runtime || typeof runtime.start !== "function" || typeof runtime.stop !== "function") {
    throw new TypeError("kernel runtime requires start() and stop()");
  }

  const bridge = createPlatformBridge(implementation);

  return Object.freeze({
    platform: bridge.platform,
    capabilities: bridge.capabilities,

    async start(options = {}) {
      await runtime.start(options);
      return bridge.start();
    },

    async stop() {
      await bridge.stop();
      return runtime.stop();
    },

    async reload(config) {
      if (typeof runtime.reload !== "function") {
        throw new Error("kernel runtime does not support reload");
      }
      return runtime.reload(config);
    },

    async status() {
      if (typeof runtime.status !== "function") {
        throw new Error("kernel runtime does not support status");
      }
      return runtime.status();
    },

    async logs(options = {}) {
      if (typeof runtime.logs !== "function") {
        throw new Error("kernel runtime does not support logs");
      }
      return runtime.logs(options);
    },

    async startTun(options = {}) {
      if (!bridge.capabilities.includes(PlatformCapabilities.TUN)) {
        throw new Error("platform capability unavailable: " + PlatformCapabilities.TUN);
      }
      return bridge.startTun(options);
    },

    async stopTun() {
      if (!bridge.capabilities.includes(PlatformCapabilities.TUN)) {
        throw new Error("platform capability unavailable: " + PlatformCapabilities.TUN);
      }
      return bridge.stopTun();
    },

    getNetworkState() {
      return bridge.getNetworkState();
    },
  });
}
