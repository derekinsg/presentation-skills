#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const mimeByExtension = new Map([
  ['.apng', 'image/apng'],
  ['.avif', 'image/avif'],
  ['.gif', 'image/gif'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp']
]);

function usage() {
  console.error('Usage: node scripts/image-to-data-uri.mjs /path/to/image.png');
}

const inputPath = process.argv[2];

if (!inputPath) {
  usage();
  process.exit(1);
}

const extension = path.extname(inputPath).toLowerCase();
const mime = mimeByExtension.get(extension);

if (!mime) {
  console.error('Unsupported image type: ' + (extension || 'unknown'));
  process.exit(1);
}

const bytes = await readFile(inputPath);
process.stdout.write('data:' + mime + ';base64,' + bytes.toString('base64'));
