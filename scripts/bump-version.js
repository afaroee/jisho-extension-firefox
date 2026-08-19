/**
 * Semantic Version Bumping & Release Automation Script
 * Usage: node scripts/bump-version.js [patch|minor|major]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.join(__dirname, '..');
const packageJsonPath = path.join(rootDir, 'package.json');
const manifestJsonPath = path.join(rootDir, 'manifest.json');

const bumpType = process.argv[2] || 'patch';

if (!['patch', 'minor', 'major'].includes(bumpType)) {
  console.error(`Invalid bump type: "${bumpType}". Must be "patch", "minor", or "major".`);
  process.exit(1);
}

// 1. Read current versions
const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const manifest = JSON.parse(fs.readFileSync(manifestJsonPath, 'utf8'));

const currentVer = pkg.version || '1.0.0';
const parts = currentVer.split('.').map(n => parseInt(n, 10));

if (parts.length !== 3 || parts.some(isNaN)) {
  console.error(`Invalid current version string: ${currentVer}`);
  process.exit(1);
}

let [major, minor, patch] = parts;

if (bumpType === 'patch') patch += 1;
if (bumpType === 'minor') { minor += 1; patch = 0; }
if (bumpType === 'major') { major += 1; minor = 0; patch = 0; }

const nextVer = `${major}.${minor}.${patch}`;

console.log(`\n🚀 Bumping version: v${currentVer} -> v${nextVer} (${bumpType})`);

// 2. Update package.json & manifest.json
pkg.version = nextVer;
manifest.version = nextVer;

fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
fs.writeFileSync(manifestJsonPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

console.log('✅ Updated package.json and manifest.json');

// 3. Package extension
try {
  console.log('\n📦 Re-packaging extension...');
  require('./package.js');
} catch (e) {
  console.warn('Packaging step error:', e);
}

// 4. Git commit & tag if git is available
try {
  const isGit = fs.existsSync(path.join(rootDir, '.git'));
  if (isGit) {
    execSync('git add package.json manifest.json', { cwd: rootDir, stdio: 'inherit' });
    execSync(`git commit -m "chore(release): bump version to v${nextVer}"`, { cwd: rootDir, stdio: 'inherit' });
    execSync(`git tag -a "v${nextVer}" -m "Release v${nextVer}"`, { cwd: rootDir, stdio: 'inherit' });
    console.log(`\n🏷️ Created git commit and tag: v${nextVer}`);
    console.log(`To push to remote: git push && git push --tags`);
  }
} catch (gitErr) {
  console.warn('Git commit/tag skipped (not a git repository or git error).', gitErr.message);
}

console.log(`\n✨ Version v${nextVer} release completed successfully!`);
