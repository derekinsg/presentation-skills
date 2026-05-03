#!/usr/bin/env node
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);

function usage() {
  return [
    'Usage: node presenter-server.mjs <deck.html> [--port 4173] [--host 0.0.0.0] [--deck-host lan|local] [--no-open]',
    '',
    'Example:',
    '  node presenter-server.mjs animated-html-deck-intro.html --port 4173 --deck-host lan'
  ].join('\n');
}

function parseArgs(argv) {
  const options = { port: 4173, host: '0.0.0.0', deckHost: 'lan', open: true };
  const positional = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--port') {
      options.port = Number(argv[++i]);
      continue;
    }
    if (arg === '--host') {
      options.host = argv[++i];
      continue;
    }
    if (arg === '--deck-host') {
      options.deckHost = argv[++i];
      continue;
    }
    if (arg === '--open') {
      options.open = true;
      continue;
    }
    if (arg === '--no-open') {
      options.open = false;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }
    positional.push(arg);
  }

  options.deckPath = positional[0];
  return options;
}

function isValidDeckHost(value) {
  return value === 'lan' || value === 'local';
}

function getLanIp() {
  const nets = os.networkInterfaces();
  for (const entries of Object.values(nets)) {
    for (const entry of entries || []) {
      if (entry.family === 'IPv4' && !entry.internal) return entry.address;
    }
  }
  return '127.0.0.1';
}

function openUrl(url) {
  const platform = os.platform();
  const command = platform === 'darwin'
    ? 'open'
    : platform === 'win32'
      ? 'cmd'
      : 'xdg-open';
  const args = platform === 'win32'
    ? ['/c', 'start', '', url]
    : [url];
  const child = spawn(command, args, {
    detached: true,
    stdio: 'ignore'
  });
  child.on('error', () => {});
  child.unref();
}

function listenOnAvailablePort(server, options, attempts = 20) {
  return new Promise((resolve, reject) => {
    let port = options.port;

    function tryListen() {
      function handleError(error) {
        server.off('listening', handleListening);
        if (error.code === 'EADDRINUSE' && port < options.port + attempts - 1) {
          port += 1;
          tryListen();
          return;
        }
        reject(error);
      }

      function handleListening() {
        server.off('error', handleError);
        const address = server.address();
        options.port = address && typeof address === 'object' ? address.port : port;
        resolve(port);
      }

      server.once('error', handleError);
      server.once('listening', handleListening);
      server.listen(port, options.host);
    }

    tryListen();
  });
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    'Cache-Control': 'no-store',
    ...headers
  });
  res.end(body);
}

function sendJson(res, status, data) {
  send(res, status, JSON.stringify(data), {
    'Content-Type': 'application/json; charset=utf-8'
  });
}

