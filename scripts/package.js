/**
 * Firefox Extension Packaging Script (Pure Node.js)
 * Produces clean .zip and .xpi distributable archives in /dist without external dependencies.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const rootDir = path.join(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

// Read manifest to get version
const manifestPath = path.join(rootDir, 'manifest.json');
if (!fs.existsSync(manifestPath)) {
  console.error('Error: manifest.json not found!');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const version = manifest.version || '1.0.0';
const extName = 'jisho-kanji-lens';

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Folders & files to include in extension package
const includeItems = [
  'manifest.json',
  'background',
  'content',
  'popup',
  'options',
  'utils',
  'icons',
  'LICENSE',
  'README.md'
];

/**
 * Collect all file entries to zip
 */
function collectFiles(baseDir, relative = '') {
  let fileList = [];
  const fullPath = path.join(baseDir, relative);
  const stat = fs.statSync(fullPath);

  if (stat.isDirectory()) {
    const children = fs.readdirSync(fullPath);
    for (const child of children) {
      const childRelative = relative ? path.join(relative, child) : child;
      fileList = fileList.concat(collectFiles(baseDir, childRelative));
    }
  } else if (stat.isFile()) {
    // Exclude OS junk
    const basename = path.basename(fullPath);
    if (!basename.startsWith('.') && !basename.endsWith('.tmp')) {
      fileList.push({
        fullPath: fullPath,
        zipPath: relative.replace(/\\/g, '/')
      });
    }
  }
  return fileList;
}

// Simple standard ZIP Archive Creator (PKZip 2.0 format)
function buildZipBuffer(files) {
  const localFileHeaders = [];
  const centralDirHeaders = [];
  let currentOffset = 0;

  for (const f of files) {
    const data = fs.readFileSync(f.fullPath);
    const fileNameBuf = Buffer.from(f.zipPath, 'utf8');
    const crc = crc32(data);
    const uncompressedSize = data.length;

    // Use deflate compression
    const compressed = zlib.deflateRawSync(data);
    const compressedSize = compressed.length;

    // Local file header (30 bytes + name length)
    const localHeader = Buffer.alloc(30 + fileNameBuf.length);
    localHeader.writeUInt32LE(0x04034b50, 0); // Local header signature
    localHeader.writeUInt16LE(20, 4);         // Version needed: 2.0
    localHeader.writeUInt16LE(0, 6);          // General purpose bit flag
    localHeader.writeUInt16LE(8, 8);          // Compression method: 8 (Deflate)
    localHeader.writeUInt16LE(0, 10);         // Last mod time
    localHeader.writeUInt16LE(0, 12);         // Last mod date
    localHeader.writeUInt32LE(crc, 14);        // CRC-32
    localHeader.writeUInt32LE(compressedSize, 18); // Compressed size
    localHeader.writeUInt32LE(uncompressedSize, 22); // Uncompressed size
    localHeader.writeUInt16LE(fileNameBuf.length, 26); // File name length
    localHeader.writeUInt16LE(0, 28);         // Extra field length
    fileNameBuf.copy(localHeader, 30);

    const localEntry = Buffer.concat([localHeader, compressed]);
    localFileHeaders.push(localEntry);

    // Central directory header (46 bytes + name length)
    const cdHeader = Buffer.alloc(46 + fileNameBuf.length);
    cdHeader.writeUInt32LE(0x02014b50, 0); // Central directory signature
    cdHeader.writeUInt16LE(20, 4);         // Version made by
    cdHeader.writeUInt16LE(20, 6);         // Version needed
    cdHeader.writeUInt16LE(0, 8);          // Flags
    cdHeader.writeUInt16LE(8, 10);         // Compression method: 8
    cdHeader.writeUInt16LE(0, 12);         // Mod time
    cdHeader.writeUInt16LE(0, 14);         // Mod date
    cdHeader.writeUInt32LE(crc, 16);        // CRC-32
    cdHeader.writeUInt32LE(compressedSize, 20); // Compressed size
    cdHeader.writeUInt32LE(uncompressedSize, 24); // Uncompressed size
    cdHeader.writeUInt16LE(fileNameBuf.length, 28); // File name length
    cdHeader.writeUInt16LE(0, 30);         // Extra field length
    cdHeader.writeUInt16LE(0, 32);         // Comment length
    cdHeader.writeUInt16LE(0, 34);         // Disk start
    cdHeader.writeUInt16LE(0, 36);         // Internal attrs
    cdHeader.writeUInt32LE(0, 38);         // External attrs
    cdHeader.writeUInt32LE(currentOffset, 42); // Relative offset of local header
    fileNameBuf.copy(cdHeader, 46);

    centralDirHeaders.push(cdHeader);
    currentOffset += localEntry.length;
  }

  const centralDirBuffer = Buffer.concat(centralDirHeaders);
  const cdOffset = currentOffset;
  const cdSize = centralDirBuffer.length;

  // End of central directory record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // EOCD signature
  eocd.writeUInt16LE(0, 4);          // Disk number
  eocd.writeUInt16LE(0, 6);          // Start disk
  eocd.writeUInt16LE(files.length, 8); // Records on this disk
  eocd.writeUInt16LE(files.length, 10); // Total records
  eocd.writeUInt32LE(cdSize, 12);    // Central dir size
  eocd.writeUInt32LE(cdOffset, 16);  // Central dir offset
  eocd.writeUInt16LE(0, 20);         // Comment length

  return Buffer.concat([...localFileHeaders, centralDirBuffer, eocd]);
}

// CRC32 calculation helper
const crcTable = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

// Execute packaging
console.log(`📦 Packaging ${extName} v${version} for Firefox...`);

let allFiles = [];
for (const item of includeItems) {
  const itemPath = path.join(rootDir, item);
  if (fs.existsSync(itemPath)) {
    allFiles = allFiles.concat(collectFiles(rootDir, item));
  }
}

console.log(`Found ${allFiles.length} files to package.`);

const zipBuffer = buildZipBuffer(allFiles);

const zipFileName = `${extName}-v${version}.zip`;
const xpiFileName = `${extName}-v${version}.xpi`;

fs.writeFileSync(path.join(distDir, zipFileName), zipBuffer);
fs.writeFileSync(path.join(distDir, xpiFileName), zipBuffer);

console.log(`\n🎉 Success! Extension packages created in /dist:`);
console.log(`   - dist/${zipFileName} (${(zipBuffer.length / 1024).toFixed(1)} KB)`);
console.log(`   - dist/${xpiFileName} (${(zipBuffer.length / 1024).toFixed(1)} KB)`);
console.log(`\nReady for Firefox installation via 'about:debugging' or AMO upload.`);
