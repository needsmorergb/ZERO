/**
 * Packages the extension and uploads the ZIP to the zero-downloads R2 bucket.
 *
 * The ZIP is always named "ZERO-Setup.zip" so that
 * download.get-zero.xyz/ZERO-Setup.zip always serves the latest build.
 *
 * Usage:
 *   node scripts/deploy-r2.mjs          — prod build + package + upload
 *   node scripts/deploy-r2.mjs --skip-build  — package + upload (skip rebuild)
 */
import { execSync } from "child_process";
import {
  cpSync,
  mkdirSync,
  rmSync,
  existsSync,
  readFileSync,
  statSync,
} from "fs";
import { join, resolve } from "path";

const ROOT = resolve(import.meta.dirname, "..");
const STAGE = join(ROOT, ".store-build");
const manifest = JSON.parse(readFileSync(join(ROOT, "manifest.json"), "utf8"));
const version = manifest.version;
const ZIP_NAME = "ZERO-Setup.zip";
const R2_BUCKET = "zero-downloads";
const R2_KEY = "ZERO-Setup.zip";

const skipBuild = process.argv.includes("--skip-build");

// ── Step 1: Build ──────────────────────────────────────────────
if (!skipBuild) {
  console.log(`\n── Building prod bundles (v${version})...`);
  execSync("npm run build:prod", { cwd: ROOT, stdio: "inherit" });
} else {
  console.log(`\n── Skipping build (--skip-build)`);
}

// ── Step 2: Package ────────────────────────────────────────────
console.log(`\n── Packaging v${version}...`);

if (existsSync(STAGE)) rmSync(STAGE, { recursive: true });
mkdirSync(STAGE, { recursive: true });

const INCLUDE = [
  "manifest.json",
  "assets",
  "src/background.js",
  "src/content.bundle.axiom.js",
  "src/content.bundle.padre.js",
  "src/bridge.bundle.axiom.js",
  "src/bridge.bundle.padre.js",
  "src/page-bridge.js",
  "src/auto-fix.js",
  "src/professor.png",
  "src/popup",
  "src/modules",
  "src/services",
  "src/platforms",
  "src/inject",
  "src/terminals",
  "src/ui",
  "src/bridge.main.js",
  "src/content.source.js",
  "src/content.boot.js",
  "src/content.js",
  "src/force-opacity.css",
];

const EXCLUDE_PATTERNS = ["Screenshot "];

function shouldExclude(name) {
  return EXCLUDE_PATTERNS.some((p) => name.includes(p));
}

for (const entry of INCLUDE) {
  const src = join(ROOT, entry);
  const dest = join(STAGE, entry);

  if (!existsSync(src)) {
    console.warn(`  SKIP (not found): ${entry}`);
    continue;
  }

  cpSync(src, dest, {
    recursive: true,
    filter: (source) => !shouldExclude(source.split(/[/\\]/).pop()),
  });
  console.log(`  + ${entry}`);
}

const zipPath = join(ROOT, ZIP_NAME);
if (existsSync(zipPath)) rmSync(zipPath);

if (process.platform === "win32") {
  execSync(
    `powershell -NoProfile -Command "Compress-Archive -Path '${STAGE}\\*' -DestinationPath '${zipPath}' -Force"`,
    { stdio: "inherit" }
  );
} else {
  execSync(`cd "${STAGE}" && zip -r "${zipPath}" .`, { stdio: "inherit" });
}

const sizeKB = (statSync(zipPath).size / 1024).toFixed(0);
console.log(`  ${ZIP_NAME} created (${sizeKB} KB)`);

rmSync(STAGE, { recursive: true });

// ── Step 3: Upload to R2 ──────────────────────────────────────
console.log(`\n── Uploading to R2 (${R2_BUCKET}/${R2_KEY})...`);
execSync(
  `npx wrangler r2 object put --remote "${R2_BUCKET}/${R2_KEY}" --file="${zipPath}" --content-type="application/zip"`,
  { cwd: ROOT, stdio: "inherit" }
);

console.log(`\n✓ Deployed v${version} to R2`);
console.log(`  Key:       ${R2_BUCKET}/${R2_KEY}`);
console.log(`  Download:  https://download.get-zero.xyz/${R2_KEY}`);