function readRequestBody(req, limit = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', chunk => {
      body += chunk;
      if (body.length > limit) {
        reject(new Error('Request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function gfMultiply(a, b) {
  let result = 0;
  for (let i = 7; i >= 0; i -= 1) {
    result = (result << 1) ^ ((result >>> 7) * 0x11d);
    result ^= ((b >>> i) & 1) * a;
  }
  return result & 0xff;
}

function rsGenerator(degree) {
  let result = [1];
  let root = 1;
  for (let i = 0; i < degree; i += 1) {
    const next = new Array(result.length + 1).fill(0);
    for (let j = 0; j < result.length; j += 1) {
      next[j] ^= result[j];
      next[j + 1] ^= gfMultiply(result[j], root);
    }
    result = next;
    root = gfMultiply(root, 2);
  }
  return result.slice(1);
}

function rsRemainder(data, degree) {
  const generator = rsGenerator(degree);
  const result = new Array(degree).fill(0);
  for (const value of data) {
    const factor = value ^ result.shift();
    result.push(0);
    for (let i = 0; i < degree; i += 1) {
      result[i] ^= gfMultiply(generator[i], factor);
    }
  }
  return result;
}

function appendBits(bits, value, length) {
  for (let i = length - 1; i >= 0; i -= 1) {
    bits.push((value >>> i) & 1);
  }
}

function createQrCodewords(text) {
  const bytes = Array.from(Buffer.from(text, 'utf8'));
  const dataCodewords = 108;
  const eccCodewords = 26;
  if (bytes.length > 106) {
    throw new Error('QR text is too long for the built-in QR generator');
  }

  const bits = [];
  appendBits(bits, 0x4, 4);
  appendBits(bits, bytes.length, 8);
  for (const byte of bytes) appendBits(bits, byte, 8);
  appendBits(bits, 0, Math.min(4, dataCodewords * 8 - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);

  const data = [];
  for (let i = 0; i < bits.length; i += 8) {
    let value = 0;
    for (let j = 0; j < 8; j += 1) value = (value << 1) | bits[i + j];
    data.push(value);
  }
  for (let pad = 0xec; data.length < dataCodewords; pad ^= 0xfd) {
    data.push(pad);
  }

  return data.concat(rsRemainder(data, eccCodewords));
}

function makeQrMatrix(text) {
  const version = 5;
  const size = 17 + version * 4;
  const modules = Array.from({ length: size }, () => new Array(size).fill(false));
  const reserved = Array.from({ length: size }, () => new Array(size).fill(false));

  function setFunction(x, y, dark) {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    modules[y][x] = dark;
    reserved[y][x] = true;
  }

  function drawFinder(x, y) {
    for (let dy = -1; dy <= 7; dy += 1) {
      for (let dx = -1; dx <= 7; dx += 1) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= size || yy >= size) continue;
        const dist = Math.max(Math.abs(dx - 3), Math.abs(dy - 3));
        setFunction(xx, yy, dist === 3 || dist <= 1);
      }
    }
  }

  function drawAlignment(cx, cy) {
    for (let dy = -2; dy <= 2; dy += 1) {
      for (let dx = -2; dx <= 2; dx += 1) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        setFunction(cx + dx, cy + dy, dist === 2 || dist === 0);
      }
    }
  }

  drawFinder(0, 0);
  drawFinder(size - 7, 0);
  drawFinder(0, size - 7);
  drawAlignment(30, 30);

  for (let i = 0; i < size; i += 1) {
    if (!reserved[6][i]) setFunction(i, 6, i % 2 === 0);
    if (!reserved[i][6]) setFunction(6, i, i % 2 === 0);
  }
  setFunction(8, 4 * version + 9, true);

  for (let i = 0; i <= 5; i += 1) {
    setFunction(8, i, false);
    setFunction(i, 8, false);
  }
  setFunction(8, 7, false);
  setFunction(8, 8, false);
  setFunction(7, 8, false);
  for (let i = 0; i < 8; i += 1) setFunction(size - 1 - i, 8, false);
  for (let i = 8; i < 15; i += 1) setFunction(8, size - 15 + i, false);

  const codewords = createQrCodewords(text);
  let bitIndex = 0;
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right -= 1;
    for (let vert = 0; vert < size; vert += 1) {
      const y = upward ? size - 1 - vert : vert;
      for (let dx = 0; dx < 2; dx += 1) {
        const x = right - dx;
        if (reserved[y][x]) continue;
        const bit = bitIndex < codewords.length * 8
          ? ((codewords[bitIndex >>> 3] >>> (7 - (bitIndex & 7))) & 1) !== 0
          : false;
        modules[y][x] = bit;
        bitIndex += 1;
      }
    }
    upward = !upward;
  }

  function maskBit(mask, x, y) {
    if (mask === 0) return (x + y) % 2 === 0;
    if (mask === 1) return y % 2 === 0;
    if (mask === 2) return x % 3 === 0;
    if (mask === 3) return (x + y) % 3 === 0;
    if (mask === 4) return (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0;
    if (mask === 5) return ((x * y) % 2) + ((x * y) % 3) === 0;
    if (mask === 6) return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
  }

  function applyMask(base, mask) {
    return base.map((row, y) => row.map((dark, x) => reserved[y][x] ? dark : dark !== maskBit(mask, x, y)));
  }

  function penalty(matrix) {
    let score = 0;
    const finderA = '10111010000';
    const finderB = '00001011101';

    for (let y = 0; y < size; y += 1) {
      let runColor = matrix[y][0];
      let runLen = 1;
      for (let x = 1; x < size; x += 1) {
        if (matrix[y][x] === runColor) {
          runLen += 1;
        } else {
          if (runLen >= 5) score += 3 + runLen - 5;
          runColor = matrix[y][x];
          runLen = 1;
        }
      }
      if (runLen >= 5) score += 3 + runLen - 5;
    }

    for (let x = 0; x < size; x += 1) {
      let runColor = matrix[0][x];
      let runLen = 1;
      for (let y = 1; y < size; y += 1) {
        if (matrix[y][x] === runColor) {
          runLen += 1;
        } else {
          if (runLen >= 5) score += 3 + runLen - 5;
          runColor = matrix[y][x];
          runLen = 1;
        }
      }
      if (runLen >= 5) score += 3 + runLen - 5;
    }

    for (let y = 0; y < size - 1; y += 1) {
      for (let x = 0; x < size - 1; x += 1) {
        const color = matrix[y][x];
        if (matrix[y][x + 1] === color && matrix[y + 1][x] === color && matrix[y + 1][x + 1] === color) score += 3;
      }
    }

    for (let y = 0; y < size; y += 1) {
      let row = '';
      for (let x = 0; x < size; x += 1) row += matrix[y][x] ? '1' : '0';
      for (let x = 0; x <= size - 11; x += 1) {
        const chunk = row.slice(x, x + 11);
        if (chunk === finderA || chunk === finderB) score += 40;
      }
    }

    for (let x = 0; x < size; x += 1) {
      let col = '';
      for (let y = 0; y < size; y += 1) col += matrix[y][x] ? '1' : '0';
      for (let y = 0; y <= size - 11; y += 1) {
        const chunk = col.slice(y, y + 11);
        if (chunk === finderA || chunk === finderB) score += 40;
      }
    }

    let dark = 0;
    for (const row of matrix) for (const cell of row) if (cell) dark += 1;
    const total = size * size;
    const k = Math.max(0, Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1);
    return score + k * 10;
  }

  function drawFormat(matrix, mask) {
    const ecl = 1;
    const data = (ecl << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i += 1) {
      rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    }
    const bits = ((data << 10) | rem) ^ 0x5412;

    function bit(i) {
      return ((bits >>> i) & 1) !== 0;
    }

    for (let i = 0; i <= 5; i += 1) matrix[i][8] = bit(i);
    matrix[7][8] = bit(6);
    matrix[8][8] = bit(7);
    matrix[8][7] = bit(8);
    for (let i = 9; i < 15; i += 1) matrix[8][14 - i] = bit(i);
    for (let i = 0; i < 8; i += 1) matrix[8][size - 1 - i] = bit(i);
    for (let i = 8; i < 15; i += 1) matrix[size - 15 + i][8] = bit(i);
    matrix[size - 8][8] = true;
  }

  let bestMask = 0;
  let bestMatrix = null;
  let bestPenalty = Infinity;
  for (let mask = 0; mask < 8; mask += 1) {
    const candidate = applyMask(modules, mask);
    drawFormat(candidate, mask);
    const score = penalty(candidate);
    if (score < bestPenalty) {
      bestPenalty = score;
      bestMask = mask;
      bestMatrix = candidate;
    }
  }

  drawFormat(bestMatrix, bestMask);
  return bestMatrix;
}

function qrSvg(text) {
  const matrix = makeQrMatrix(text);
  const size = matrix.length;
  const quiet = 4;
  let pathData = '';
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (matrix[y][x]) pathData += `M${x + quiet},${y + quiet}h1v1h-1z`;
    }
  }
  const viewBox = `0 0 ${size + quiet * 2} ${size + quiet * 2}`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" shape-rendering="crispEdges">
  <rect width="100%" height="100%" fill="#fff"/>
  <path fill="#111" d="${pathData}"/>
