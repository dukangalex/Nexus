import test from "node:test";
import assert from "node:assert/strict";
import { createGroup, buildGroups, buildRegionGroups, filterGroupMembers } from "../src/core/group.js";

test("creates supported group types with deduplicated members", () => {
  const group = createGroup({
    id: "proxy",
    name: "Proxy",
    type: "select",
    members: ["a", "a", "b"]
  });
  assert.deepEqual(group.members, ["a", "b"]);
});

test("region groups are omitted when empty", () => {
  assert.equal(createGroup({ id: "region:us", name: "US", type: "region", members: [] }), null);
  assert.deepEqual(Object.keys(buildRegionGroups({ us: [], jp: [{ id: "jp-1" }] })), ["region:jp"]);
});

test("groups exclude failed and disabled nodes", () => {
  const groups = buildGroups(
    [{ id: "auto", name: "Auto", type: "url_test", members: ["ok", "failed", "disabled"] }],
    [{ id: "ok" }, { id: "failed" }, { id: "disabled" }],
    { failed: "failed", disabled: "disabled" }
  );
  assert.deepEqual(groups.auto.members, ["ok"]);
});

test("filterGroupMembers removes unusable and duplicate nodes", () => {
  assert.deepEqual(
    filterGroupMembers([{ id: "a" }, { id: "a" }, { id: "b" }], { b: "disabled" }),
    ["a"]
  );
});

test("supports selector, url-test, fallback and load-balance", () => {
  for (const type of ["select", "url_test", "fallback", "load_balance"]) {
    assert.equal(createGroup({ id: type, name: type, type, members: ["a"] }).type, type);
  }
});
