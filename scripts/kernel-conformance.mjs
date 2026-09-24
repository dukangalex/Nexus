import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import yaml from "js-yaml";
import { compileUnifiedConfig } from "../src/core/config-compiler.js";
import { Kernels } from "../src/core/model.js";

const fixtures = {
  [Kernels.MIHOMO]: {
    kernel: Kernels.MIHOMO,
    nodes: [{
      id: "mihomo-vless-reality",
      protocol: "vless",
      server: "example.com",
      port: 443,
      uuid: "00000000-0000-0000-0000-000000000001",
      tls: {
        enabled: true,
        serverName: "example.com",
        fingerprint: "chrome",
        reality: { enabled: true, publicKey: "test-public-key", shortId: "01234567" }
      }
    }]
  },
  [Kernels.SING_BOX]: {
    kernel: Kernels.SING_BOX,
    nodes: [{
      id: "singbox-vless-reality",
      protocol: "vless",
      server: "example.com",
      port: 443,
      uuid: "00000000-0000-0000-0000-000000000001",
      tls: {
        enabled: true,
        serverName: "example.com",
        fingerprint: "chrome",
        reality: { enabled: true, publicKey: "test-public-key", shortId: "01234567" }
      },
      transport: { type: "grpc", serviceName: "proxy" }
    }]
  },
  [Kernels.XRAY]: {
    kernel: Kernels.XRAY,
    nodes: [{
      id: "xray-vless-reality",
      protocol: "vless",
      server: "example.com",
      port: 443,
      uuid: "00000000-0000-0000-0000-000000000001",
      tls: {
        enabled: true,
        serverName: "example.com",
        fingerprint: "chrome",
        reality: { enabled: true, publicKey: "test-public-key", shortId: "01234567" }
      },
      transport: { type: "grpc", serviceName: "proxy" }
    }]
  }
};

function command(bin, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    child.stdout.on("data", chunk => { stdout += chunk; });
    child.stderr.on("data", chunk => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", code => resolve({ code, stdout, stderr }));
  });
}

const binaries = {
  [Kernels.MIHOMO]: process.env.NEXUS_MIHOMO_BIN,
  [Kernels.SING_BOX]: process.env.NEXUS_SING_BOX_BIN,
  [Kernels.XRAY]: process.env.NEXUS_XRAY_BIN
};
const requireBinaries = process.argv.includes("--require-binaries");
const dir = await mkdtemp(join(tmpdir(), "nexus-kernel-conformance-"));
const report = [];

try {
  for (const kernel of Object.values(Kernels)) {
    const compiled = compileUnifiedConfig(fixtures[kernel]);
    const path = join(dir, kernel === Kernels.MIHOMO ? "config.yaml" : kernel + ".json");
    await writeFile(path, kernel === Kernels.MIHOMO ? yaml.dump(compiled.config) : JSON.stringify(compiled.config, null, 2));

    const bin = binaries[kernel];
    if (!bin) {
      report.push({ kernel, status: "not-run", reason: "binary not configured" });
      continue;
    }

    const args = kernel === Kernels.MIHOMO
      ? ["-t", "-f", path]
      : kernel === Kernels.SING_BOX
        ? ["check", "-c", path]
        : ["run", "-test", "-c", path];

    const result = await command(bin, args);
    report.push({ kernel, status: result.code === 0 ? "passed" : "failed", exitCode: result.code, stdout: result.stdout.trim(), stderr: result.stderr.trim() });
    if (result.code !== 0) throw new Error(kernel + " runtime validation failed");
  }
} finally {
  await rm(dir, { recursive: true, force: true });
}

console.log(JSON.stringify(report, null, 2));
if (requireBinaries && report.some(item => item.status === "not-run")) {
  throw new Error("runtime conformance requires all three kernel binaries");
}
