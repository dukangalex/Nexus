import test from "node:test";
import assert from "node:assert/strict";
import { Kernels } from "../src/core/model.js";
import { AdapterCapabilities, adapterFor, hasAdapterCapability } from "../src/adapters/index.js";

for (const kernel of Object.values(Kernels)) {
  test(kernel + " exposes the unified adapter contract", () => {
    const adapter = adapterFor(kernel);
    assert.equal(adapter.kernel, kernel);
    assert.equal(typeof adapter.compileChain, "function");
    assert.equal(hasAdapterCapability(adapter, AdapterCapabilities.CHAIN_COMPILE), true);
  });
}

test("adapter lookup rejects unknown kernels", () => {
  assert.equal(adapterFor("unknown"), null);
});
