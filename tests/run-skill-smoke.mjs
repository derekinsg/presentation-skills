#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, realpath, stat, writeFile } from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const skills = [
  {
    name: 'animated-html-deck',
    displayName: 'Animated HTML Deck',
    files: [
      'SKILL.md',
      'agents/openai.yaml',
      'assets/single-file-deck-template.html',
      'references/deck-generation-rubric.md',
      'references/launcher-design-rationale.md',
      'references/launcher-payload.schema.json',
      'references/launcher-wizard-spec.md',
      'scripts/image-to-data-uri.mjs',
      'scripts/extract-source-pages.mjs',
      'scripts/normalize-launcher-payload.mjs',
      'scripts/presenter-server.mjs'
    ]
  },
  {
    name: 'style-polish',
    displayName: 'Style Polish',
    files: [
      'SKILL.md',
      'agents/openai.yaml',
      'references/style-selection-guide.md',
      'scripts/build-style-catalog.mjs',
      'scripts/resolve-style-theme.mjs',
      'styles/style-catalog.json',
      'vendor/awesome-design-md/LICENSE'
    ]
  },
  {
    name: 'speaker-polish',
    displayName: 'Speaker Polish',
    files: [
      'SKILL.md',
      'agents/openai.yaml'
    ]
  }
];

const checks = [];

function test(name, fn) {
  checks.push({ name, fn });
}

function repoPath(...parts) {
  return path.join(repoRoot, ...parts);
}

function parseFrontmatter(markdown) {
  assert.ok(markdown.startsWith('---\n'), 'SKILL.md must start with YAML frontmatter');
  const end = markdown.indexOf('\n---', 4);
  assert.ok(end > 0, 'SKILL.md frontmatter must close with ---');
  const raw = markdown.slice(4, end).trim();
  const result = {};
  for (const line of raw.split('\n')) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (match) result[match[1]] = match[2].replace(/^["']|["']$/g, '').trim();
  }
  return result;
}

async function fileExists(filePath) {
  try {
    const info = await stat(filePath);
    return info.isFile();
  } catch {
    return false;
  }
}

async function pathExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function walk(root, ignoredDirs = new Set()) {
  const found = [];
  async function visit(current) {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      const relative = path.relative(repoRoot, full);
      if (entry.isDirectory()) {
        if (ignoredDirs.has(entry.name) || ignoredDirs.has(relative)) continue;
        await visit(full);
      } else if (entry.isFile()) {
        found.push(full);
      }
    }
  }
  await visit(root);
  return found;
}

