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

test("prefers structured country metadata over a name hint", () => {
  const detected = detectRegion({ name: "US-looking-name", countryCode: "JP" });
  assert.equal(detected.region, "japan");
  assert.equal(detected.confidence, "structured-metadata");
});

test("preserves region evidence on grouped nodes", () => {
  const groups = groupByRegion([{ name: "US-1", countryCode: "US" }]);
  assert.equal(groups["united-states"][0].regionConfidence, "structured-metadata");
});
