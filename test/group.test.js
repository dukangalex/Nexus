import test from "node:test";
import assert from "node:assert/strict";
import { createGroup, buildGroups, buildRegionGroups, buildDynamicGroups, filterGroupMembers, resolveGroupMember } from "../src/core/group.js";

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

test("dynamic groups derive non-empty region groups from usable nodes", () => {
  const groups = buildDynamicGroups([
    { id: "us-1", name: "US 01", countryCode: "US", state: "available" },
    { id: "us-2", name: "US 02", countryCode: "US", state: "failed" },
    { id: "jp-1", name: "JP 01", countryCode: "JP", state: "active" }
  ]);
  assert.deepEqual(Object.keys(groups), ["region:united-states", "region:japan"]);
  assert.deepEqual(groups["region:united-states"].members, ["us-1"]);
});

test("group strategies resolve from current state without mutating group state", () => {
  const urlTest = createGroup({ id: "auto", name: "Auto", type: "url_test", members: ["slow", "fast", "bad"] });
  const result = resolveGroupMember(urlTest, [
    { id: "slow", latencyMs: 100 },
    { id: "fast", latencyMs: 40 },
    { id: "bad", latencyMs: 1, state: "degraded" }
  ]);
  assert.equal(result.member.id, "fast");

  const fallback = createGroup({ id: "failover", name: "Failover", type: "fallback", members: ["first", "second"] });
  assert.equal(resolveGroupMember(fallback, [{ id: "first", state: "failed" }, { id: "second" }]).member.id, "second");
});

test("load-balance is deterministic without shared mutable state", () => {
  const group = createGroup({ id: "lb", name: "LB", type: "load_balance", members: ["a", "b", "c"] });
  const nodes = [{ id: "a" }, { id: "b" }, { id: "c" }];
  assert.equal(
    resolveGroupMember(group, nodes, undefined, { key: "same-flow" }).member.id,
    resolveGroupMember(group, nodes, undefined, { key: "same-flow" }).member.id
  );
});

test("required capabilities prevent silent fallback from an explicit selection", () => {
  const group = createGroup({
    id: "udp",
    name: "UDP",
    type: "select",
    members: ["tcp", "udp"],
    options: { requiredCapabilities: ["udp"], selected: "tcp" }
  });
  const result = resolveGroupMember(group, [
    { id: "tcp", capabilities: ["tcp"] },
    { id: "udp", capabilities: ["tcp", "udp"] }
  ]);
  assert.equal(result.ok, false);
  assert.equal(result.member, null);
});
