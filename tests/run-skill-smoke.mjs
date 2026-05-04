#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { copyFile, mkdtemp, readFile, readdir, realpath, stat, writeFile } from 'node:fs/promises';
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
    metadataName: 'awesome-presentation',
    displayName: 'Awesome Presentation',
    files: [
      'SKILL.md',
      'agents/openai.yaml',
      'assets/single-file-deck-template.html',
      'references/deck-generation-rubric.md',
      'references/chart-intelligence.md',
      'references/chart-patterns.md',
      'references/chart-spec.schema.json',
      'references/launcher-design-rationale.md',
      'references/launcher-payload.schema.json',
      'references/launcher-wizard-spec.md',
      'scripts/image-to-data-uri.mjs',
      'scripts/extract-source-pages.mjs',
      'scripts/export-html-to-pdf.mjs',
      'scripts/render-chart-spec.mjs',
      'scripts/validate-chart-spec.mjs',
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
    env: options.env || process.env,
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

async function findTestBrowser() {
  if (process.env.CHROME_PATH && await fileExists(process.env.CHROME_PATH)) return process.env.CHROME_PATH;

  for (const command of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'chrome']) {
    const result = spawnSync(process.env.SHELL || '/bin/sh', ['-lc', `command -v ${command}`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    if (result.status === 0 && result.stdout.trim()) return result.stdout.trim().split('\n')[0];
  }

  const macApps = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
  ];
  for (const browserPath of macApps) {
    if (await fileExists(browserPath)) return browserPath;
  }

  return null;
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
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy(new Error(`Timed out fetching ${url}`));
    });
  });
}

function httpPost(url, body = '') {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = http.request({
      method: 'POST',
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, res => {
      let responseBody = '';
      res.setEncoding('utf8');
      res.on('data', chunk => {
        responseBody += chunk;
      });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: responseBody }));
    });
    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy(new Error(`Timed out posting ${url}`));
    });
    req.write(body);
    req.end();
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
    assert.equal(configResponse.headers['access-control-allow-origin'], '*', 'presenter /sync/config should allow raw file Launch checks');
    const config = JSON.parse(configResponse.body);
    assert.equal(config.deckName, 'single-file-deck-template.html', 'config should include the served deck filename');
    assert.ok(config.computerDeckUrl, 'config should include computerDeckUrl');
    assert.ok(config.presenterUrl, 'config should include presenterUrl');
    assert.ok(config.qrUrl, 'config should include qrUrl');
    assert.ok(config.localDeckUrl.includes('127.0.0.1'), 'local fallback should use 127.0.0.1');

    const presenterResponse = await httpGet(`${parsed.origin}/presenter?session=${encodeURIComponent(session)}`);
    assert.equal(presenterResponse.status, 200, 'phone presenter page should respond 200');
    assert.match(presenterResponse.body, />演讲稿</, 'phone presenter should label notes as 演讲稿');
    assert.doesNotMatch(presenterResponse.body, /手机口播稿|当前页口播稿|互动性提问|questionInput|presenter-question/, 'phone presenter should not include old oral-script labels or interactive question UI');
  } finally {
    server.kill('SIGTERM');
  }
}

async function startPresenterExportSmoke() {
  const browserPath = await findTestBrowser();
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), 'presenter-pdf-export-'));
  const deckPath = path.join(tmpRoot, 'served-deck.html');
  await copyFile(repoPath('animated-html-deck', 'assets', 'single-file-deck-template.html'), deckPath);

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
    env: browserPath ? { ...process.env, CHROME_PATH: browserPath } : process.env,
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
    const badSession = await httpPost(`${parsed.origin}/export/pdf?session=bad`);
    assert.equal(badSession.status, 403, 'export endpoint should reject invalid session');
    assert.match(badSession.body, /Invalid session/, 'invalid export session should explain failure');

    if (!browserPath) {
      console.log('skip - presenter PDF export requires Chrome/Chromium');
      return;
    }

    const session = parsed.searchParams.get('session');
    const exportResponse = await httpPost(`${parsed.origin}/export/pdf?session=${encodeURIComponent(session)}`);
    assert.equal(exportResponse.status, 200, 'export endpoint should respond 200 for valid session');
    const exportResult = JSON.parse(exportResponse.body);
    assert.equal(exportResult.ok, true, 'export endpoint should report success');
    assert.equal(path.basename(exportResult.outputPath), 'served-deck.pdf', 'export endpoint should write a PDF beside the deck');
    assert.ok(exportResult.pageCount > 0, 'export endpoint should report page count');
    assert.ok(await fileExists(exportResult.outputPath), 'server-exported PDF should exist');
    const pdfBytes = await readFile(exportResult.outputPath);
    assert.equal(pdfBytes.subarray(0, 4).toString('utf8'), '%PDF', 'server-exported file should be a PDF');
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
    assert.equal(metadata.name, skill.metadataName || skill.name, `${skill.name} frontmatter name should match expected skill name`);
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