</svg>`;
}

function presenterHtml() {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>手机口播提示</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #0f1726;
      --panel: #182235;
      --ink: #eef5ff;
      --muted: #aeb9cb;
      --accent: #13a383;
      --line: rgba(255, 255, 255, .14);
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background: radial-gradient(circle at 12% 10%, rgba(19, 163, 131, .18), transparent 30%), var(--bg);
      color: var(--ink);
    }
    main {
      display: grid;
      gap: 18px;
      width: min(920px, 100%);
      margin: 0 auto;
      padding: clamp(18px, 5vw, 34px) clamp(18px, 5vw, 34px) 128px;
    }
    .top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      color: var(--muted);
      font-weight: 750;
    }
    .pill {
      padding: 8px 12px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: rgba(255, 255, 255, .06);
    }
    .status.connected { color: var(--accent); }
    h1 {
      margin: 0;
      font-size: clamp(2.4rem, 11vw, 5.6rem);
      line-height: 1.02;
      letter-spacing: 0;
    }
    h2 {
      margin: 0 0 12px;
      color: var(--accent);
      font-size: clamp(1rem, 4vw, 1.3rem);
      letter-spacing: 0;
    }
    .muted {
      margin: 0;
      color: var(--muted);
      font-size: clamp(1rem, 4vw, 1.35rem);
      line-height: 1.45;
    }
    .panel {
      padding: clamp(18px, 5vw, 28px);
      border: 1px solid var(--line);
      border-radius: 18px;
      background: rgba(255, 255, 255, .055);
      box-shadow: 0 20px 70px rgba(0, 0, 0, .22);
    }
    .notes {
      font-size: clamp(1.35rem, 6vw, 2.25rem);
      line-height: 1.58;
    }
	    .next-title {
	      font-size: clamp(1.3rem, 5vw, 2rem);
	      font-weight: 780;
	      line-height: 1.3;
	      margin-bottom: 12px;
	    }
	    .preview-frame {
	      overflow: hidden;
	      border: 1px solid var(--line);
	      border-radius: 16px;
	      background: #eef3fb;
	      color: #111827;
	      aspect-ratio: 16 / 9;
	    }
	    .slide-preview {
	      width: 100%;
	      height: 100%;
	      padding: 5%;
	      overflow: hidden;
	      pointer-events: none;
	      background: linear-gradient(135deg, #f7f9fc, #e7edf6);
	      font-size: 8px;
	    }
	    .slide-preview .slide-body {
	      display: grid;
	      align-content: center;
	      gap: 6px;
	      height: 100%;
	    }
	    .slide-preview .slide-body.top { align-content: start; }
	    .slide-preview h1,
	    .slide-preview h2,
	    .slide-preview h3,
	    .slide-preview p { margin: 0; }
	    .slide-preview h1,
	    .slide-preview .macro-title {
	      font-size: 24px;
	      line-height: 1;
	    }
	    .slide-preview h2 {
	      font-size: 18px;
	      line-height: 1.06;
	    }
	    .slide-preview h3 {
	      font-size: 10px;
	    }
	    .slide-preview .lead,
	    .slide-preview p,
	    .slide-preview li {
	      font-size: 8px;
	      line-height: 1.35;
	    }
	    .slide-preview .grid,
	    .slide-preview .report-layout,
	    .slide-preview .macro-dashboard,
	    .slide-preview .signal-matrix,
	    .slide-preview .asset-map,
	    .slide-preview .meeting-timeline {
	      display: grid;
	      grid-template-columns: repeat(3, minmax(0, 1fr));
	      gap: 6px;
	    }
	    .slide-preview .report-layout {
	      grid-template-columns: .9fr 1.1fr;
	    }
	    .slide-preview .panel,
	    .slide-preview .callout,
	    .slide-preview .thesis-band,
	    .slide-preview .probability-strip,
	    .slide-preview .corridor-card,
	    .slide-preview .thermo-card,
	    .slide-preview .pricing-bar,
	    .slide-preview .path-map,
	    .slide-preview .verdict-panel,
	    .slide-preview .dashboard-card,
	    .slide-preview .signal-card,
	    .slide-preview .asset-node,
	    .slide-preview .meeting {
	      padding: 8px;
	      border: 1px solid rgba(17, 24, 39, .12);
	      border-radius: 8px;
	      background: rgba(255, 255, 255, .72);
	    }
	    .slide-preview .metric {
	      font-size: 22px;
	      font-weight: 850;
	      color: #174ea6;
	    }
	    .slide-preview .metric small {
	      display: block;
	      color: #5f6b7d;
	      font-size: 7px;
	    }
	    .slide-preview .probability-track {
	      display: flex;
	      min-height: 42px;
	      overflow: hidden;
	      border-radius: 8px;
	    }
	    .slide-preview .probability-segment {
	      display: grid;
	      align-content: center;
	      padding: 6px;
	      color: #fff;
	    }
	    .slide-preview .path-row,
	    .slide-preview .thermo-row {
	      display: grid;
	      grid-template-columns: 55px 1fr auto;
	      gap: 5px;
	      align-items: center;
	    }
	    .slide-preview .path-line,
	    .slide-preview .thermo-track {
	      display: block;
	      height: 8px;
	      border-radius: 999px;
	      background: #174ea6;
	    }
	    .slide-preview .quote {
	      font-size: 21px;
	      line-height: 1.05;
	      font-weight: 850;
	    }
	    .question-field {
	      width: 100%;
	      min-height: 130px;
	      resize: vertical;
	      border: 1px solid rgba(255, 255, 255, .2);
	      border-radius: 14px;
	      padding: 14px;
	      background: rgba(255, 255, 255, .08);
	      color: var(--ink);
	      font: inherit;
	      font-size: clamp(1.1rem, 4.8vw, 1.65rem);
	      line-height: 1.45;
	      outline: none;
	    }
	    .question-field:focus {
	      border-color: var(--accent);
	      box-shadow: 0 0 0 4px rgba(19, 163, 131, .16);
	    }
	    .remote-controls {
	      position: fixed;
	      left: 0;
	      right: 0;
	      bottom: 0;
	      display: flex;
	      gap: 10px;
	      padding: 12px max(14px, env(safe-area-inset-left)) calc(12px + env(safe-area-inset-bottom)) max(14px, env(safe-area-inset-right));
	      border-top: 1px solid var(--line);
	      background: rgba(15, 23, 38, .94);
	      backdrop-filter: blur(18px);
	      box-shadow: 0 -18px 50px rgba(0, 0, 0, .28);
	    }
	    .remote-button {
	      min-height: 58px;
	      border: 1px solid rgba(255, 255, 255, .18);
	      border-radius: 16px;
	      color: var(--ink);
	      font: inherit;
	      font-weight: 850;
	      cursor: pointer;
	      touch-action: manipulation;
	    }
	    .remote-button:disabled {
	      cursor: not-allowed;
	      opacity: .42;
	    }
	    .remote-prev {
	      flex: 0 0 32%;
	      background: rgba(255, 255, 255, .08);
	      font-size: 1.05rem;
	    }
	    .remote-next {
	      flex: 1;
	      border-color: rgba(19, 163, 131, .72);
	      background: var(--accent);
	      color: #062019;
	      font-size: 1.35rem;
	      box-shadow: 0 14px 30px rgba(19, 163, 131, .25);
	    }
	  </style>
</head>
<body>
  <main>
    <div class="top">
      <span class="pill">手机口播稿</span>
      <span class="pill" id="timer">00:00</span>
    </div>
    <p class="muted"><span id="counter">等待电脑端同步</span> · <span id="status" class="status">连接中</span></p>
    <h1 id="title">准备中</h1>
    <section class="panel">
      <h2>当前页口播稿</h2>
      <div class="notes" id="notes">请先在电脑端打开 PPT 页面。</div>
    </section>
	    <section class="panel">
	      <h2>下一页</h2>
	      <div class="next-title" id="nextTitle">等待同步</div>
	      <div class="preview-frame" id="nextPreview"></div>
	    </section>
	    <section class="panel">
	      <h2>互动性提问</h2>
	      <textarea class="question-field" id="questionInput" placeholder="同步后会自动生成一个互动问题，也可以在这里直接编辑。"></textarea>
	    </section>
	  </main>
	  <nav class="remote-controls" aria-label="PPT remote controls">
	    <button class="remote-button remote-prev" id="remotePrev" type="button">上一页</button>
	    <button class="remote-button remote-next" id="remoteNext" type="button">下一页</button>
	  </nav>
	  <script>
    const params = new URLSearchParams(location.search);
    const session = params.get('session') || '';
    const statusEl = document.getElementById('status');
    const timerEl = document.getElementById('timer');
    const counterEl = document.getElementById('counter');
	    const titleEl = document.getElementById('title');
	    const notesEl = document.getElementById('notes');
	    const nextTitleEl = document.getElementById('nextTitle');
	    const nextPreviewEl = document.getElementById('nextPreview');
	    const questionInputEl = document.getElementById('questionInput');
	    const remotePrevEl = document.getElementById('remotePrev');
	    const remoteNextEl = document.getElementById('remoteNext');
	    let activeState = null;
	    let commandSequence = 0;

	    function elapsedText(ms) {
	      const seconds = Math.max(0, Math.floor(ms / 1000));
	      const minutes = Math.floor(seconds / 60);
	      return String(minutes).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
	    }

	    function questionKey(state) {
	      return 'presenter-question:' + session + ':' + state.slideIndex;
	    }

	    function renderQuestion(state) {
	      const saved = localStorage.getItem(questionKey(state));
	      questionInputEl.value = saved !== null ? saved : (state.interactiveQuestion || '这一页可以向听众提出什么问题？');
	    }

	    function renderState(state) {
	      activeState = state;
      const fragmentLabel = state.fragmentCount ? ' · 动画 ' + Math.min(state.fragmentIndex, state.fragmentCount) + '/' + state.fragmentCount : '';
      counterEl.textContent = (state.slideIndex + 1) + ' / ' + state.slideCount + fragmentLabel;
	      titleEl.textContent = state.title || '当前页';
	      notesEl.innerHTML = state.notesHtml || '这一页没有备注。';
	      nextTitleEl.textContent = state.nextTitle || '已经是最后一页';
	      nextPreviewEl.innerHTML = state.nextSlidePreviewHtml || '<div class="slide-preview"><div class="slide-body"><p class="muted">已经是最后一页</p></div></div>';
	      renderQuestion(state);
	      timerEl.textContent = elapsedText(Date.now() - (state.startedAt || Date.now()));
	      updateRemoteButtons();
	    }

	    function isAtStart(state) {
	      return !state || ((state.slideIndex || 0) <= 0 && (state.fragmentIndex || 0) <= 0);
	    }

	    function isAtEnd(state) {
	      if (!state) return true;
	      return (state.slideIndex || 0) >= (state.slideCount || 1) - 1 && (state.fragmentIndex || 0) >= (state.fragmentCount || 0);
	    }

	    function updateRemoteButtons() {
	      remotePrevEl.disabled = isAtStart(activeState);
	      remoteNextEl.disabled = isAtEnd(activeState);
	    }

	    function sendCommand(action) {
	      if (!session || (action !== 'prev' && action !== 'next')) return;
	      commandSequence += 1;
	      const commandId = Date.now().toString(36) + '-' + commandSequence.toString(36);
	      fetch('/sync/command?session=' + encodeURIComponent(session), {
	        method: 'POST',
	        headers: { 'Content-Type': 'application/json' },
	        body: JSON.stringify({ action, commandId })
	      }).then(response => {
	        if (!response.ok) throw new Error('Command failed');
	      }).catch(() => {
	        statusEl.textContent = '发送失败';
	        statusEl.classList.remove('connected');
	      });
	    }

	    questionInputEl.addEventListener('input', () => {
	      if (!activeState) return;
	      const key = questionKey(activeState);
	      if (questionInputEl.value.trim()) {
	        localStorage.setItem(key, questionInputEl.value);
	      } else {
	        localStorage.removeItem(key);
	      }
	    });
	    remotePrevEl.addEventListener('click', () => sendCommand('prev'));
	    remoteNextEl.addEventListener('click', () => sendCommand('next'));
	    updateRemoteButtons();

    setInterval(() => {
      if (activeState) timerEl.textContent = elapsedText(Date.now() - (activeState.startedAt || Date.now()));
    }, 1000);

    if (!session || !window.EventSource) {
      statusEl.textContent = '无法连接';
    } else {
      const events = new EventSource('/sync/events?session=' + encodeURIComponent(session));
      events.addEventListener('open', () => {
        statusEl.textContent = '已连接';
        statusEl.classList.add('connected');
      });
      events.addEventListener('state', event => renderState(JSON.parse(event.data)));
      events.addEventListener('error', () => {
        statusEl.textContent = '重连中';
        statusEl.classList.remove('connected');
      });
    }
  </script>
</body>
</html>`;
}

