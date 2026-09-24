import { UpstreamKernelRegistry } from "../src/core/kernel-registry.js";

let drift = false;
for (const [kernel, entry] of Object.entries(UpstreamKernelRegistry)) {
  const response = await fetch(`https://api.github.com/repos/${entry.repository}/releases/latest`, {
    headers: { accept: "application/vnd.github+json", "user-agent": "Nexus-upstream-check" }
  });
  if (!response.ok) throw new Error(`${kernel}: GitHub API returned ${response.status}`);
  const release = await response.json();
  const latest = String(release.tag_name || "").replace(/^v/, "");
  const changed = latest !== entry.stable;
  if (changed) drift = true;
  console.log(`${kernel}: configured=${entry.stable} upstream=${latest}${changed ? " [UPDATE AVAILABLE]" : " [OK]"}`);
}
if (drift) {
  console.error("\nNexus upstream baseline drift detected. Review release notes, schemas, protocol changes, adapters, fixtures and tests before updating.");
  process.exitCode = 2;
}
