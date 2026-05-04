#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJsonInput, validateChartSpec } from './validate-chart-spec.mjs';

const __filename = fileURLToPath(import.meta.url);

function usage() {
  return [
    'Usage: node animated-html-deck/scripts/render-chart-spec.mjs [chart-spec.json]',
    '',
    'Renders a validated chart spec to inline HTML/SVG for single-file decks.'
  ].join('\n');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, '&#39;');
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function chartSpecAttr(spec) {
  return escapeAttr(JSON.stringify(spec));
}

function header(spec) {
  return [
    `<div class="chart-title">${escapeHtml(spec.title)}</div>`,
    `<div class="chart-takeaway">${escapeHtml(spec.takeaway)}</div>`
  ].join('');
}

function footer(spec) {
  const parts = [];
  if (spec.source) parts.push(`<span class="chart-source">${escapeHtml(spec.source)}</span>`);
  if (spec.note || spec.dataIntegrity) {
    const note = spec.note || `Data integrity: ${spec.dataIntegrity}`;
    parts.push(`<span class="chart-note">${escapeHtml(note)}</span>`);
  }
  return parts.length ? `<div class="chart-meta">${parts.join('')}</div>` : '';
}

function wrap(spec, body) {
  return [
    `<figure class="viz-card" data-chart-type="${escapeAttr(spec.type)}" data-chart-spec='${chartSpecAttr(spec)}'>`,
    header(spec),
    body,
    footer(spec),
    '</figure>'
  ].join('');
}

function renderKpiStrip(spec) {
  const items = spec.data.items.map(item => [
    '<div class="viz-kpi">',
    `<strong>${escapeHtml(item.value)}</strong>`,
    `<span>${escapeHtml(item.label)}</span>`,
    item.note ? `<small>${escapeHtml(item.note)}</small>` : '',
    '</div>'
  ].join('')).join('');
  return wrap(spec, `<div class="viz-kpi-strip">${items}</div>`);
}

function renderTimeline(spec) {
  const events = spec.data.events.map((event, index) => [
    '<div class="viz-timeline-item">',
    `<span class="viz-index">${index + 1}</span>`,
    `<strong>${escapeHtml(event.date)}</strong>`,
    `<p>${escapeHtml(event.label)}</p>`,
    '</div>'
  ].join('')).join('');
  return wrap(spec, `<div class="viz-timeline">${events}</div>`);
}

function renderQuadrant(spec) {
  const width = 760;
  const height = 420;
  const items = spec.data.items.map(item => {
    const x = 80 + clamp(Number(item.x), 0, 100) / 100 * 600;
    const y = 350 - clamp(Number(item.y), 0, 100) / 100 * 280;
    return `<g><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="9" class="viz-dot"></circle><text x="${(x + 14).toFixed(1)}" y="${(y + 5).toFixed(1)}">${escapeHtml(item.label)}</text></g>`;
  }).join('');
  const svg = `<svg class="viz-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeAttr(spec.title)}">
    <line x1="80" y1="210" x2="680" y2="210" class="viz-axis"></line>
    <line x1="380" y1="70" x2="380" y2="350" class="viz-axis"></line>
    <rect x="80" y="70" width="600" height="280" class="viz-plot"></rect>
    ${items}
    <text x="80" y="390" class="viz-axis-label">${escapeHtml(spec.data.xAxis?.low || 'Low')} ← ${escapeHtml(spec.data.xAxis?.label || 'X axis')} → ${escapeHtml(spec.data.xAxis?.high || 'High')}</text>
    <text x="24" y="70" class="viz-axis-label" transform="rotate(-90 24 70)">${escapeHtml(spec.data.yAxis?.label || 'Y axis')}</text>
  </svg>`;
  return wrap(spec, svg);
}

function renderScenarioMatrix(spec) {
  const rows = spec.data.scenarios.map(scenario => [
    '<div class="viz-scenario">',
    `<strong>${escapeHtml(scenario.name)}</strong>`,
    scenario.probability ? `<span>${escapeHtml(scenario.probability)}</span>` : '',
    `<p>${escapeHtml(scenario.impact)}</p>`,
    scenario.signal ? `<small>${escapeHtml(scenario.signal)}</small>` : '',
    '</div>'
  ].join('')).join('');
  return wrap(spec, `<div class="viz-scenarios">${rows}</div>`);
}

