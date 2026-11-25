import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const rootDir = process.cwd();
const outDir = path.join(rootDir, "out");
const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));

if (!fs.existsSync(outDir)) {
  console.error("Output directory 'out' not found. Run 'next build' first.");
  process.exit(1);
}

const EXCLUDE_FILES = new Set([
  "/worker.js",
  "/version.json",
  "/asset-manifest.json",
  "/404.html",
]);

function walk(dir, baseDir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walk(fullPath, baseDir));
    } else if (entry.isFile()) {
      const rel = "/" + path.relative(baseDir, fullPath).split(path.sep).join("/");
      if (!EXCLUDE_FILES.has(rel) && !rel.endsWith(".txt")) {
        results.push(rel);
      }
    }
  }
  return results;
}

const assets = walk(outDir, outDir).sort();
if (!assets.includes("/")) {
  assets.unshift("/");
}

const hash = crypto
  .createHash("sha256")
  .update(pkg.version || "0.0.0")
  .update(assets.join("\n"))
  .digest("hex")
  .slice(0, 12);

const version = `${pkg.version || "0.0.0"}-${hash}`;
const generatedAt = new Date().toISOString();

fs.writeFileSync(
  path.join(outDir, "version.json"),
  JSON.stringify({ version, generatedAt }, null, 2) + "\n",
  "utf8"
);

fs.writeFileSync(
  path.join(outDir, "asset-manifest.json"),
  JSON.stringify({ version, generatedAt, assets }, null, 2) + "\n",
  "utf8"
);

const workerOutPath = path.join(outDir, "worker.js");
if (fs.existsSync(workerOutPath)) {
  const workerSrc = fs.readFileSync(workerOutPath, "utf8");
  fs.writeFileSync(
    workerOutPath,
    workerSrc.replace(/__APP_VERSION__/g, version),
    "utf8"
  );
}

console.log(`[sw-manifest] Generated manifest for version ${version} (${assets.length} assets)`);
