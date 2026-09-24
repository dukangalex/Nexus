import test from "node:test";
import assert from "node:assert/strict";
import { UpstreamKernelRegistry, getKernelUpstream } from "../src/core/kernel-registry.js";

test("all three kernels have independently maintainable upstream metadata", () => {
  for (const kernel of ["mihomo", "sing-box", "xray"]) {
    const entry = getKernelUpstream(kernel);
    assert.ok(entry.repository);
    assert.ok(entry.stable);
    assert.ok(entry.releases);
    assert.ok(entry.docs);
  }
});

test("upstream metadata is not shared through a primary-kernel abstraction", () => {
  assert.notEqual(UpstreamKernelRegistry.mihomo.repository, UpstreamKernelRegistry["sing-box"].repository);
  assert.notEqual(UpstreamKernelRegistry["sing-box"].repository, UpstreamKernelRegistry.xray.repository);
});