test('chart intelligence validates and renders core chart specs', async () => {
  const schema = JSON.parse(await readFile(repoPath('animated-html-deck/references/chart-spec.schema.json'), 'utf8'));
  assert.equal(schema.title, 'Awesome Presentation Chart Spec');
  assert.ok(schema.properties.type.enum.includes('kpi-strip'), 'chart schema should include kpi-strip');
  assert.ok(schema.properties.type.enum.includes('heatmap'), 'chart schema should include heatmap');

  const chartDir = repoPath('tests/fixtures/chart-specs');
  const fixtureNames = (await readdir(chartDir)).filter(name => name.endsWith('.json')).sort();
  assert.ok(fixtureNames.length >= 8, 'chart fixtures should cover the core chart types');

  const renderedTypes = new Set();
  for (const fixtureName of fixtureNames) {
    const fixturePath = path.join(chartDir, fixtureName);
    const validation = parseJsonOutput(runNode('animated-html-deck/scripts/validate-chart-spec.mjs', [fixturePath]), fixtureName);
    assert.equal(validation.ok, true, `${fixtureName} should validate`);
    renderedTypes.add(validation.type);

    const rendered = runNode('animated-html-deck/scripts/render-chart-spec.mjs', [fixturePath]).stdout;
    assert.match(rendered, /class="viz-card"/, `${fixtureName} should render a viz-card`);
    assert.match(rendered, /data-chart-type="/, `${fixtureName} should include data-chart-type`);
    assert.match(rendered, /data-chart-spec='/, `${fixtureName} should include data-chart-spec`);
    assert.match(rendered, /chart-title/, `${fixtureName} should render a chart title`);
    assert.match(rendered, /chart-takeaway/, `${fixtureName} should render a takeaway`);
    assert.doesNotMatch(rendered, /\b(?:src|href)=["']https?:\/\//i, `${fixtureName} should not link remote assets`);
    assert.doesNotMatch(rendered, /(?:unpkg|jsdelivr|fonts\.googleapis|cdn\.)/i, `${fixtureName} should not depend on public CDNs`);
  }

  for (const type of ['kpi-strip', 'timeline', 'quadrant', 'scenario-matrix', 'yield-curve', 'funnel', 'waterfall', 'heatmap']) {
    assert.ok(renderedTypes.has(type), `chart fixtures should include ${type}`);
  }

  const invalid = runNode(
    'animated-html-deck/scripts/validate-chart-spec.mjs',
    [],
    {
      input: JSON.stringify({
        type: 'kpi-strip',
        title: 'Bad remote chart',
        takeaway: 'Remote references should fail.',
        data: { items: [{ label: 'A', value: '1' }, { label: 'B', value: '2' }] },
        source: 'https://example.com/data.csv'
      }),
      expectFailure: true
    }
  );
  assert.match(invalid.stderr, /remote URLs/, 'validator should reject remote references');
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

test('HTML to PDF export handles source selection and browser failures clearly', async () => {
  const emptyRoot = await mkdtemp(path.join(os.tmpdir(), 'html-pdf-empty-'));
  const noSource = runNode('animated-html-deck/scripts/export-html-to-pdf.mjs', [], {
    cwd: emptyRoot,
    expectFailure: true
  });
  assert.match(noSource.stderr, /No HTML deck found/, 'empty root should explain missing HTML deck');

  const multiRoot = await mkdtemp(path.join(os.tmpdir(), 'html-pdf-multi-'));
  await writeFile(path.join(multiRoot, 'a.html'), '<!doctype html><section class="slide"></section>');
  await writeFile(path.join(multiRoot, 'b.html'), '<!doctype html><section class="slide"></section>');
  const multiple = runNode('animated-html-deck/scripts/export-html-to-pdf.mjs', [], {
    cwd: multiRoot,
    expectFailure: true
  });
  assert.match(multiple.stderr, /Multiple HTML decks found/, 'multiple root HTML decks should ask for explicit path');
  assert.match(multiple.stderr, /a\.html/, 'multiple HTML message should list candidates');
  assert.match(multiple.stderr, /b\.html/, 'multiple HTML message should list candidates');

  const invalidInput = path.join(emptyRoot, 'not-html.txt');
  await writeFile(invalidInput, 'not html');
  const unsupported = runNode('animated-html-deck/scripts/export-html-to-pdf.mjs', [invalidInput], {
    cwd: emptyRoot,
    expectFailure: true
  });
  assert.match(unsupported.stderr, /Unsupported input type/, 'unsupported input type should be explained');

  const htmlPath = path.join(emptyRoot, 'deck.html');
  await writeFile(htmlPath, '<!doctype html><section class="slide"></section>');
  const noBrowser = runNode('animated-html-deck/scripts/export-html-to-pdf.mjs', [htmlPath], {
    cwd: emptyRoot,
    env: {
      ...process.env,
      CHROME_PATH: path.join(emptyRoot, 'missing-chrome')
    },
    expectFailure: true
  });
  assert.match(noBrowser.stderr, /CHROME_PATH is set/, 'invalid CHROME_PATH should fail clearly');
});

test('HTML to PDF export renders a local slide-only PDF when Chrome is available', async () => {
  const browserPath = await findTestBrowser();
  if (!browserPath) {
    console.log('skip - HTML to PDF export requires Chrome/Chromium');
    return;
  }

  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), 'html-pdf-export-'));
  const sourcePath = path.join(tmpRoot, 'deck.html');
  await copyFile(repoPath('animated-html-deck/assets/single-file-deck-template.html'), sourcePath);

  const result = parseJsonOutput(runNode('animated-html-deck/scripts/export-html-to-pdf.mjs', [sourcePath], {
    cwd: tmpRoot,
    env: {
      ...process.env,
      CHROME_PATH: browserPath
    },
    timeout: 30000
  }), 'HTML PDF export');

  const outputPath = path.join(tmpRoot, 'deck.pdf');
  assert.equal(await realpath(result.sourcePath), await realpath(sourcePath));
  assert.equal(await realpath(result.outputPath), await realpath(outputPath));
  assert.equal(await realpath(result.browserPath), await realpath(browserPath));
  assert.ok(result.pageCount > 0, 'export should report at least one slide');
  assert.ok(await fileExists(outputPath), 'exported PDF should exist');

  const pdfBytes = await readFile(outputPath);
  assert.equal(pdfBytes.subarray(0, 4).toString('utf8'), '%PDF', 'exported file should be a PDF');
  assert.ok(pdfBytes.length > 1024, 'exported PDF should be non-empty');
});

test('single-file deck template preserves promised runtime features', async () => {
  const html = await readFile(repoPath('animated-html-deck/assets/single-file-deck-template.html'), 'utf8');
  const presenterServer = await readFile(repoPath('animated-html-deck/scripts/presenter-server.mjs'), 'utf8');
  const slides = [...html.matchAll(/<section\b[^>]*class="[^"]*\bslide\b/g)];
  const notes = [...html.matchAll(/<aside class="notes">/g)];
  assert.ok(slides.length > 0, 'template should contain sample slides');
  assert.equal(notes.length, slides.length, 'every sample slide should contain notes');
  assert.match(html, /<body[^>]+data-motion-mode="static"/, 'template should default to static motion mode');
  assert.match(html, /@media print/, 'template should include print styles');
  for (const id of [
    'cursorToggle',
    'editToggle',
    'colorToggle',
    'modeToggle',
    'templateToggle',
    'ratioToggle',
    'exportPdfToggle',
    'pdfFallbackActions',
    'printPdfFallback',
    'phoneToggle',
    'notesToggle',
    'notesEditor',
    'notesSave',
    'notesReset',
    'notesSaveStatus',
    'laserCursor',
    'hideToggle'
  ]) {
    assert.ok(html.includes(`id="${id}"`), `template should include ${id}`);
  }
  const controlsMarkup = html.match(/<nav class="controls"[\s\S]*?<\/nav>/)?.[0] || '';
  for (const removedId of ['prev', 'next', 'fontIncrease', 'fontDecrease', 'resetEdit', 'fullscreen']) {
    assert.doesNotMatch(controlsMarkup, new RegExp(`id="${removedId}"`), `visible controls should not include ${removedId}`);
  }
  assert.match(controlsMarkup, /id="cursorToggle"/, 'visible controls should include Cursor');
  assert.match(controlsMarkup, /id="modeToggle"/, 'visible controls should include Mode');
  assert.match(controlsMarkup, />Note<\/button>/, 'notes control should use the concise Note label');
  const liveStyles = html.slice(0, html.indexOf('@media print'));
  assert.match(liveStyles, /\.deck\s*\{[\s\S]*?height:\s*100vh;[\s\S]*?width:\s*100vw;[\s\S]*?display:\s*grid;[\s\S]*?place-items:\s*center;[\s\S]*?padding:\s*0;/, 'live deck stage should fill and center the true slide canvas');
  assert.match(liveStyles, /--design-width:\s*1600px;[\s\S]*?--design-height:\s*900px;[\s\S]*?--slide-width:\s*var\(--design-width\);[\s\S]*?--slide-height:\s*var\(--design-height\);/, '16:9 should use a fixed 1600x900 design canvas');
  assert.match(liveStyles, /body\[data-aspect="9-16"\]\s*\{[\s\S]*?--design-width:\s*900px;[\s\S]*?--design-height:\s*1600px;[\s\S]*?--slide-width:\s*var\(--design-width\);[\s\S]*?--slide-height:\s*var\(--design-height\);/, '9:16 should use a fixed 900x1600 design canvas');
  assert.match(liveStyles, /\.slides\s*\{[\s\S]*?width:\s*var\(--slide-width\);[\s\S]*?height:\s*var\(--slide-height\);[\s\S]*?max-height:\s*none;[\s\S]*?aspect-ratio:\s*var\(--aspect-ratio\);[\s\S]*?transform:\s*scale\(var\(--deck-scale\)\);/, 'live slides should render the fixed design canvas through a viewport scale');
  assert.match(liveStyles, /body\[data-aspect="9-16"\]\s+\.slides\s*\{[\s\S]*?width:\s*var\(--slide-width\);[\s\S]*?height:\s*var\(--slide-height\);[\s\S]*?aspect-ratio:\s*var\(--aspect-ratio\);/, '9:16 live slides should keep the true aspect-ratio canvas');
  assert.doesNotMatch(liveStyles, /calc\(\(100vh - var\(--controls-reserve/, 'live canvas should not subtract controls height');
  assert.match(html, /function updateDeckScale\(\)/, 'template should scale the fixed canvas to the viewport at runtime');
  assert.match(html, /<body[^>]+data-deck-id="animated-html-deck-template"/, 'template should include a stable data-deck-id');
  assert.match(html, /data-aspect="16-9"/, 'template should default to 16:9 aspect mode');
  assert.match(html, /body\[data-aspect="9-16"\]/, 'template should include 9:16 aspect styling');
  assert.match(html, /@page deck-phone/, 'template should include 9:16 print page support');
  assert.doesNotMatch(html, /id="publishToggle"/, 'template should not include a separate IP publish control');
  assert.match(html, /Export PDF/, 'template should include an Export PDF control');
  assert.match(html, /Phone \/ IP/, 'template should expose raw-file IP publish help through the Phone panel');
  assert.match(html, /Copy command/, 'template should include a copyable publish command');
  assert.match(html, /function buildExportPdfCommand\(\)/, 'template should build a copyable PDF export command');
  assert.match(html, /export-html-to-pdf\.mjs/, 'template should point raw file PDF export to the CLI exporter');
  assert.match(html, /Print \/ Save as PDF/, 'template should include a browser print PDF fallback');
  assert.match(html, /window\.print\(\)/, 'template should invoke the browser print dialog for raw-file PDF fallback');
  assert.match(html, /print-fallback/, 'template should track print fallback state');
  assert.match(html, /function showExportPdfPanel\(\)/, 'template should include served-mode PDF export behavior');
  assert.match(html, /\/export\/pdf\?session=/, 'template should call the presenter-server PDF export endpoint');
  assert.match(html, /\.viz-card/, 'template should include reusable chart card styles');
  assert.match(html, /\.chart-title/, 'template should include reusable chart title styles');
  assert.match(html, /data-chart-type="kpi-strip"/, 'template should include a sample structured chart');
  assert.match(html, /data-chart-spec='/, 'template should preserve chart specs in data-chart-spec');
  assert.match(html, /body\[data-aspect="9-16"\]\s+\.viz-kpi-strip/, 'template should reflow chart components for 9:16');
  assert.match(html, /--hover-lift:\s*-6px;/, 'template should define subtle hover lift tokens');
  assert.match(html, /@media\s*\(hover:\s*hover\)\s*and\s*\(pointer:\s*fine\)/, 'template should gate hover interactions to pointer devices');
  assert.match(html, /body:not\(\.editing\)\s+\.slide\.active\s+\.panel,[\s\S]*?\.viz-waterfall-bar\s*\{[\s\S]*?transition:/, 'template should only arm hover transitions on the active slide outside edit mode');
  assert.match(html, /body:not\(\.editing\)\s+\.slide\.active\s+\.panel:hover,[\s\S]*?\.viz-card:hover,[\s\S]*?transform:\s*translateY\(var\(--hover-lift\)\);/, 'template should lift reusable cards and chart cards on hover');
  assert.match(html, /body:not\(\.editing\)\s+\.slide\.active\s+\.viz-waterfall-bar:hover\s*\{[\s\S]*?filter:\s*var\(--hover-glow\);/, 'template should highlight chart bars on hover');
  assert.match(html, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.viz-waterfall-bar\s*\{[\s\S]*?transform:\s*none !important;/, 'template should suppress hover transforms for reduced motion');
  assert.match(html, /@media print[\s\S]*?\.viz-waterfall-bar\s*\{[\s\S]*?transform:\s*none !important;[\s\S]*?filter:\s*none !important;/, 'template should keep hover transforms out of print and PDF output');
  assert.match(html, /\.laser-cursor\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?pointer-events:\s*none;/, 'template should include a non-blocking laser cursor style');
  assert.match(html, /id="laserCursor"[\s\S]*data-laser-mode="laser"/, 'laser cursor should declare its default mode');
  assert.match(html, /\.laser-cursor\[data-laser-mode="laser"\]/, 'template should include laser pointer styling');
  assert.match(html, /\.laser-cursor\[data-laser-mode="spotlight"\]/, 'template should include spotlight pointer styling');
  assert.match(html, /\.laser-cursor\[data-laser-mode="crosshair"\]/, 'template should include crosshair pointer styling');
  assert.match(html, /body\.laser-active\s+\.laser-cursor\.is-visible/, 'template should reveal the laser cursor only in pointer mode');
  assert.match(html, /body\.laser-active\s+\.slide\.active,[\s\S]*?cursor:\s*none;/, 'template should hide the native cursor over the active slide in pointer mode');
  assert.match(html, /body\.laser-active\s+\.controls,[\s\S]*?body\.laser-active\s+\.phone-panel \*,[\s\S]*?cursor:\s*auto;/, 'template should restore the native cursor over controls and panels');
  assert.match(html, /const laserPointerModes = \['laser', 'spotlight', 'crosshair'\]/, 'template should define the pointer mode cycle');
  assert.match(html, /function setCursorMode\(options = \{\}\)/, 'template should include an explicit cursor mode reset function');
  assert.match(html, /function toggleCursorMode\(\)[\s\S]*laserPointerMode === 'laser'[\s\S]*laserPointerMode:\s*'spotlight'[\s\S]*laserPointerMode === 'spotlight'[\s\S]*laserPointerMode:\s*'crosshair'[\s\S]*setCursorMode\(\{ laserPointer:\s*false \}\)/, 'Cursor should cycle Laser to Spot to Cross to off');
  assert.match(html, /bindControl\('cursor',\s*cursorToggle,\s*'click',\s*toggleCursorMode\)/, 'Cursor should bind to laser pointer toggle');
  assert.match(html, /function setLaserPointer\(enabled,\s*mode = laserPointerMode\)/, 'template should include laser pointer mode state management');
  assert.match(html, /function updateLaserPointer\(event\)/, 'template should track laser pointer movement');
  assert.match(html, /cursorToggle\.textContent = cursorPointerActive \? 'Cursor: ' \+ laserPointerLabel\(laserPointerMode\) : 'Cursor'/, 'Cursor button should display the active pointer mode');
  assert.match(html, /setLaserPointer\(false\);[\s\S]*isEditing = enabled;/, 'Edit mode should close the laser pointer before editing');
  assert.match(html, /event\.key === 'Escape' && laserPointerActive[\s\S]*setLaserPointer\(false\)/, 'Escape should close the laser pointer');
  assert.match(html, /document\.addEventListener\('pointermove'[\s\S]*updateLaserPointer\(event\)/, 'pointer movement should update the laser cursor');
  assert.match(html, /selection\.removeAllRanges/, 'Cursor mode should clear text selection ranges');
  assert.match(html, /querySelectorAll\('\.editable-node\.is-selected, \.editable-node\.is-dragging'\)/, 'Cursor mode should clear residual selected edit nodes');
  assert.match(html, /id="colorToggle"[\s\S]*for="accentColorPicker"|for="accentColorPicker"[\s\S]*id="colorToggle"/, 'Color should be a native label trigger for the color input');
  assert.match(html, /document\.getElementById\('colorToggle'\)\s*\|\|\s*document\.getElementById\('colorButton'\)/, 'Color should use colorToggle while keeping legacy colorButton fallback');
  assert.match(html, /bindControl\('colorInput',\s*accentColorPicker,\s*'input'/, 'Color input should update on input');
  assert.match(html, /bindControl\('colorChange',\s*accentColorPicker,\s*'change'/, 'Color input should update on change');
  assert.match(html, /function bindControl\(name,\s*node,\s*eventName,\s*handler\)/, 'controls should bind through the safe helper');
  assert.match(html, /window\.__deckControlHealth\s*=\s*controlHealth/, 'template should expose deck control health');
  for (const healthKey of ['cursor', 'edit', 'color', 'mode', 'ratio', 'template', 'exportPdf', 'phone', 'notes', 'hide']) {
    assert.match(html, new RegExp(`${healthKey}[:\\s]`), `control health should cover ${healthKey}`);
    assert.match(html, new RegExp(`bindControl\\('${healthKey}'`), `${healthKey} should be bound through bindControl`);
  }
  assert.match(html, /laserPointer:\s*laserPointerActive/, 'control health should expose laser pointer state');
  assert.match(html, /laserPointerMode:\s*laserPointerActive \? laserPointerMode : 'off'/, 'control health should expose laser pointer mode');
  assert.match(html, /controlsHidden:/, 'control health should expose hidden controls state');
  assert.match(html, /function toggleControlsHidden\(\)/, 'template should include a hide/show controls toggle');
  assert.match(html, /document\.addEventListener\('click'[\s\S]*forward\(\);[\s\S]*\}\);/, 'template should advance on slide clicks');
  assert.match(html, /function notesStorageKey\(slideIndex = index\)/, 'template should compute stable per-slide notes storage keys');
  assert.match(html, /animated-html-deck-notes:' \+ deckId \+ ':' \+ slideIndex/, 'notes storage should use deck id and slide index');
  assert.match(html, /function restoreSavedNotes\(\)/, 'template should restore locally saved speaker notes');
  assert.match(html, /localStorage\.setItem\(notesStorageKey\(index\), notesEditor\.value\)/, 'saving notes should persist plain text in localStorage');
  assert.match(html, /localStorage\.removeItem\(notesStorageKey\(index\)\)/, 'resetting notes should clear localStorage for the slide');
  assert.match(html, /function saveCurrentNotes\(\)[\s\S]*publishSyncState\(\)/, 'saving notes should republish sync state');
  assert.match(html, /function resetCurrentNotes\(\)[\s\S]*publishSyncState\(\)/, 'resetting notes should republish sync state');
  assert.match(html, /notesHtml:\s*notes \? notes\.innerHTML : 'No notes for this slide\.'/ , 'sync state should read current notes HTML');
  assert.match(html, /const activeNotesEditor[\s\S]*if \(activeNotesEditor\) return;/, 'notes editor typing should not trigger deck keyboard shortcuts');
  assert.doesNotMatch(html, /<div class="logo-lockup"><span class="brand-mark">AD<\/span><span>Animated HTML Deck<\/span><\/div>/, 'template opening slide should not include the default logo pill');
  assert.doesNotMatch(html, /'\.slide \.logo-lockup span'/, 'logo lockup text should not be editable by default');
  assert.match(html, /body:not\(\.editing\)\s+\.editable-node/, 'template should define non-editing cursor behavior for editable nodes');
  assert.match(html, /body\[data-aspect="9-16"\]\s+\.slide-body/, 'template should include dedicated 9:16 slide body layout');
  assert.match(html, /body\[data-aspect="9-16"\]\s+\.grid,[\s\S]*?\.media-split/, 'template should include dedicated 9:16 component reflow');
  assert.match(html, /body\[data-aspect="9-16"\]\s+\.row,[\s\S]*?body\[data-aspect="9-16"\]\s+\.bar/, 'template should reflow row and bar components for 9:16');
  assert.match(html, /body\[data-aspect="9-16"\]\s+\.media-frame,[\s\S]*?body\[data-aspect="9-16"\]\s+\.media-bleed\s*\{[\s\S]*?aspect-ratio:\s*4 \/ 3;/, 'template should compact media frames for 9:16');
  assert.match(html, /aspect:\s*document\.body\.dataset\.aspect \|\| '16-9'/, 'sync state should publish the active aspect ratio');
  assert.match(html, /nextSlidePreviewHtml:\s*slidePreviewHtml\(nextSlide\)/, 'template should send next-slide preview HTML to the phone presenter');
  assert.match(presenterServer, /\.preview-frame\[data-aspect="9-16"\]\s*\{[\s\S]*?aspect-ratio:\s*9 \/ 16;/, 'phone presenter preview should support a 9:16 frame');
  assert.match(presenterServer, /const aspect = state\.aspect === '9-16' \? '9-16' : '16-9';[\s\S]*?nextPreviewEl\.dataset\.aspect = aspect;/, 'phone presenter should apply synced aspect to the next-slide preview');
  assert.match(presenterServer, /\.preview-frame\[data-aspect="9-16"\]\s+\.slide-preview \.grid,[\s\S]*?grid-template-columns:\s*1fr;/, 'phone presenter preview should reflow 9:16 slide content');
  assert.match(html, /\.slide::before\s*\{[\s\S]*?display:\s*none;/, 'template should disable the decorative slide glow layer by default');
  assert.match(html, /body\[data-template="consulting"\]\s+\.slide\s*\{\s*background:\s*var\(--bg\);/m, 'consulting template should use a flat slide background');
  assert.doesNotMatch(html, /body\[data-template="consulting"\]\s+\.slide\s*\{[^}]*repeating-linear-gradient/, 'consulting template should not use a grid background layer');
  assert.doesNotMatch(html, /\.slide\s*\{[^}]*background:\s*\n\s*linear-gradient\(135deg/, 'default slide background should not stack decorative gradients');
  assert.doesNotMatch(html, /\.slides\s*\{[^}]*box-shadow:\s*var\(--shadow\)/, 'slide canvas should not add an outer presentation shadow');
  assert.ok(html.includes('addEventListener(\'keydown\''), 'template should include keyboard controls');
  assert.doesNotMatch(html, /\b(?:src|href)=["']https?:\/\//i, 'template should not link remote runtime assets');
  assert.doesNotMatch(html, /(?:unpkg|jsdelivr|fonts\.googleapis|cdn\.)/i, 'template should not depend on public CDNs');

  const skillText = await readFile(repoPath('animated-html-deck/SKILL.md'), 'utf8');
  assert.match(
    skillText,
    /Use flat backgrounds by default|Aesthetics First/,
    'skill should include explicit visual design guidance'
  );
  assert.match(
    skillText,
    /Control Runtime Contract/,
    'skill should document the control runtime contract'
  );
  assert.match(
    skillText,
    /Fullscreen Canvas Contract/,
    'skill should document the fullscreen canvas contract'
  );
  assert.match(
    skillText,
    /100vw` and `100vh/,
    'skill should require the live canvas to fill the viewport'
  );
  assert.match(
    skillText,
    /Speaker Notes Editing Contract/,
    'skill should document editable speaker notes'
  );
  assert.match(
    skillText,
    /presenter script by default, not slide director notes/,
    'skill should forbid slide-director commentary in speaker notes'
  );
  assert.match(
    skillText,
    /do not include meta instructions such as "this slide is for\.\.\.", "first say\.\.\.", "remind the audience\.\.\.", or "slow down here"/,
    'skill should name common meta-note phrases to avoid'
  );
  assert.match(
    skillText,
    /data-deck-id/,
    'skill should require stable deck ids for notes persistence'
  );
  assert.match(
    skillText,
    /animated-html-deck-notes:\$\{deckId\}:\$\{slideIndex\}/,
    'skill should require notes storage keys based on deck id and slide index'
  );
  assert.match(
    skillText,
    /colorToggle/,
    'skill should require the canonical colorToggle control'
  );
  assert.match(
    skillText,
    /window\.__deckControlHealth/,
    'skill should require runtime control health'
  );
  assert.match(
    skillText,
    /exportPdfToggle/,
    'skill should require the Export PDF control id'
  );
  assert.match(
    skillText,
    /POST \/export\/pdf\?session=/,
    'skill should document served-mode PDF export endpoint'
  );
  assert.match(
    skillText,
    /Print \/ Save as PDF/,
    'skill should require browser print fallback for raw-file PDF export'
  );
  assert.match(
    skillText,
    /window\.print\(\)/,
    'skill should document the raw-file PDF fallback implementation'
  );
  assert.match(
    skillText,
    /Do not promise unconditional automatic PDF download/,
    'skill should avoid overpromising automatic PDF export availability'
  );
  assert.match(
    skillText,
    /Go Live \/ Phone Sync Contract/,
    'skill should document the Go Live / Phone Sync contract'
  );
  assert.match(
    skillText,
    /Chart Intelligence Protocol/,
    'skill should document the chart intelligence protocol'
  );
  assert.match(
    skillText,
    /chartSpec|chart spec/,
    'skill should require normalized chart specs'
  );
  assert.match(
    skillText,
    /Do not hard-code `localhost:3000`/,
    'skill should forbid hard-coded localhost:3000 launch targets'
  );
  assert.match(
    skillText,
    /\/sync\/config\?session=default/,
    'skill should require presenter-server config discovery'
  );
  assert.match(
    skillText,
    /response\.ok/,
    'skill should require response.ok before considering the server online'
  );
  assert.match(
    skillText,
    /config\.deckName/,
    'skill should require deckName validation before redirecting'
  );
  assert.match(
    skillText,
    /config\.localDeckUrl/,
    'skill should require localDeckUrl redirects'
  );
  assert.match(
    skillText,
    /\/sync\/state/,
    'skill should require served-mode slide state publishing'
  );
  assert.match(
    skillText,
    /\/sync\/commands/,
    'skill should require phone command sync'
  );

  const speakerSkillText = await readFile(repoPath('speaker-polish/SKILL.md'), 'utf8');
  assert.match(
    speakerSkillText,
    /For Chinese final speaker notes/,
    'speaker-polish should include Chinese final-script guardrails'
  );
  assert.match(
    speakerSkillText,
    /这页用于|这一页用来|注意强调|慢一点讲|收尾时提醒/,
    'speaker-polish should name Chinese meta-note phrases to rewrite'
  );
  assert.match(
    speakerSkillText,
    /presenter script, not rehearsal annotations or slide director commentary/,
    'speaker-polish should require final notes rather than rehearsal annotations'
  );
});

test('presenter server starts and reports deck, phone, and QR URLs', async () => {
  await startPresenterSmoke();
});

test('presenter server exposes local PDF export endpoint', async () => {
  await startPresenterExportSmoke();
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
  assert.equal(fixture.version, '0.1.2-beta');
  assert.ok(Array.isArray(fixture.prompts));
  assert.ok(fixture.prompts.length >= 10, 'fixture should include at least 10 prompts');

  const skillsCovered = new Set(fixture.prompts.map(prompt => prompt.skill));
  for (const skill of skills) {
    const expectedName = skill.metadataName || skill.name;
    assert.ok(skillsCovered.has(expectedName), `${expectedName} should have simulation prompts`);
  }

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