function extractReferencedResources(markdown) {
  const refs = new Set();
  const backtickPattern = /`([^`]+)`/g;
  const resourceTokenPattern = /(?:\.\.\/)?(?:animated-html-deck\/|style-polish\/|speaker-polish\/)?(?:SKILL\.md|(?:assets|scripts|references|styles|vendor|agents)\/[A-Za-z0-9._/@-]+)/g;
  for (const match of markdown.matchAll(backtickPattern)) {
    for (const token of match[1].matchAll(resourceTokenPattern)) {
      refs.add(token[0].replace(/[),.;:]$/g, ''));
    }
  }
  return [...refs];
}

function runNode(relativeScript, args = [], options = {}) {
  const result = spawnSync('node', [repoPath(relativeScript), ...args], {
    cwd: options.cwd || repoRoot,
    input: options.input,
    encoding: 'utf8',
    timeout: options.timeout || 10000
  });
  if (options.expectFailure) {
    assert.notEqual(result.status, 0, `${relativeScript} should fail for this case`);
    return result;
  }
  assert.equal(
    result.status,
    0,
    `${relativeScript} failed\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`
  );
  return result;
}

function commandExists(command) {
  const result = spawnSync(process.env.SHELL || '/bin/sh', ['-lc', `command -v ${command}`], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  return result.status === 0 && result.stdout.trim().length > 0;
}

function buildTinyPdf(pageCount = 2) {
  const objects = new Map();
  const kids = [];
  let nextObjectId = 4;

  objects.set(1, '<< /Type /Catalog /Pages 2 0 R >>');
  objects.set(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');

  for (let page = 1; page <= pageCount; page += 1) {
    const pageObjectId = nextObjectId;
    const contentObjectId = nextObjectId + 1;
    nextObjectId += 2;
    kids.push(`${pageObjectId} 0 R`);
    const stream = `BT /F1 18 Tf 36 80 Td (Page ${page}) Tj ET`;
    objects.set(pageObjectId, [
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 120]',
      '/Resources << /Font << /F1 3 0 R >> >>',
      `/Contents ${contentObjectId} 0 R >>`
    ].join(' '));
    objects.set(contentObjectId, `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
  }

  objects.set(2, `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pageCount} >>`);

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const id of [...objects.keys()].sort((a, b) => a - b)) {
    offsets[id] = Buffer.byteLength(pdf, 'utf8');
    pdf += `${id} 0 obj\n${objects.get(id)}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.size + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let id = 1; id <= objects.size; id += 1) {
    pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += [
    'trailer',
    `<< /Size ${objects.size + 1} /Root 1 0 R >>`,
    'startxref',
    String(xrefOffset),
    '%%EOF',
    ''
  ].join('\n');

  return pdf;
}

function parseJsonOutput(result, label) {
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`${label} did not emit valid JSON: ${error.message}\n${result.stdout}`);
  }
}

function resolveSkillResourceRef(skillRoot, ref) {
  if (/^(?:animated-html-deck|style-polish|speaker-polish)\//.test(ref)) {
    return path.resolve(repoRoot, ref);
  }
  return path.resolve(skillRoot, ref);
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => {
        body += chunk;
      });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy(new Error(`Timed out fetching ${url}`));
    });
  });
}

async function startPresenterSmoke() {
  const deckPath = repoPath('animated-html-deck', 'assets', 'single-file-deck-template.html');
  const server = spawn('node', [
    repoPath('animated-html-deck', 'scripts', 'presenter-server.mjs'),
    deckPath,
    '--port',
    '0',
    '--host',
    '127.0.0.1',
    '--deck-host',
    'local',
    '--no-open'
  ], {
    cwd: repoRoot,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let stdout = '';
  let stderr = '';

  try {
    const deckUrl = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Presenter server did not report a deck URL.\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`));
      }, 7000);

      server.stdout.on('data', chunk => {
        stdout += chunk.toString();
        const match = stdout.match(/Computer PPT:\s*(http:\/\/[^\s]+)/);
        if (match) {
          clearTimeout(timeout);
          resolve(match[1]);
        }
      });

      server.stderr.on('data', chunk => {
        stderr += chunk.toString();
      });

      server.on('exit', code => {
        clearTimeout(timeout);
        reject(new Error(`Presenter server exited early with code ${code}.\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`));
      });
    });

    const parsed = new URL(deckUrl);
    const session = parsed.searchParams.get('session');
    assert.ok(session, 'presenter deck URL should include a session');

    const configUrl = `${parsed.origin}/sync/config?session=${encodeURIComponent(session)}`;
    const configResponse = await httpGet(configUrl);
    assert.equal(configResponse.status, 200, 'presenter /sync/config should respond 200');
    const config = JSON.parse(configResponse.body);
    assert.ok(config.computerDeckUrl, 'config should include computerDeckUrl');
    assert.ok(config.presenterUrl, 'config should include presenterUrl');
    assert.ok(config.qrUrl, 'config should include qrUrl');
    assert.ok(config.localDeckUrl.includes('127.0.0.1'), 'local fallback should use 127.0.0.1');
  } finally {
    server.kill('SIGTERM');
  }
}

