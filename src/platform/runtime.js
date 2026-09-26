
import { PlatformCapabilities } from "./contract.js";
import { createPlatformBridge } from "./bridge.js";

function killSwitchRequirements(capabilities) {
  const required = [
    PlatformCapabilities.TUN,
    PlatformCapabilities.NETWORK_MONITOR,
    PlatformCapabilities.NETWORK_BLOCK,
  ];
  return required.filter((capability) => !capabilities.includes(capability));
}

function isSafeNetworkState(state) {
  return state && state.online === true && state.captivePortal !== true;
}

export function createPlatformRuntime(implementation, runtime) {
  if (!runtime || typeof runtime.start !== "function" || typeof runtime.stop !== "function") {
    throw new TypeError("kernel runtime requires start() and stop()");
  }
  const bridge = createPlatformBridge(implementation);
  let unsubscribe = null;
  let killSwitchEnabled = false;
  let started = false;

  async function enableKillSwitch(options = {}) {
    const missing = killSwitchRequirements(bridge.capabilities);
    if (missing.length) throw new Error("kill switch requires platform capabilities: " + missing.join(", "));
    await bridge.enableNetworkBlock("kill-switch-start");
    killSwitchEnabled = true;
    await bridge.startTun(options);
    return true;
  }

  async function disableKillSwitch() {
    if (!killSwitchEnabled) return;
    await bridge.enableNetworkBlock("kill-switch-transition");
    killSwitchEnabled = true;
    await bridge.stopTun();
    await bridge.disableNetworkBlock("kill-switch-release");
    killSwitchEnabled = false;
  }

  async function handleNetworkState(state) {
    if (!killSwitchEnabled) return;
    if (!isSafeNetworkState(state)) {
      await bridge.enableNetworkBlock("kill-switch-network-state");
      return;
    }
    await bridge.disableNetworkBlock("kill-switch-network-restored");
  }

  return Object.freeze({
    platform: bridge.platform,
    capabilities: bridge.capabilities,

    async start(options = {}) {
      const security = options.security || {};
      if (security.killSwitch === true) {
        await enableKillSwitch(options.tun || {});
      }
      try {
        await runtime.start(options);
        await bridge.start();
        if (security.killSwitch === true) {
          const state = bridge.getNetworkState();
          await handleNetworkState(state);
          unsubscribe = await bridge.subscribeNetworkState(handleNetworkState);
        }
        started = true;
        return stateOrNetwork(bridge);
      } catch (error) {
        if (security.killSwitch === true) {
          try { await bridge.enableNetworkBlock("kill-switch-start-failed"); } catch {}
        }
        throw error;
      }
    },

    async stop() {
      if (securityEnabled(arguments)) {
        try { await bridge.enableNetworkBlock("kill-switch-stop"); } catch {}
      }
      if (unsubscribe) {
        await unsubscribe();
        unsubscribe = null;
      }
      if (killSwitchEnabled) {
        try { await bridge.enableNetworkBlock("kill-switch-stop"); } catch {}
        try { await bridge.stopTun(); } finally { killSwitchEnabled = false; }
      }
      await bridge.stop();
      await runtime.stop();
      started = false;
      return bridge.getNetworkState();
    },

    async reload(config) {
      if (typeof runtime.reload !== "function") throw new Error("kernel runtime does not support reload");
      return runtime.reload(config);
    },
    async status() {
      if (typeof runtime.status !== "function") throw new Error("kernel runtime does not support status");
      return runtime.status();
    },
    async logs(options = {}) {
      if (typeof runtime.logs !== "function") throw new Error("kernel runtime does not support logs");
      return runtime.logs(options);
    },
    async startTun(options = {}) { return bridge.startTun(options); },
    async stopTun() { return bridge.stopTun(); },
    async enableNetworkBlock(reason) { return bridge.enableNetworkBlock(reason); },
    async disableNetworkBlock(reason) { return bridge.disableNetworkBlock(reason); },
    async subscribeNetworkState(listener) { return bridge.subscribeNetworkState(listener); },
    getNetworkState() { return bridge.getNetworkState(); },
  });

  function securityEnabled(args) {
    return Boolean(args && args.length && args[0] && args[0].security && args[0].security.killSwitch === true);
  }
  function stateOrNetwork(b) { return b.getNetworkState(); }
}