function renderYieldCurve(spec) {
  const points = spec.data.points;
  const values = points.map(point => Number(point.value));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const coords = points.map((point, index) => {
    const x = 70 + (index / Math.max(points.length - 1, 1)) * 640;
    const y = 330 - ((Number(point.value) - min) / span) * 230;
    return { x, y, point };
  });
  const polyline = coords.map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const markers = coords.map(({ x, y, point }) => `<g><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6" class="viz-dot"></circle><text x="${(x - 18).toFixed(1)}" y="370">${escapeHtml(point.label)}</text><text x="${(x - 16).toFixed(1)}" y="${(y - 12).toFixed(1)}">${escapeHtml(point.value)}</text></g>`).join('');
  const svg = `<svg class="viz-svg" viewBox="0 0 780 410" role="img" aria-label="${escapeAttr(spec.title)}">
    <rect x="60" y="70" width="660" height="270" class="viz-plot"></rect>
    <line x1="60" y1="340" x2="720" y2="340" class="viz-axis"></line>
    <line x1="60" y1="70" x2="60" y2="340" class="viz-axis"></line>
    <polyline points="${polyline}" class="viz-line"></polyline>
    ${markers}
  </svg>`;
  return wrap(spec, svg);
}

function renderFunnel(spec) {
  const values = spec.data.steps.map(step => Number(step.value));
  const max = Math.max(...values, 1);
  const steps = spec.data.steps.map((step, index) => {
    const width = 96 - (1 - Number(step.value) / max) * 48;
    return `<div class="viz-funnel-step" style="--w:${width.toFixed(1)}%"><strong>${escapeHtml(step.label)}</strong><span>${escapeHtml(step.value)}</span></div>`;
  }).join('');
  return wrap(spec, `<div class="viz-funnel">${steps}</div>`);
}

function renderWaterfall(spec) {
  let running = 0;
  const values = spec.data.steps.map(step => Number(step.value));
  const maxAbs = Math.max(...values.map(value => Math.abs(value)), 1);
  const bars = spec.data.steps.map(step => {
    running += Number(step.value);
    const magnitude = 42 + Math.abs(Number(step.value)) / maxAbs * 170;
    const direction = Number(step.value) >= 0 ? 'positive' : 'negative';
    return `<div class="viz-waterfall-bar ${direction}" style="--h:${magnitude.toFixed(1)}px"><strong>${escapeHtml(step.value)}</strong><span>${escapeHtml(step.label)}</span></div>`;
  }).join('');
  return wrap(spec, `<div class="viz-waterfall" aria-label="Waterfall ending at ${escapeAttr(running)}">${bars}</div>`);
}

function renderHeatmap(spec) {
  const xLabels = spec.data.xLabels;
  const yLabels = spec.data.yLabels;
  const cells = spec.data.cells;
  const max = Math.max(...cells.map(cell => Number(cell.value)), 1);
  const cellMap = new Map(cells.map(cell => [`${cell.x}:${cell.y}`, cell]));
  const rows = yLabels.map((yLabel, y) => {
    const rowCells = xLabels.map((xLabel, x) => {
      const cell = cellMap.get(`${x}:${y}`) || { value: 0, label: '' };
      const intensity = clamp(Number(cell.value) / max, 0, 1);
      return `<div class="viz-heat-cell" style="--i:${intensity.toFixed(2)}"><strong>${escapeHtml(cell.label || cell.value)}</strong></div>`;
    }).join('');
    return `<div class="viz-heat-row"><span>${escapeHtml(yLabel)}</span>${rowCells}</div>`;
  }).join('');
  const headers = xLabels.map(label => `<span>${escapeHtml(label)}</span>`).join('');
  return wrap(spec, `<div class="viz-heatmap" style="--heat-cols:${xLabels.length}"><div class="viz-heat-head"><span></span>${headers}</div>${rows}</div>`);
}

export function renderChartSpec(spec) {
  const validation = validateChartSpec(spec);
  if (!validation.ok) {
    throw new Error(validation.errors.join('\n'));
  }
  if (spec.type === 'kpi-strip') return renderKpiStrip(spec);
  if (spec.type === 'timeline') return renderTimeline(spec);
  if (spec.type === 'quadrant') return renderQuadrant(spec);
  if (spec.type === 'scenario-matrix') return renderScenarioMatrix(spec);
  if (spec.type === 'yield-curve') return renderYieldCurve(spec);
  if (spec.type === 'funnel') return renderFunnel(spec);
  if (spec.type === 'waterfall') return renderWaterfall(spec);
  if (spec.type === 'heatmap') return renderHeatmap(spec);
  throw new Error(`Unsupported chart type: ${spec.type}`);
}

async function main() {
  const arg = process.argv[2];
  if (arg === '--help' || arg === '-h') {
    console.log(usage());
    process.exit(0);
  }
  const spec = await readJsonInput(arg);
  process.stdout.write(renderChartSpec(spec));
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch(error => {
    console.error(error.message || String(error));
    process.exit(1);
  });
}
