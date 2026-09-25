import test from "node:test";
import assert from "node:assert/strict";
import { createKernelRuntime } from "../src/kernel/index.js";

function fakeSpawn() {
  const listeners = {};
  const stream = { on() {} };
  return {
    pid: 42,
    exitCode: null,
    killed: false,
    stdout: stream,
    stderr: stream,
    on() {},
    once(event, fn) { listeners[event] = fn; },
    kill(signal) {
      this.killed = signal === "SIGKILL";
      this.exitCode = 0;
      if (listeners.exit) listeners.exit();
    },
  };
}

test("mihomo runtime uses documented HUP reload signal", async () => {
  const calls = [];
  const runtime = createKernelRuntime("mihomo", {
    binary: "mihomo",
    spawn(binary, args, options) {
      calls.push(["spawn", binary, args, options]);
      return fakeSpawn();
    },
  });

  await runtime.start();
  assert.equal((await runtime.status()).running, true);
  const result = await runtime.reload();
  assert.equal(result.signal, "SIGHUP");
  await runtime.stop();
  assert.equal(calls[0][0], "spawn");
});

test("sing-box and Xray do not invent process reload support", async () => {
  for (const kernel of ["sing-box", "xray"]) {
    const runtime = createKernelRuntime(kernel, {
      binary: kernel,
      spawn: fakeSpawn,
    });
    await runtime.start();
    await assert.rejects(() => runtime.reload(), /does not support process reload/);
    await runtime.stop();
  }
});

test("kernel runtime captures and redacts logs", async () => {
  const runtime = createKernelRuntime("mihomo", {
    binary: "mihomo",
    spawn(binary, args, options) {
      const child = fakeSpawn();
      child.stdout = { on(event, fn) { if (event === "data") fn('password=supersecret\\n'); } };
      child.stderr = { on() {} };
      return child;
    },
  });
  await runtime.start();
  const entries = await runtime.logs();
  assert.match(entries[0].line, /REDACTED/);
  assert.doesNotMatch(entries[0].line, /supersecret/);
  await runtime.stop();
});
