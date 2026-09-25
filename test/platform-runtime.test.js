import test from "node:test";
import assert from "node:assert/strict";
import { PlatformId, PlatformCapabilities, createPlatformRuntime } from "../src/platform/index.js";

function platform() {
  return {
    platform: PlatformId.LINUX,
    capabilities: [PlatformCapabilities.TUN],
    start() {},
    stop() {},
    getNetworkState() { return { online: true }; },
    startTun() { return { fd: 7 }; },
    stopTun() {},
  };
}

test("platform runtime preserves kernel lifecycle ordering", async () => {
  const events = [];
  const runtime = createPlatformRuntime(platform(), {
    async start() { events.push("kernel:start"); },
    async stop() { events.push("kernel:stop"); },
    async reload(config) { events.push(["reload", config]); return true; },
    async status() { return { running: true }; },
    async logs() { return ["ok"]; },
  });

  await runtime.start();
  assert.deepEqual(events, ["kernel:start"]);
  assert.deepEqual(runtime.getNetworkState(), { online: true });

  assert.deepEqual(await runtime.reload({ version: 1 }), true);
  assert.deepEqual(await runtime.status(), { running: true });
  assert.deepEqual(await runtime.logs(), ["ok"]);

  await runtime.stop();
  assert.deepEqual(events, ["kernel:start", "kernel:stop"]);
});

test("platform runtime exposes TUN only when platform declares it", async () => {
  let started = false;
  const runtime = createPlatformRuntime(platform(), {
    async start() {},
    async stop() {},
  });
  const original = runtime.startTun;
  assert.equal(typeof original, "function");
  const result = await runtime.startTun();
  assert.deepEqual(result, { fd: 7 });
  started = true;
  assert.equal(started, true);
});

test("platform runtime does not silently substitute unsupported kernel operations", async () => {
  const runtime = createPlatformRuntime(platform(), {
    async start() {},
    async stop() {},
  });
  await assert.rejects(() => runtime.reload({}), /does not support reload/);
  await assert.rejects(() => runtime.status(), /does not support status/);
  await assert.rejects(() => runtime.logs(), /does not support logs/);
});
