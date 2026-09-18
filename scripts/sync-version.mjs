import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const versionPath = path.join(root, 'VERSION');
const version = fs.readFileSync(versionPath, 'utf8').trim();
const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
if (!match) throw new Error('VERSION must use major.minor.patch format');

const [, major, minor, patch] = match;
const display = `V${major}.${minor.padStart(2, '0')}.${patch}`;
const packagePath = path.join(root, 'desktop', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
packageJson.version = version;
packageJson.build.portable.artifactName = `Beef Board Configurator ${display}.exe`;
const packageText = JSON.stringify(packageJson, null, 2) + '\n';

const fwVersionPath = path.join(root, 'fw', 'version.mk');
const fwVersionText =
  '# Generated from ../VERSION by scripts/sync-version.mjs\n' +
  `FW_VERSION_MAJOR ?= ${major}\n` +
  `FW_VERSION_MINOR ?= ${minor}\n` +
  `FW_VERSION_PATCH ?= ${patch}\n`;

if (process.argv.includes('--check')) {
  let ok = true;
  if (fs.readFileSync(packagePath, 'utf8') !== packageText) {
    console.error('desktop/package.json is not synchronized with VERSION');
    ok = false;
  }
  if (!fs.existsSync(fwVersionPath) || fs.readFileSync(fwVersionPath, 'utf8') !== fwVersionText) {
    console.error('fw/version.mk is not synchronized with VERSION');
    ok = false;
  }
  if (!ok) process.exit(1);
  console.log(`Version files are synchronized: ${display}`);
} else {
  fs.writeFileSync(packagePath, packageText);
  fs.writeFileSync(fwVersionPath, fwVersionText);
  console.log(`Synchronized ${display}`);
}
