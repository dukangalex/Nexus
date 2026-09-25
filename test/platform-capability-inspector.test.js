import test from "node:test";
import assert from "node:assert/strict";
import {
  PlatformId,
  PlatformCapabilities,
  inspectPlatformCapabilities,
} from "../src/platform/index.js";

test("platform capability inspector reports declared and unavailable capabilities", () => {
  const result = inspectPlatformCapabilities({
    platform: PlatformId.IOS,
    capabilities: [
      PlatformCapabilities.TUN,
      PlatformCapabilities.NETWORK_MONITOR,
    ],
    start() {},
    stop() {},
    getNetworkState() { return { online: true }; },
    startTun() {},
    stopTun() {},
    subscribeNetworkState() {},
  });

  const tun = result.capabilities.find(
    (item) => item.capability === PlatformCapabilities.TUN,
  );
  const storage = result.capabilities.find(
    (item) => item.capability === PlatformCapabilities.SECURE_STORAGE,
  );

  assert.equal(tun.supported, true);
  assert.deepEqual(tun.requiredMethods, ["startTun", "stopTun"]);
  assert.equal(storage.supported, false);
  assert.deepEqual(storage.requiredMethods, [
    "getSecureValue",
    "setSecureValue",
    "deleteSecureValue",
  ]);
});