test('skill folders contain required files and metadata', async () => {
  for (const skill of skills) {
    for (const file of skill.files) {
      assert.ok(await fileExists(repoPath(skill.name, file)), `${skill.name}/${file} should exist`);
    }

    const skillMd = await readFile(repoPath(skill.name, 'SKILL.md'), 'utf8');
    const metadata = parseFrontmatter(skillMd);
    assert.equal(metadata.name, skill.name, `${skill.name} frontmatter name should match folder`);
    assert.ok(metadata.description && metadata.description.length > 80, `${skill.name} needs a useful trigger description`);

    const agentYaml = await readFile(repoPath(skill.name, 'agents', 'openai.yaml'), 'utf8');
    assert.match(agentYaml, /display_name:\s*".+"/, `${skill.name} agents/openai.yaml needs display_name`);
    assert.match(agentYaml, /short_description:\s*".+"/, `${skill.name} agents/openai.yaml needs short_description`);
    assert.match(agentYaml, /default_prompt:\s*".+"/, `${skill.name} agents/openai.yaml needs default_prompt`);
    assert.ok(agentYaml.includes(skill.displayName), `${skill.name} display name should be ${skill.displayName}`);
  }
});

test('SKILL.md referenced bundled resources exist', async () => {
  for (const skill of skills) {
    const skillRoot = repoPath(skill.name);
    const skillMd = await readFile(path.join(skillRoot, 'SKILL.md'), 'utf8');
    const refs = extractReferencedResources(skillMd);
    for (const ref of refs) {
      const target = resolveSkillResourceRef(skillRoot, ref);
      assert.ok(
        await pathExists(target),
        `${skill.name}/SKILL.md references missing resource: ${ref}`
      );
    }
  }
});

test('root release metadata is present', async () => {
  const required = [
    'README.md',
    'LICENSE',
    '.gitignore',
    'package.json',
    'docs/quickstart.zh-CN.md',
    'docs/simulation-test.zh-CN.md',
    'docs/manual-acceptance-checklist.zh-CN.md',
    'examples/prompts.md',
    '.github/ISSUE_TEMPLATE/bug_report.md',
    '.github/ISSUE_TEMPLATE/quality_report.md'
  ];
  for (const file of required) {
    assert.ok(await fileExists(repoPath(file)), `${file} should exist`);
  }
  const gitignore = await readFile(repoPath('.gitignore'), 'utf8');
  assert.ok(gitignore.includes('/*.html'), '.gitignore should exclude generated root HTML decks');
  assert.ok(
    gitignore.includes('.animated-html-deck-extractions/'),
    '.gitignore should exclude source deck extraction artifacts'
  );
});

test('launcher payload normalization handles realistic briefs', async () => {
  const zhPitch = parseJsonOutput(runNode(
    'animated-html-deck/scripts/normalize-launcher-payload.mjs',
    [],
    {
      input: JSON.stringify({
        raw_input: '做一个 8 页中文 AI 客服融资路演 HTML PPT，严肃 9/10，风格像 Vercel，给投资人演讲'
      })
    }
  ), 'zh pitch normalization');
  assert.equal(zhPitch.normalized.language.value, 'zh-CN');
  assert.equal(zhPitch.normalized.slide_count.value, 8);
  assert.equal(zhPitch.normalized.purpose.value, 'pitch');
  assert.equal(zhPitch.normalized.seriousness.value, 9);
  assert.equal(zhPitch.normalized.visual_style.value, 'vercel');
  assert.equal(zhPitch.normalized.is_speaking_deck.value, true);

  const enReport = parseJsonOutput(runNode(
    'animated-html-deck/scripts/normalize-launcher-payload.mjs',
    [],
    {
      input: JSON.stringify({
        raw_input: 'Create about 12 slides for a board market analysis report in Stripe style, seriousness 8/10.'
      })
    }
  ), 'en report normalization');
  assert.equal(enReport.normalized.language.value, 'en');
  assert.equal(enReport.normalized.slide_count.value, 12);
  assert.equal(enReport.normalized.purpose.value, 'report');
  assert.equal(enReport.normalized.seriousness.value, 8);
  assert.equal(enReport.normalized.visual_style.value, 'stripe');

  const empty = parseJsonOutput(runNode(
    'animated-html-deck/scripts/normalize-launcher-payload.mjs',
    [],
    { input: '{}' }
  ), 'empty normalization');
  assert.ok(empty.high_risk_warnings.length > 0, 'empty launcher payload should warn');
  assert.equal(empty.normalized.slide_count.value, 8);
});

