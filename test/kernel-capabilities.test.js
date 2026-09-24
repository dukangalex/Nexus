import test from "node:test";
import assert from "node:assert/strict";
import { Kernels } from "../src/core/model.js";
import { describeKernel, describeKernels, supportsKernelCapability, CoreCapabilities } from "../src/core/kernel-capabilities.js";

test("all three kernels have first-class capability descriptors", () => {
  const descriptors = describeKernels();
  assert.deepEqual(descriptors.map((item) => item.kernel), Object.values(Kernels));
  for (const descriptor of descriptors) {
    assert.ok(Array.isArray(descriptor.capabilities));
    assert.ok(descriptor.capabilities.includes(CoreCapabilities.CHAIN_COMPILE));
    assert.equal(typeof descriptor.chainMechanism, "string");
  }
});

test("capability lookup is explicit and kernel-neutral", () => {
  assert.equal(supportsKernelCapability(Kernels.MIHOMO, CoreCapabilities.CHAIN_COMPILE), true);
  assert.equal(supportsKernelCapability(Kernels.SING_BOX, CoreCapabilities.CHAIN_COMPILE), true);
  assert.equal(supportsKernelCapability(Kernels.XRAY, CoreCapabilities.CHAIN_COMPILE), true);
});

test("unsupported kernel is rejected", () => {
  assert.throws(() => describeKernel("unknown"), /unsupported kernel/);
});