async function main() {
  const options = parseArgs(args);
  if (options.help || !options.deckPath || !Number.isFinite(options.port) || !isValidDeckHost(options.deckHost)) {
    console.log(usage());
    process.exit(options.help ? 0 : 1);
  }

  const deckPath = path.resolve(options.deckPath);
  const deckName = path.basename(deckPath);
  await fs.access(deckPath);

  const session = crypto.randomBytes(6).toString('hex');
	  const clients = new Set();
	  const commandClients = new Set();
	  let latestState = null;
  const lanIp = getLanIp();

  function originFor(hostname) {
    return `http://${hostname}:${options.port}`;
  }

  function urls(hostname = lanIp) {
    const origin = originFor(hostname);
    return {
      deckUrl: `${origin}/deck?session=${session}`,
      presenterUrl: `${origin}/presenter?session=${session}`,
      qrUrl: `${origin}/qr.svg?session=${session}&text=${encodeURIComponent(`${origin}/presenter?session=${session}`)}`
    };
  }

  function publicUrls() {
    const local = urls('127.0.0.1');
    const lan = urls(lanIp);
    const selectedDeckUrl = options.deckHost === 'local' ? local.deckUrl : lan.deckUrl;
    return {
      local,
      lan,
      selectedDeckUrl
    };
  }

  function validSession(searchParams) {
    return searchParams.get('session') === session;
  }

	  function broadcast(state) {
	    const payload = `event: state\ndata: ${JSON.stringify(state)}\n\n`;
	    for (const res of clients) res.write(payload);
	  }

	  function broadcastCommand(command) {
	    const payload = `event: command\ndata: ${JSON.stringify(command)}\n\n`;
	    for (const res of commandClients) res.write(payload);
	  }

  const server = http.createServer(async (req, res) => {
    try {
      const requestUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      const route = requestUrl.pathname;

      if (route === '/' || route === `/${deckName}`) {
        res.writeHead(302, { Location: `/deck?session=${session}` });
        res.end();
        return;
      }

      if (route === '/deck') {
        if (!validSession(requestUrl.searchParams)) {
          send(res, 403, 'Invalid session', { 'Content-Type': 'text/plain; charset=utf-8' });
          return;
        }
        const html = await fs.readFile(deckPath, 'utf8');
        send(res, 200, html, { 'Content-Type': 'text/html; charset=utf-8' });
        return;
      }

      if (route === '/presenter') {
        if (!validSession(requestUrl.searchParams)) {
          send(res, 403, 'Invalid session', { 'Content-Type': 'text/plain; charset=utf-8' });
          return;
        }
        send(res, 200, presenterHtml(), { 'Content-Type': 'text/html; charset=utf-8' });
        return;
      }

      if (route === '/sync/config') {
        if (!validSession(requestUrl.searchParams)) {
          sendJson(res, 403, { error: 'Invalid session' });
          return;
        }
        const { local, lan, selectedDeckUrl } = publicUrls();
        sendJson(res, 200, {
          session,
          lanIp,
          deckUrl: selectedDeckUrl,
          computerDeckUrl: selectedDeckUrl,
          localDeckUrl: local.deckUrl,
          lanDeckUrl: lan.deckUrl,
          presenterUrl: lan.presenterUrl,
          qrUrl: lan.qrUrl
        });
        return;
      }

	      if (route === '/sync/state' && req.method === 'POST') {
	        if (!validSession(requestUrl.searchParams)) {
	          sendJson(res, 403, { error: 'Invalid session' });
	          return;
	        }
	        const body = await readRequestBody(req);
	        latestState = { ...JSON.parse(body), receivedAt: Date.now() };
	        broadcast(latestState);
	        sendJson(res, 200, { ok: true });
	        return;
	      }

	      if (route === '/sync/command' && req.method === 'POST') {
	        if (!validSession(requestUrl.searchParams)) {
	          sendJson(res, 403, { error: 'Invalid session' });
	          return;
	        }
	        const body = await readRequestBody(req);
	        const parsed = JSON.parse(body);
	        const action = parsed && parsed.action;
	        if (action !== 'prev' && action !== 'next') {
	          sendJson(res, 400, { error: 'Invalid action' });
	          return;
	        }
	        const command = {
	          action,
	          commandId: typeof parsed.commandId === 'string' && parsed.commandId ? parsed.commandId : crypto.randomBytes(8).toString('hex'),
	          issuedAt: Date.now()
	        };
	        broadcastCommand(command);
	        sendJson(res, 200, { ok: true, commandId: command.commandId });
	        return;
	      }

	      if (route === '/sync/events') {
	        if (!validSession(requestUrl.searchParams)) {
	          send(res, 403, 'Invalid session', { 'Content-Type': 'text/plain; charset=utf-8' });
	          return;
	        }
	        res.writeHead(200, {
	          'Content-Type': 'text/event-stream; charset=utf-8',
	          'Cache-Control': 'no-store',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no'
        });
        res.write(': connected\n\n');
        clients.add(res);
        if (latestState) res.write(`event: state\ndata: ${JSON.stringify(latestState)}\n\n`);
        const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 15000);
        req.on('close', () => {
          clearInterval(heartbeat);
          clients.delete(res);
	        });
	        return;
	      }

	      if (route === '/sync/commands') {
	        if (!validSession(requestUrl.searchParams)) {
	          send(res, 403, 'Invalid session', { 'Content-Type': 'text/plain; charset=utf-8' });
	          return;
	        }
	        res.writeHead(200, {
	          'Content-Type': 'text/event-stream; charset=utf-8',
	          'Cache-Control': 'no-store',
	          Connection: 'keep-alive',
	          'X-Accel-Buffering': 'no'
	        });
	        res.write(': connected\n\n');
	        commandClients.add(res);
	        const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 15000);
	        req.on('close', () => {
	          clearInterval(heartbeat);
	          commandClients.delete(res);
	        });
	        return;
	      }

      if (route === '/qr.svg') {
        if (!validSession(requestUrl.searchParams)) {
          send(res, 403, 'Invalid session', { 'Content-Type': 'text/plain; charset=utf-8' });
          return;
        }
        const text = requestUrl.searchParams.get('text') || urls(lanIp).presenterUrl;
        send(res, 200, qrSvg(text), { 'Content-Type': 'image/svg+xml; charset=utf-8' });
        return;
      }

      if (route === '/favicon.ico') {
        send(res, 204, '');
        return;
      }

      send(res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });
    } catch (error) {
      sendJson(res, 500, { error: error.message || String(error) });
    }
  });

  try {
    await listenOnAvailablePort(server, options);
    const { local, lan, selectedDeckUrl } = publicUrls();
    console.log(`Serving ${deckPath}`);
    console.log(`Computer PPT: ${selectedDeckUrl}`);
    console.log(`Computer PPT (local fallback): ${local.deckUrl}`);
    console.log(`Phone Presenter (same Wi-Fi): ${lan.presenterUrl}`);
    console.log(`QR (same Wi-Fi): ${lan.qrUrl}`);
    if (lanIp === '127.0.0.1') {
      console.log('No LAN IP was detected. Phone sync needs the computer and phone on the same Wi-Fi.');
      console.log('Falling back to a local-only browser session.');
    }
    console.log('Keep this terminal open while presenting.');
    console.log('This server is the default Codex publish path for phone-sync sessions; opening the raw HTML file will stay in offline file mode.');

    if (options.open) {
      openUrl(selectedDeckUrl);
    }
  } catch (error) {
    console.error(error.message || String(error));
    process.exit(1);
  }

  server.on('error', error => {
    console.error(error.message || String(error));
  });
}

main();
