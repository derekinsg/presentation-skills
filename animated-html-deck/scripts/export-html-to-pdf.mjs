#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { access, mkdir, readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const HTML_EXTENSION = '.html';

function usage() {
  return [
    'Usage: node animated-html-deck/scripts/export-html-to-pdf.mjs [deck.html] [output.pdf]',
    '',
    'When no HTML source is supplied, scans only the current working directory',
    'for exactly one .html deck. Exports a slide-only PDF using local Chrome/Chromium.'
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

async function fileExists(filePath) {
  try {
    const info = await stat(filePath);
    return info.isFile();
  } catch {
    return false;
  }
}

async function isExecutableOrApp(filePath) {
  if (!await fileExists(filePath)) return false;
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function findRootHtml(rootDir) {
  const entries = await readdir(rootDir, { withFileTypes: true });
  const candidates = entries
    .filter(entry => entry.isFile() && extensionOf(entry.name) === HTML_EXTENSION)
    .map(entry => path.resolve(rootDir, entry.name))
    .sort((a, b) => path.basename(a).localeCompare(path.basename(b)));

  if (candidates.length === 0) {
    fail(
      'No HTML deck found in the current directory.',
      'Put exactly one .html deck in the project root, or pass a deck path explicitly.'
    );
  }

  if (candidates.length > 1) {
    fail(
      'Multiple HTML decks found in the current directory.',
      [
        'Pass the intended HTML file explicitly:',
        ...candidates.map(candidate => `  - ${path.basename(candidate)}`)
      ].join('\n')
    );
  }

  return candidates[0];
}

async function resolveInputPath(inputPath, rootDir) {
  if (!inputPath) return findRootHtml(rootDir);
  const resolved = path.resolve(rootDir, inputPath);
  const info = await stat(resolved).catch(() => null);
  if (!info || !info.isFile()) fail(`HTML deck does not exist: ${resolved}`);
  if (extensionOf(resolved) !== HTML_EXTENSION) {
    fail('Unsupported input type.', 'Use a .html deck file.');
  }
  return resolved;
}

function resolveOutputPath(inputPath, outputArg, rootDir) {
  const outputPath = outputArg
    ? path.resolve(rootDir, outputArg)
    : path.join(path.dirname(inputPath), `${path.basename(inputPath, path.extname(inputPath))}.pdf`);

  if (extensionOf(outputPath) !== '.pdf') {
    fail('Unsupported output type.', 'Output path must end with .pdf.');
  }

  return outputPath;
}

function commandOutput(command, args = [], env = process.env) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  if (result.status !== 0) return null;
  return result.stdout.trim();
}

function readPdfPageCount(pdfPath) {
  const result = spawnSync(process.env.SHELL || '/bin/sh', ['-lc', `pdfinfo ${shellQuote(pdfPath)} 2>/dev/null`], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  if (result.status !== 0) return null;
  const match = result.stdout.match(/^Pages:\s*(\d+)\s*$/m);
  return match ? Number.parseInt(match[1], 10) : null;
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

async function chromePathFromApp(appPath) {
  const executable = path.join(appPath, 'Contents', 'MacOS', path.basename(appPath, '.app'));
  return await isExecutableOrApp(executable) ? executable : null;
}

async function normalizeBrowserCandidate(candidate) {
  if (!candidate) return null;
  const trimmed = candidate.trim();
  if (!trimmed) return null;
  if (trimmed.endsWith('.app')) return chromePathFromApp(trimmed);
  return await isExecutableOrApp(trimmed) ? trimmed : null;
}

async function findBrowser() {
  if (process.env.CHROME_PATH !== undefined && process.env.CHROME_PATH.trim() !== '') {
    const explicit = await normalizeBrowserCandidate(process.env.CHROME_PATH);
    if (!explicit) {
      fail(
        'CHROME_PATH is set but does not point to a usable Chrome/Chromium executable.',
        `CHROME_PATH=${process.env.CHROME_PATH}`
      );
    }
    return explicit;
  }

  const pathCommands = [
    'google-chrome',
    'google-chrome-stable',
    'chromium',
    'chromium-browser',
    'chrome',
    'msedge',
    'microsoft-edge'
  ];

  for (const command of pathCommands) {
    const found = commandOutput(process.env.SHELL || '/bin/sh', ['-lc', `command -v ${shellQuote(command)}`]);
    const normalized = await normalizeBrowserCandidate(found);
    if (normalized) return normalized;
  }

  const appCandidates = [
    '/Applications/Google Chrome.app',
    '/Applications/Chromium.app',
    '/Applications/Microsoft Edge.app'
  ];

  for (const appPath of appCandidates) {
    const normalized = await normalizeBrowserCandidate(appPath);
    if (normalized) return normalized;
  }

  fail(
    'No compatible Chrome/Chromium browser was found.',
    'Install Chrome/Chromium, add it to PATH, or set CHROME_PATH to the browser executable.'
  );
}

function countSlides(html) {
  return [...html.matchAll(/<section\b[^>]*class=["'][^"']*\bslide\b/gi)].length;
}

async function exportPdf(browserPath, sourcePath, outputPath) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  const sourceUrl = pathToFileURL(sourcePath).href;
  const result = spawnSync(browserPath, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--allow-file-access-from-files',
    '--run-all-compositor-stages-before-draw',
    '--window-size=1600,900',
    '--virtual-time-budget=1000',
    '--no-pdf-header-footer',
    `--print-to-pdf=${outputPath}`,
    sourceUrl
  ], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });

  if (result.status !== 0) {
    fail(
      'Chrome/Chromium failed to export the PDF.',
      [result.stdout, result.stderr].filter(Boolean).join('\n')
    );
  }

  if (!await fileExists(outputPath)) {
    fail('Chrome/Chromium finished but no PDF file was produced.', outputPath);
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(usage());
    return;
  }
  if (args.length > 2) fail(usage());

  const rootDir = process.cwd();
  const sourcePath = await resolveInputPath(args[0], rootDir);
  const outputPath = resolveOutputPath(sourcePath, args[1], rootDir);
  const html = await readFile(sourcePath, 'utf8');
  const pageCount = countSlides(html);
  const browserPath = await findBrowser();

  await exportPdf(browserPath, sourcePath, outputPath);
  const pdfPageCount = readPdfPageCount(outputPath);

  if (pdfPageCount !== null && pageCount > 0 && pdfPageCount < pageCount) {
    fail(
      'Exported PDF has fewer pages than the HTML deck.',
      [
        `HTML slides: ${pageCount}`,
        `PDF pages: ${pdfPageCount}`,
        'Check the deck print CSS: printable .slides containers must not clip slides, and each .slide should break after a page.'
      ].join('\n')
    );
  }

  console.log(JSON.stringify({
    sourcePath,
    outputPath,
    browserPath,
    pageCount,
    pdfPageCount
  }, null, 2));
}

main().catch(error => {
  fail(error.message || String(error));
});