test('launcher payload normalization asks for brief intake on vague deck requests', async () => {
  const vague = parseJsonOutput(runNode(
    'animated-html-deck/scripts/normalize-launcher-payload.mjs',
    [],
    {
      input: JSON.stringify({
        raw_input: '帮我做个 PPT'
      })
    }
  ), 'vague deck normalization');
  assert.equal(vague.needs_clarification, true, 'vague deck requests should require clarification');
  assert.equal(vague.clarification_mode, 'single_modal_brief_intake', 'vague requests should use single modal intake');
  assert.ok(vague.high_risk_warnings.some(warning => warning.includes('single_modal_brief_intake')), 'vague requests should warn with the structured intake mode');
  assert.equal(vague.tool_contract.tool_name, 'request_user_input', 'vague requests should specify the modal tool contract');
  assert.equal(vague.tool_contract.call_required, true, 'vague requests should require the modal tool call');
  assert.equal(vague.tool_contract.plain_text_questions_allowed, false, 'vague requests should forbid plain-text question lists');
  assert.equal(vague.single_modal_brief_intake.mode, 'single_modal_brief_intake');
  assert.equal(vague.single_modal_brief_intake.tool_contract.call_required, true, 'modal intake should carry the required tool contract');
  assert.equal(vague.single_modal_brief_intake.tool_contract.plain_text_questions_allowed, false, 'modal intake should forbid plain-text fallback questions');
  assert.ok(vague.single_modal_brief_intake.use_request_user_input, 'brief intake should require request_user_input');
  assert.equal(vague.single_modal_brief_intake.max_questions, 10, 'brief intake should respect the 10 question modal limit');
  assert.equal(vague.single_modal_brief_intake.questions.length, 8, 'brief intake should ask 8 structured questions');
  assert.ok(vague.single_modal_brief_intake.questions.some(question => question.id === 'topic_source'), 'brief intake should ask for topic/source');
  assert.ok(vague.single_modal_brief_intake.questions.some(question => question.id === 'speaker_notes'), 'brief intake should ask for speaker notes');
  assert.ok(vague.single_modal_brief_intake.questions.some(question => question.id === 'output_mode'), 'brief intake should ask for aspect/phone output');
  assert.ok(vague.clarification_questions.every(question => typeof question === 'object' && Array.isArray(question.options)), 'clarification questions should be structured modal questions, not plain text prompts');

  const skillText = await readFile(repoPath('animated-html-deck', 'SKILL.md'), 'utf8');
  assert.match(skillText, /call_required`:\s*`true`/, 'skill should state request_user_input is required');
  assert.match(skillText, /plain_text_questions_allowed`:\s*`false`/, 'skill should forbid plain-text brief question lists');
  assert.match(skillText, /当前环境没有 brief 弹窗工具/, 'skill should define a no-tool fallback that does not list questions');

  const keynote = parseJsonOutput(runNode(
    'animated-html-deck/scripts/normalize-launcher-payload.mjs',
    [],
    {
      input: JSON.stringify({
        raw_input: '做一个发布会 PPT，要我上台讲，主题是新产品发布'
      })
    }
  ), 'keynote normalization');
  assert.equal(keynote.needs_clarification, false, 'topic-bearing keynote request should not be treated as empty brief');
  assert.equal(keynote.normalized.is_speaking_deck.value, true, 'speaking context should infer speaking deck');
  assert.equal(keynote.speaker_script_guidance.needs_guidance, true, 'speaking deck should include speaker script guidance');
  assert.equal(keynote.speaker_script_guidance.requires_followup, true, 'speaking deck should ask for script style/detail if unspecified');
  assert.ok(keynote.high_risk_warnings.some(warning => warning.includes('Speaking context')), 'speaking deck should warn to confirm script guidance');
});

