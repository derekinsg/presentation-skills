#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  access,
  copyFile,
  mkdir,
  readFile,
  readdir,
  rename,
  stat,
  writeFile
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE_EXTENSIONS = new Set(['.pdf', '.ppt', '.pptx']);
const EXTRACTION_ROOT = '.animated-html-deck-extractions';
const DEFAULT_DPI = 144;

function usage() {
  return [
    'Usage: node animated-html-deck/scripts/extract-source-pages.mjs [source.pdf|source.pptx|source.ppt]',
    '',
    'When no source is supplied, scans only the current working directory for one',
    '.pdf, .ppt, or .pptx file. Renders every page to PNG visual references and',
    'writes a manifest.json into .animated-html-deck-extractions/.'
  ].join('\n');
}

function fail(message, details = '') {
  console.error(message);
  if (details) console.error(details);
  process.exit(1);
}

function extensionOf(filePath) {
  return path.extname(filePath).toLowerCase();
}

function sourceTypeFor(filePath) {
  const extension = extensionOf(filePath);
  if (extension === '.pdf') return 'pdf';
  if (extension === '.ppt') return 'ppt';
  if (extension === '.pptx') return 'pptx';
  return null;
}

async function pathExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function findRootSource(rootDir) {
  const entries = await readdir(rootDir, { withFileTypes: true });
  const candidates = entries
    .filter(entry => entry.isFile() && SOURCE_EXTENSIONS.has(extensionOf(entry.name)))
    .map(entry => path.resolve(rootDir, entry.name))
    .sort((a, b) => path.basename(a).localeCompare(path.basename(b)));

  if (candidates.length === 0) {
    fail(
      'No source deck found in the current directory.',
      'Put exactly one .pdf, .ppt, or .pptx file in the project root, or pass a source path explicitly.'
    );
  }

  if (candidates.length > 1) {
    fail(
      'Multiple source decks found in the current directory.',
      [
        'Pass the intended file explicitly:',
        ...candidates.map(candidate => `  - ${path.basename(candidate)}`)
      ].join('\n')
    );
  }

  return candidates[0];
}

async function resolveSourcePath(inputPath, rootDir) {
  if (!inputPath) return findRootSource(rootDir);
  const resolved = path.resolve(rootDir, inputPath);
  const info = await stat(resolved).catch(() => null);
  if (!info || !info.isFile()) fail(`Source file does not exist: ${resolved}`);
  if (!SOURCE_EXTENSIONS.has(extensionOf(resolved))) {
    fail('Unsupported source type.', 'Use a .pdf, .ppt, or .pptx file.');
  }
  return resolved;
}

function commandOutput(command, args = []) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  if (result.status !== 0) return null;
  return result.stdout.trim();
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function findCommand(candidates) {
  for (const candidate of candidates) {
    if (path.isAbsolute(candidate)) {
      const result = spawnSync(candidate, ['--version'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe']
      });
      if (result.status === 0) return candidate;
      continue;
    }

    const found = commandOutput(process.env.SHELL || '/bin/sh', ['-lc', `command -v ${shellQuote(candidate)}`]);
    if (found) return found.split('\n')[0];
  }
  return null;
}

function createExtractionId(sourcePath) {
  const basename = path.basename(sourcePath, path.extname(sourcePath))
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'source-deck';
  const hash = createHash('sha1')
    .update(`${sourcePath}:${Date.now()}:${Math.random()}`)
    .digest('hex')
    .slice(0, 8);
  return `${basename}-${hash}`;
}

async function prepareOutputDir(rootDir, sourcePath) {
  const outputDir = path.resolve(rootDir, EXTRACTION_ROOT, createExtractionId(sourcePath));
  const pagesDir = path.join(outputDir, 'pages');
  await mkdir(pagesDir, { recursive: true });
  return { outputDir, pagesDir };
}

