/**
 * Packages the extension into a clean ZIP for Chrome Web Store submission.
 * Only includes files needed by the extension runtime + source for reviewer reference.
 *
 * Usage: node scripts/package-store.mjs
 */
import { execSync } from 'child_process';
import { cpSync, mkdirSync, rmSync, existsSync, readFileSync, statSync } from 'fs';
import { join, resolve } from 'path';

const ROOT = resolve(import.meta.dirname, '..');
const STAGE = join(ROOT, '.store-build');
const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8'));
const version = manifest.version;
const ZIP_NAME = `zero-paper-trading-v${version}.zip`;

console.log(`Packaging ZERO v${version} for Chrome Web Store...\n`);

// Clean previous staging
if (existsSync(STAGE)) rmSync(STAGE, { recursive: true });
mkdirSync(STAGE, { recursive: true });

// Files/dirs to include (relative to ROOT)
const INCLUDE = [
  'manifest.json',
  'assets',
  'src/background.js',
  'src/content.bundle.axiom.js',
  'src/content.bundle.padre.js',
  'src/bridge.bundle.axiom.js',
  'src/bridge.bundle.padre.js',
  'src/page-bridge.js',
  'src/auto-fix.js',
  'src/professor.png',
  'src/popup',
  // Source code for reviewer reference (helps avoid rejection for "unreadable" bundles)
  'src/modules',
  'src/services',
  'src/platforms',
  'src/inject',
  'src/terminals',
  'src/ui',
  'src/bridge.main.js',
  'src/content.source.js',
  'src/content.boot.js',
  'src/content.js',
  'src/force-opacity.css',
];

// Files to exclude even if inside included dirs
const EXCLUDE_PATTERNS = [
  'Screenshot ',  // screenshots go to dashboard, not ZIP
];

function shouldExclude(name) {
  return EXCLUDE_PATTERNS.some(p => name.includes(p));
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

// Create ZIP using PowerShell (Windows) or zip (Unix)
const zipPath = join(ROOT, ZIP_NAME);
if (existsSync(zipPath)) rmSync(zipPath);

try {
  if (process.platform === 'win32') {
    execSync(
      `powershell -NoProfile -Command "Compress-Archive -Path '${STAGE}\\*' -DestinationPath '${zipPath}' -Force"`,
      { stdio: 'inherit' }
    );
  } else {
    execSync(`cd "${STAGE}" && zip -r "${zipPath}" .`, { stdio: 'inherit' });
  }
  console.log(`\nDone! ${ZIP_NAME} created (${(statSync(zipPath).size / 1024).toFixed(0)} KB)`);
} catch (e) {
  // Fallback: just report staging dir
  console.log(`\nStaging directory ready at: ${STAGE}`);
  console.log('Create ZIP manually from that directory.');
}

// Cleanup staging
rmSync(STAGE, { recursive: true });

console.log(`\nSubmit ${ZIP_NAME} at: https://chrome.google.com/webstore/devconsole`);
