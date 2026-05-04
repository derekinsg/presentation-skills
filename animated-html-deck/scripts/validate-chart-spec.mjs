#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);

export const allowedTypes = new Set([
  'kpi-strip',
  'timeline',
  'quadrant',
  'scenario-matrix',
  'yield-curve',
  'funnel',
  'waterfall',
  'heatmap'
]);

const remotePattern = /\b(?:https?:)?\/\/|(?:unpkg|jsdelivr|fonts\.googleapis|cdn\.)/i;

function usage() {
  return [
    'Usage: node animated-html-deck/scripts/validate-chart-spec.mjs [chart-spec.json]',
    '',
    'Reads a chart spec JSON file or stdin and validates the skill-level chart contract.'
  ].join('\n');
}

export async function readJsonInput(fileArg) {
  const raw = fileArg
    ? await fs.readFile(fileArg, 'utf8')
    : await readStdin();
  return JSON.parse(raw || '{}');
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return chunks.join('');
}

function visitStrings(value, visitor) {
  if (typeof value === 'string') {
    visitor(value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach(item => visitStrings(item, visitor));
    return;
  }
  if (value && typeof value === 'object') {
    Object.values(value).forEach(item => visitStrings(item, visitor));
  }
}

function hasRemoteReference(spec) {
  let found = false;
  visitStrings(spec, value => {
    if (remotePattern.test(value)) found = true;
  });
  return found;
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function requireArray(errors, value, pathLabel, minLength = 1) {
  if (!Array.isArray(value) || value.length < minLength) {
    errors.push(`${pathLabel} must be an array with at least ${minLength} item(s).`);
    return false;
  }
  return true;
}

function validateTypeData(spec, errors) {
  const data = spec.data || {};

  if (spec.type === 'kpi-strip') {
    if (!requireArray(errors, data.items, 'data.items', 2)) return;
    data.items.forEach((item, index) => {
      if (!isNonEmptyString(item.label)) errors.push(`data.items[${index}].label is required.`);
      if (!isNonEmptyString(String(item.value ?? ''))) errors.push(`data.items[${index}].value is required.`);
    });
  }

  if (spec.type === 'timeline') {
    if (!requireArray(errors, data.events, 'data.events', 2)) return;
    data.events.forEach((event, index) => {
      if (!isNonEmptyString(event.label)) errors.push(`data.events[${index}].label is required.`);
      if (!isNonEmptyString(event.date)) errors.push(`data.events[${index}].date is required.`);
    });
  }

  if (spec.type === 'quadrant') {
    if (!data.xAxis || !data.yAxis) errors.push('data.xAxis and data.yAxis are required.');
    if (!requireArray(errors, data.items, 'data.items', 2)) return;
    data.items.forEach((item, index) => {
      if (!isNonEmptyString(item.label)) errors.push(`data.items[${index}].label is required.`);
      if (!Number.isFinite(Number(item.x)) || !Number.isFinite(Number(item.y))) {
        errors.push(`data.items[${index}].x and y must be numeric.`);
      }
    });
  }

  if (spec.type === 'scenario-matrix') {
    if (!requireArray(errors, data.scenarios, 'data.scenarios', 2)) return;
    data.scenarios.forEach((scenario, index) => {
      if (!isNonEmptyString(scenario.name)) errors.push(`data.scenarios[${index}].name is required.`);
      if (!isNonEmptyString(scenario.impact)) errors.push(`data.scenarios[${index}].impact is required.`);
    });
  }

  if (spec.type === 'yield-curve') {
    if (!requireArray(errors, data.points, 'data.points', 2)) return;
    data.points.forEach((point, index) => {
      if (!isNonEmptyString(point.label)) errors.push(`data.points[${index}].label is required.`);
      if (!Number.isFinite(Number(point.value))) errors.push(`data.points[${index}].value must be numeric.`);
    });
  }

  if (spec.type === 'funnel') {
    if (!requireArray(errors, data.steps, 'data.steps', 2)) return;
    data.steps.forEach((step, index) => {
      if (!isNonEmptyString(step.label)) errors.push(`data.steps[${index}].label is required.`);
      if (!Number.isFinite(Number(step.value))) errors.push(`data.steps[${index}].value must be numeric.`);
    });
  }

  if (spec.type === 'waterfall') {
    if (!requireArray(errors, data.steps, 'data.steps', 2)) return;
    data.steps.forEach((step, index) => {
      if (!isNonEmptyString(step.label)) errors.push(`data.steps[${index}].label is required.`);
      if (!Number.isFinite(Number(step.value))) errors.push(`data.steps[${index}].value must be numeric.`);
    });
  }

  if (spec.type === 'heatmap') {
    if (!requireArray(errors, data.xLabels, 'data.xLabels', 2)) return;
    if (!requireArray(errors, data.yLabels, 'data.yLabels', 2)) return;
    if (!requireArray(errors, data.cells, 'data.cells', 2)) return;
    data.cells.forEach((cell, index) => {
      if (!Number.isInteger(Number(cell.x)) || !Number.isInteger(Number(cell.y))) {
        errors.push(`data.cells[${index}].x and y must be integer coordinates.`);
      }
      if (!Number.isFinite(Number(cell.value))) errors.push(`data.cells[${index}].value must be numeric.`);
    });
  }
}

export function validateChartSpec(spec) {
  const errors = [];

  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    return { ok: false, errors: ['Chart spec must be an object.'] };
  }
  if (!allowedTypes.has(spec.type)) errors.push(`Unsupported chart type: ${spec.type || 'missing'}.`);
  if (!isNonEmptyString(spec.title)) errors.push('title is required.');
  if (!isNonEmptyString(spec.takeaway)) errors.push('takeaway is required.');
  if (!spec.data || typeof spec.data !== 'object' || Array.isArray(spec.data)) errors.push('data object is required.');
  if (spec.dataIntegrity && !['sourced', 'user-provided', 'assumption', 'illustrative'].includes(spec.dataIntegrity)) {
    errors.push('dataIntegrity must be sourced, user-provided, assumption, or illustrative.');
  }
  if (hasRemoteReference(spec)) errors.push('Chart spec must not include remote URLs, CDNs, or remote font/script references.');
  if (allowedTypes.has(spec.type) && spec.data && typeof spec.data === 'object') validateTypeData(spec, errors);

  return { ok: errors.length === 0, errors };
}

async function main() {
  const arg = process.argv[2];
  if (arg === '--help' || arg === '-h') {
    console.log(usage());
    process.exit(0);
  }

  const spec = await readJsonInput(arg);
  const result = validateChartSpec(spec);
  if (!result.ok) {
    console.error(result.errors.join('\n'));
    process.exit(1);
  }
  console.log(JSON.stringify({
    ok: true,
    type: spec.type,
    title: spec.title
  }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch(error => {
    console.error(error.message || String(error));
    process.exit(1);
  });
}