async function convertOfficeToPdf(sourcePath, outputDir) {
  const soffice = findCommand([
    'soffice',
    'libreoffice',
    '/Applications/LibreOffice.app/Contents/MacOS/soffice'
  ]);

  if (!soffice) {
    fail(
      'Cannot convert PPT/PPTX because LibreOffice/soffice was not found.',
      'Export the presentation as PDF and run this script on the PDF, or install LibreOffice so PPT/PPTX can be converted automatically.'
    );
  }

  const conversionDir = path.join(outputDir, 'converted');
  await mkdir(conversionDir, { recursive: true });

  const result = spawnSync(soffice, [
    '--headless',
    '--convert-to',
    'pdf',
    '--outdir',
    conversionDir,
    sourcePath
  ], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });

  if (result.status !== 0) {
    fail(
      'LibreOffice failed to convert the source presentation to PDF.',
      [result.stdout, result.stderr].filter(Boolean).join('\n')
    );
  }

  const expected = path.join(conversionDir, `${path.basename(sourcePath, path.extname(sourcePath))}.pdf`);
  if (await pathExists(expected)) return expected;

  const converted = (await readdir(conversionDir))
    .filter(name => extensionOf(name) === '.pdf')
    .map(name => path.join(conversionDir, name));

  if (converted.length === 0) {
    fail('LibreOffice conversion completed but no PDF output was found.');
  }

  return converted[0];
}

async function copyPdfToWorkingFile(sourcePath, outputDir) {
  const workingPdf = path.join(outputDir, 'source.pdf');
  await copyFile(sourcePath, workingPdf);
  return workingPdf;
}

function naturalPageNumber(fileName) {
  const match = fileName.match(/-(\d+)\.png$/);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

async function renderPdfToPng(pdfPath, pagesDir) {
  const pdftoppm = findCommand(['pdftoppm']);
  if (!pdftoppm) {
    fail(
      'Cannot render PDF pages because pdftoppm was not found.',
      'Install Poppler, or make sure pdftoppm is available on PATH.'
    );
  }

  const rawPrefix = path.join(pagesDir, 'raw-page');
  const result = spawnSync(pdftoppm, [
    '-png',
    '-r',
    String(DEFAULT_DPI),
    pdfPath,
    rawPrefix
  ], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });

  if (result.status !== 0) {
    fail('pdftoppm failed to render the PDF.', [result.stdout, result.stderr].filter(Boolean).join('\n'));
  }

  const rendered = (await readdir(pagesDir))
    .filter(name => /^raw-page-\d+\.png$/.test(name))
    .sort((a, b) => naturalPageNumber(a) - naturalPageNumber(b));

  if (rendered.length === 0) {
    fail('PDF rendering completed but no page PNG files were produced.');
  }

  const pages = [];
  for (let i = 0; i < rendered.length; i += 1) {
    const targetName = `page-${String(i + 1).padStart(3, '0')}.png`;
    const source = path.join(pagesDir, rendered[i]);
    const target = path.join(pagesDir, targetName);
    await rename(source, target);
    const dimensions = await readPngDimensions(target);
    pages.push({
      index: i + 1,
      imagePath: target,
      width: dimensions.width,
      height: dimensions.height
    });
  }

  return pages;
}

async function readPngDimensions(filePath) {
  const buffer = await readFile(filePath);
  const signature = buffer.subarray(0, 8).toString('hex');
  if (signature !== '89504e470d0a1a0a') {
    fail(`Rendered page is not a valid PNG: ${filePath}`);
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(usage());
    return;
  }
  if (args.length > 1) fail(usage());

  const rootDir = process.cwd();
  const sourcePath = await resolveSourcePath(args[0], rootDir);
  const sourceType = sourceTypeFor(sourcePath);
  const { outputDir, pagesDir } = await prepareOutputDir(rootDir, sourcePath);
  const warnings = [];

  let pdfPath;
  if (sourceType === 'pdf') {
    pdfPath = await copyPdfToWorkingFile(sourcePath, outputDir);
  } else {
    pdfPath = await convertOfficeToPdf(sourcePath, outputDir);
    warnings.push('PPT/PPTX pages were rendered through LibreOffice PDF conversion; inspect visual references for conversion differences.');
  }

  const pages = await renderPdfToPng(pdfPath, pagesDir);
  const manifest = {
    sourcePath,
    sourceType,
    pageCount: pages.length,
    pages,
    warnings
  };
  const manifestPath = path.join(outputDir, 'manifest.json');
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}${os.EOL}`);

  console.log(JSON.stringify({
    manifestPath,
    outputDir,
    sourcePath,
    sourceType,
    pageCount: pages.length,
    warnings
  }, null, 2));
}

main().catch(error => {
  fail(error.message || String(error));
});
