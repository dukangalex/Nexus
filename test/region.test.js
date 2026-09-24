import test from "node:test";
import assert from "node:assert/strict";
import { detectRegion, groupByRegion } from "../src/core/region.js";

test("detects US from node metadata", () => {
  assert.equal(detectRegion({ name: "US-West-01" }).region, "united-states");
});

test("does not create empty region groups", () => {
  const groups = groupByRegion([{ name: "US-1" }, { name: "JP-1" }]);
  assert.deepEqual(Object.keys(groups), ["united-states", "japan"]);
  assert.equal(groups["hong-kong"], undefined);
});