test('style resolver returns deterministic theme packages', async () => {
  const vercel = parseJsonOutput(runNode('style-polish/scripts/resolve-style-theme.mjs', [
    '--style', 'vercel',
    '--medium', 'ppt',
    '--purpose', 'pitch',
    '--seriousness', '9'
  ]), 'vercel style');
  assert.equal(vercel.sourceStyleId, 'vercel');
  assert.ok(vercel.tokens?.accent, 'vercel style should include tokens');
  assert.ok(vercel.translationGuidance.includes('ppt'), 'guidance should adapt to the target medium');

  const developerTool = parseJsonOutput(runNode('style-polish/scripts/resolve-style-theme.mjs', [
    '--style', 'high-end developer tool',
    '--medium', 'ppt',
    '--purpose', 'report',
    '--seriousness', '8'
  ]), 'developer tool style');
  assert.ok(developerTool.sourceStyleId, 'abstract style should resolve to one source style');
  assert.ok(developerTool.layoutFamily, 'abstract style should include a layout family');
  assert.ok(developerTool.suitability, 'abstract style should include suitability');

  const stripe = parseJsonOutput(runNode('style-polish/scripts/resolve-style-theme.mjs', [
    '--style', 'stripe',
    '--medium', 'ppt',
    '--purpose', 'launch',
    '--seriousness', '6'
  ]), 'stripe style');
  assert.equal(stripe.sourceStyleId, 'stripe');
});

test('image-to-data-uri handles success and clear failures', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'presentation-skill-'));
  const pngPath = path.join(tmp, 'pixel.png');
  const txtPath = path.join(tmp, 'not-image.txt');
  await writeFile(pngPath, Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
    'base64'
  ));
  await writeFile(txtPath, 'not an image');

  const ok = runNode('animated-html-deck/scripts/image-to-data-uri.mjs', [pngPath]);
  assert.ok(ok.stdout.startsWith('data:image/png;base64,'), 'PNG should become a data URI');

  const fail = runNode('animated-html-deck/scripts/image-to-data-uri.mjs', [txtPath], {
    expectFailure: true
  });
  assert.match(fail.stderr, /Unsupported image type/, 'unsupported image type should be explained');
});

test('source page extraction handles root detection failures clearly', async () => {
  const emptyRoot = await mkdtemp(path.join(os.tmpdir(), 'source-pages-empty-'));
  const noSource = runNode('animated-html-deck/scripts/extract-source-pages.mjs', [], {
    cwd: emptyRoot,
    expectFailure: true
  });
  assert.match(noSource.stderr, /No source deck found/, 'empty root should explain missing source deck');

  const multiRoot = await mkdtemp(path.join(os.tmpdir(), 'source-pages-multi-'));
  await writeFile(path.join(multiRoot, 'a.pdf'), buildTinyPdf(1));
  await writeFile(path.join(multiRoot, 'b.pdf'), buildTinyPdf(1));
  const multiple = runNode('animated-html-deck/scripts/extract-source-pages.mjs', [], {
    cwd: multiRoot,
    expectFailure: true
  });
  assert.match(multiple.stderr, /Multiple source decks found/, 'multiple root sources should ask for explicit path');
  assert.match(multiple.stderr, /a\.pdf/, 'multiple source message should list candidates');
  assert.match(multiple.stderr, /b\.pdf/, 'multiple source message should list candidates');
});

test('source page extraction renders a root PDF into manifest pages', async () => {
  if (!commandExists('pdftoppm')) {
    console.log('skip - source page PDF rendering requires pdftoppm');
    return;
  }

  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), 'source-pages-pdf-'));
  const pdfPath = path.join(tmpRoot, 'sample.pdf');
  await writeFile(pdfPath, buildTinyPdf(2));

  const result = parseJsonOutput(runNode('animated-html-deck/scripts/extract-source-pages.mjs', [], {
    cwd: tmpRoot
  }), 'source page extraction');

  assert.equal(result.sourceType, 'pdf');
  assert.equal(result.pageCount, 2);
  assert.ok(result.manifestPath.includes('.animated-html-deck-extractions'), 'manifest should live in extraction workspace');

  const manifest = JSON.parse(await readFile(result.manifestPath, 'utf8'));
  assert.equal(await realpath(manifest.sourcePath), await realpath(pdfPath));
  assert.equal(manifest.sourceType, 'pdf');
  assert.equal(manifest.pageCount, 2);
  assert.equal(manifest.pages.length, 2);

  for (const page of manifest.pages) {
    assert.ok(await fileExists(page.imagePath), `page ${page.index} image should exist`);
    assert.ok(page.width > 0, 'page width should be populated');
    assert.ok(page.height > 0, 'page height should be populated');
    assert.match(path.basename(page.imagePath), /^page-\d{3}\.png$/, 'page images should use stable names');
  }
});

