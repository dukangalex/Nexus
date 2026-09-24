import test from "node:test";
import assert from "node:assert/strict";
import {
  PlatformId,
  PlatformCapabilities,
  createPlatformContract,
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
    capabilities: [
      PlatformCapabilities.TUN,
      PlatformCapabilities.NETWORK_MONITOR,
    ],
    start() {},
    stop() {},
    getNetworkState() {
      return { online: true };
    },
  });

  assert.equal(platform.platform, "linux");
  assert.equal(platform.capabilities.includes("tun"), true);
});

test("invalid platform implementation is rejected", () => {
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
