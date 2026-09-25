import test from "node:test";
import assert from "node:assert/strict";
import { ResourceModes } from "../src/core/resource-policy.js";
import { ProbeScheduler, resolveProbeInterval } from "../src/core/probe.js";

test("probe scheduler adapts interval to resource mode", () => {
  assert.equal(resolveProbeInterval({ mode: ResourceModes.EFFICIENT }), 60000);
  assert.equal(resolveProbeInterval({ mode: ResourceModes.BALANCED }), 30000);
  assert.equal(resolveProbeInterval({ mode: ResourceModes.PERFORMANCE }), 15000);
});

test("probe scheduler reduces work in low-power state", () => {
  assert.equal(resolveProbeInterval({ mode: ResourceModes.PERFORMANCE }, { lowPower: true }), 60000);
});

test("probe scheduler can update resource state without creating duplicate timers", () => {
  const scheduler = new ProbeScheduler({ resourcePolicy: { mode: ResourceModes.PERFORMANCE } });
  let calls = 0;
  scheduler.start(() => { calls += 1; });
  assert.equal(scheduler.getIntervalMs(), 15000);
  assert.equal(scheduler.updateResourceState({ batterySaver: true }), 60000);
  scheduler.stop();
  assert.equal(scheduler.timer, null);
  assert.equal(calls, 0);
});