test('source page extraction gives actionable PPT/PPTX conversion failures', async () => {
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), 'source-pages-ppt-'));
  const pptxPath = path.join(tmpRoot, 'sample.pptx');
  await writeFile(pptxPath, 'not a real pptx');

  const result = runNode('animated-html-deck/scripts/extract-source-pages.mjs', [pptxPath], {
    cwd: tmpRoot,
    expectFailure: true
  });
  assert.match(
    result.stderr,
    /LibreOffice|soffice|Export the presentation as PDF/,
    'PPT/PPTX failure should mention LibreOffice or exporting to PDF'
  );
});

test('single-file deck template preserves promised runtime features', async () => {
  const html = await readFile(repoPath('animated-html-deck/assets/single-file-deck-template.html'), 'utf8');
  const slides = [...html.matchAll(/<section\b[^>]*class="[^"]*\bslide\b/g)];
  const notes = [...html.matchAll(/<aside class="notes">/g)];
  assert.ok(slides.length > 0, 'template should contain sample slides');
  assert.equal(notes.length, slides.length, 'every sample slide should contain notes');
  assert.match(html, /<body[^>]+data-motion-mode="static"/, 'template should default to static motion mode');
  assert.match(html, /@media print/, 'template should include print styles');
  for (const id of [
    'prev',
    'next',
    'cursorToggle',
    'editToggle',
    'fontIncrease',
    'fontDecrease',
    'resetEdit',
    'colorButton',
    'modeToggle',
    'templateToggle',
    'ratioToggle',
    'publishToggle',
    'phoneToggle',
    'notesToggle',
    'fullscreen'
  ]) {
    assert.ok(html.includes(`id="${id}"`), `template should include ${id}`);
  }
  assert.match(html, /data-aspect="16-9"/, 'template should default to 16:9 aspect mode');
  assert.match(html, /body\[data-aspect="9-16"\]/, 'template should include 9:16 aspect styling');
  assert.match(html, /@page deck-phone/, 'template should include 9:16 print page support');
  assert.match(html, /Publish\/IP/, 'template should include an IP publish control');
  assert.match(html, /Copy command/, 'template should include a copyable publish command');
  assert.match(html, /function setCursorMode\(\)/, 'template should include an explicit cursor mode reset function');
  assert.match(html, /cursorToggle\.addEventListener\('click',\s*setCursorMode\)/, 'Cursor should call the reset function directly');
  assert.match(html, /selection\.removeAllRanges/, 'Cursor mode should clear text selection ranges');
  assert.match(html, /body:not\(\.editing\)\s+\.editable-node/, 'template should define non-editing cursor behavior for editable nodes');
  assert.match(html, /body\[data-aspect="9-16"\]\s+\.slide-body/, 'template should include dedicated 9:16 slide body layout');
  assert.match(html, /body\[data-aspect="9-16"\]\s+\.grid,[\s\S]*?\.media-split/, 'template should include dedicated 9:16 component reflow');
  assert.match(html, /nextSlidePreviewHtml:\s*slidePreviewHtml\(nextSlide\)/, 'template should send next-slide preview HTML to the phone presenter');
  assert.match(html, /\.slide::before\s*\{[\s\S]*?display:\s*none;/, 'template should disable the decorative slide glow layer by default');
  assert.match(html, /body\[data-template="consulting"\]\s+\.slide\s*\{\s*background:\s*var\(--bg\);/m, 'consulting template should use a flat slide background');
  assert.doesNotMatch(html, /body\[data-template="consulting"\]\s+\.slide\s*\{[^}]*repeating-linear-gradient/, 'consulting template should not use a grid background layer');
  assert.doesNotMatch(html, /\.slide\s*\{[^}]*background:\s*\n\s*linear-gradient\(135deg/, 'default slide background should not stack decorative gradients');
  assert.doesNotMatch(html, /\.slides\s*\{[^}]*box-shadow:\s*var\(--shadow\)/, 'slide canvas should not add an outer presentation shadow');
  assert.ok(html.includes('addEventListener(\'keydown\''), 'template should include keyboard controls');
  assert.doesNotMatch(html, /\b(?:src|href)=["']https?:\/\//i, 'template should not link remote runtime assets');
  assert.doesNotMatch(html, /(?:unpkg|jsdelivr|fonts\.googleapis|cdn\.)/i, 'template should not depend on public CDNs');

  const skillText = await readFile(repoPath('animated-html-deck/SKILL.md'), 'utf8');
  assert.match(skillText, /Use flat backgrounds by default/, 'skill should require flat backgrounds by default');
});

test('presenter server starts and reports deck, phone, and QR URLs', async () => {
  await startPresenterSmoke();
});

test('public release risk scan has no obvious secrets or local machine paths', async () => {
  const releaseRoots = [
    ...skills.map(skill => repoPath(skill.name)),
    repoPath('tests'),
    repoPath('docs'),
    repoPath('examples'),
    repoPath('.github')
  ];
  const rootFiles = ['README.md', 'LICENSE', '.gitignore', 'package.json'];
  const files = [];
  for (const root of releaseRoots) files.push(...await walk(root, new Set(['.git', 'node_modules', '.cache'])));
  for (const file of rootFiles) files.push(repoPath(file));

  const patterns = [
    { name: 'OpenAI API key', regex: /sk-[A-Za-z0-9_-]{20,}/ },
    { name: 'generic assigned API key', regex: /\b(?:api[_-]?key|secret[_-]?key)\s*[:=]\s*["'][^"']{8,}["']/i },
    { name: 'bearer token', regex: /\bBearer\s+[A-Za-z0-9._-]{20,}/ },
    { name: 'local absolute user path', regex: /\/Users\/[A-Za-z0-9._-]+/ }
  ];

  for (const file of files) {
    const text = await readFile(file, 'utf8');
    for (const pattern of patterns) {
      assert.doesNotMatch(text, pattern.regex, `${path.relative(repoRoot, file)} contains ${pattern.name}`);
    }
  }
});

test('agent simulation prompt fixture covers positive, edge, and negative cases', async () => {
  const fixture = JSON.parse(await readFile(repoPath('tests/fixtures/agent-simulation-prompts.json'), 'utf8'));
  assert.equal(fixture.version, '0.1.1-beta');
  assert.ok(Array.isArray(fixture.prompts));
  assert.ok(fixture.prompts.length >= 10, 'fixture should include at least 10 prompts');

  const skillsCovered = new Set(fixture.prompts.map(prompt => prompt.skill));
  for (const skill of skills) assert.ok(skillsCovered.has(skill.name), `${skill.name} should have simulation prompts`);

  const types = new Set(fixture.prompts.map(prompt => prompt.type));
  for (const type of ['positive', 'edge', 'negative']) assert.ok(types.has(type), `fixture should include ${type} prompts`);

  for (const prompt of fixture.prompts) {
    assert.ok(prompt.id && /^[a-z0-9-]+$/.test(prompt.id), 'prompt id should be slug-like');
    assert.ok(prompt.prompt.includes(`$${prompt.skill}`), `${prompt.id} should explicitly trigger its skill`);
    assert.ok(prompt.expectedChecks?.length > 0, `${prompt.id} should list expected checks`);
  }
});

let failures = 0;
for (const check of checks) {
  try {
    await check.fn();
    console.log(`ok - ${check.name}`);
  } catch (error) {
    failures += 1;
    console.error(`not ok - ${check.name}`);
    console.error(error.stack || error.message || String(error));
  }
}

if (failures > 0) {
  console.error(`\n${failures} smoke check(s) failed.`);
  process.exit(1);
}

console.log(`\n${checks.length} smoke checks passed.`);
