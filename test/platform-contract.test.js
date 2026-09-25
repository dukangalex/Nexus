import test from "node:test";
import assert from "node:assert/strict";
import {
  PlatformId,
  PlatformCapabilities,
  createPlatformContract,
  getPlatformCapabilityRequirements,
} from "../src/platform/contract.js";

test("all five target platforms are first-class", () => {
  assert.deepEqual(Object.values(PlatformId), [
    "android",
    "ios",
    "windows",
    "macos",
    "linux",
  ]);
});

test("platform contract validates required lifecycle and network methods", () => {
  const platform = createPlatformContract({
    platform: PlatformId.LINUX,
    capabilities: [],
    start() {},
    stop() {},
    getNetworkState() {
      return { online: true };
    },
  });

  assert.equal(platform.platform, "linux");
});

test("capability declarations require concrete platform bridge methods", () => {
  const tunOnly = {
    platform: PlatformId.LINUX,
    capabilities: [PlatformCapabilities.TUN],
    start() {},
    stop() {},
    getNetworkState() {
      return { online: true };
    },
  };

  assert.throws(
    () => createPlatformContract(tunOnly),
    /requires method: startTun/,
  );

  const platform = createPlatformContract({
    ...tunOnly,
    startTun() {},
    stopTun() {},
  });

  assert.equal(platform.capabilities.includes(PlatformCapabilities.TUN), true);
});

test("capability requirements are explicit and stable", () => {
  assert.deepEqual(
    getPlatformCapabilityRequirements(PlatformCapabilities.APP_EXCLUSION),
    ["setAppExclusions"],
  );
  assert.deepEqual(
    getPlatformCapabilityRequirements(PlatformCapabilities.SECURE_STORAGE),
    [
      "getSecureValue",
      "setSecureValue",
      "deleteSecureValue",
    ],
  );
});

test("unsupported capability and invalid platform implementation are rejected", () => {
  assert.throws(
    () =>
      createPlatformContract({
        platform: PlatformId.LINUX,
        capabilities: ["unknown"],
        start() {},
        stop() {},
        getNetworkState() {},
      }),
    /unsupported platform capability/,
  );

  assert.throws(
    () =>
      createPlatformContract({
        platform: "unknown",
        capabilities: [],
        start() {},
        stop() {},
        getNetworkState() {},
      }),
    /unsupported platform/,
  );
});
