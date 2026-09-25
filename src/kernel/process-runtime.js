import { spawn as defaultSpawn } from "node:child_process";

const DEFAULT_LOG_LIMIT = 500;

function redact(text) {
  return String(text)
    .replace(/([?&](?:password|token|secret|uuid|key)=)[^&\s]+/gi, "$1[REDACTED]")
    .replace(/("?(?:password|token|secret|uuid|private_key)"?\s*[:=]\s*")([^"]*)(")/gi, "$1[REDACTED]$3");
}

export function createProcessKernelRuntime(options = {}) {
  const {
    kernel,
    binary,
    args = [],
    cwd,
    env,
    reloadSignal = null,
    spawn = defaultSpawn,
    logLimit = DEFAULT_LOG_LIMIT,
  } = options;

  if (!kernel || !binary) throw new TypeError("kernel and binary are required");
  if (!Array.isArray(args)) throw new TypeError("args must be an array");

  let child = null;
  let startedAt = null;
  const logs = [];

  function appendLog(stream, chunk) {
    const lines = redact(chunk).split(/\r?\n/).filter(Boolean);
    for (const line of lines) logs.push({ stream, line, timestamp: new Date().toISOString() });
    if (logs.length > logLimit) logs.splice(0, logs.length - logLimit);
  }

  return Object.freeze({
    kernel,

    async start() {
      if (child && child.exitCode === null && !child.killed) {
        throw new Error("kernel runtime already running");
      }

      child = spawn(binary, args, {
        cwd,
        env: env ? { ...process.env, ...env } : process.env,
        stdio: ["ignore", "pipe", "pipe"],
      });

      child.stdout.on("data", (chunk) => appendLog("stdout", chunk));
      child.stderr.on("data", (chunk) => appendLog("stderr", chunk));
      child.once("exit", () => { startedAt = null; });

      startedAt = new Date().toISOString();
      return { kernel, status: "starting" };
    },

    async stop() {
      if (!child || child.exitCode !== null || child.killed) {
        return { kernel, status: "stopped" };
      }

      const current = child;
      current.kill("SIGTERM");

      await new Promise((resolve) => {
        if (current.exitCode !== null) return resolve();
        const timer = setTimeout(() => {
          if (current.exitCode === null) current.kill("SIGKILL");
          resolve();
        }, 5000);
        current.once("exit", () => {
          clearTimeout(timer);
          resolve();
        });
      });

      child = null;
      startedAt = null;
      return { kernel, status: "stopped" };
    },

    async reload() {
      if (!reloadSignal) {
        throw new Error(kernel + " runtime does not support process reload");
      }
      if (!child || child.exitCode !== null || child.killed) {
        throw new Error(kernel + " runtime is not running");
      }
      child.kill(reloadSignal);
      return { kernel, status: "reloading", signal: reloadSignal };
    },

    async status() {
      const running = Boolean(child && child.exitCode === null && !child.killed);
      return {
        kernel,
        running,
        pid: running ? child.pid : null,
        startedAt: running ? startedAt : null,
      };
    },

    async logs(options = {}) {
      const limit = Number.isInteger(options.limit) && options.limit > 0
        ? options.limit
        : logLimit;
      return logs.slice(-limit);
    },
  });
}
