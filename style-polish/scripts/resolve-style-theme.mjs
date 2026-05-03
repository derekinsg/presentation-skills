#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const skillRoot = path.resolve(__dirname, '..');
const catalogPath = path.join(skillRoot, 'styles', 'style-catalog.json');

function parseArgs(argv) {
  const options = {
    style: '',
    medium: 'generic-html',
    purpose: 'explainer',
    seriousness: 5
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--style') options.style = argv[++i] || '';
    else if (arg === '--medium') options.medium = argv[++i] || options.medium;
    else if (arg === '--purpose') options.purpose = argv[++i] || options.purpose;
    else if (arg === '--seriousness') options.seriousness = Number(argv[++i]) || options.seriousness;
    else if (arg === '--help' || arg === '-h') options.help = true;
  }

  return options;
}

function usage() {
  return [
    'Usage: node scripts/resolve-style-theme.mjs [--style "vercel"] [--medium ppt] [--purpose launch] [--seriousness 6]',
    '',
    'Examples:',
    '  node scripts/resolve-style-theme.mjs --style vercel --medium ppt --purpose launch --seriousness 6',
    '  node scripts/resolve-style-theme.mjs --style "high-end developer tool" --medium web --purpose explainer --seriousness 7'
  ].join('\n');
}

function normalize(text) {
  return (text || '').toLowerCase().trim();
}

function keywordScore(text, keywords) {
  const haystack = normalize(text);
  return keywords.reduce((score, keyword) => score + (haystack.includes(keyword) ? 1 : 0), 0);
}

function desiredFamily(styleText, medium, purpose, seriousness) {
  const combined = `${styleText} ${medium} ${purpose}`;
  if (keywordScore(combined, ['linear', 'vercel', 'developer tool', 'tooling', 'infra', 'terminal', 'code']) > 0) {
    return seriousness >= 7 ? 'executive-report' : 'dark-tooling';
  }
  if (keywordScore(combined, ['airbnb', 'warm', 'friendly', 'community', 'teaching']) > 0) {
    return 'warm-editorial';
  }
  if (keywordScore(combined, ['report', 'analysis', 'consulting', 'board', 'strategy']) > 0) {
    return seriousness >= 7 ? 'consulting-report' : 'executive-report';
  }
  if (keywordScore(combined, ['luxury', 'tesla', 'ferrari', 'premium brand']) > 0) {
    return 'luxury-brand';
  }
  if (keywordScore(combined, ['cinematic', 'spotify', 'runway', 'media']) > 0) {
    return 'cinematic-dark';
  }
  if (purpose === 'report') return seriousness >= 7 ? 'consulting-report' : 'executive-report';
  if (purpose === 'teaching') return 'warm-editorial';
  if (purpose === 'launch') return 'product-launch';
  return medium === 'ppt' ? 'product-launch' : 'minimal-monochrome';
}

function styleScore(style, styleText, medium, purpose, seriousness) {
  const sourceText = [
    style.id,
    style.displayName,
    style.summary,
    style.layoutFamily,
    ...(style.suitability?.recommendedUses || [])
  ].join(' ');

  let score = 0;
  const query = normalize(styleText);
  if (!query) score += 1;
  if (query === normalize(style.id) || query === normalize(style.displayName)) score += 100;
  if (query && normalize(style.id).includes(query)) score += 40;
  if (query && normalize(style.displayName).includes(query)) score += 24;

  if (query.includes('developer tool') || query.includes('开发者工具') || query.includes('tooling') || query.includes('infra')) {
    if (style.id === 'linear.app') score += seriousness >= 7 ? 18 : 10;
    if (style.id === 'vercel') score += seriousness >= 7 ? 14 : 8;
    if (style.id === 'cursor') score += seriousness >= 7 ? 6 : 10;
    if (style.id === 'supabase') score += 8;
  }

  const preferredFamily = desiredFamily(styleText, medium, purpose, seriousness);
  if (style.layoutFamily === preferredFamily) score += 20;
  if (style.runtimeTemplateFallback === 'consulting' && purpose === 'report') score += 6;
  if (style.runtimeTemplateFallback === 'executive' && seriousness >= 7) score += 5;
  if (style.runtimeTemplateFallback === 'airbnb' && purpose === 'teaching') score += 5;
  if (style.runtimeTemplateFallback === 'apple' && purpose === 'launch') score += 5;

  score += keywordScore(query, [normalize(style.id), normalize(style.displayName)]) * 18;
  score += keywordScore(query, (style.suitability?.recommendedUses || []).map(normalize)) * 8;
  score += keywordScore(query, [normalize(style.layoutFamily)]) * 10;
  score += keywordScore(query, ['dark', 'night']) && style.traits?.darkCanvas ? 4 : 0;
  score += keywordScore(query, ['warm', 'friendly']) && style.layoutFamily === 'warm-editorial' ? 4 : 0;
  score += keywordScore(query, ['minimal', 'clean', 'restrained']) && style.layoutFamily === 'minimal-monochrome' ? 4 : 0;

  const range = style.suitability?.seriousnessRange || [1, 10];
  if (seriousness >= range[0] && seriousness <= range[1]) score += 5;

  score += keywordScore(sourceText, query.split(/\s+/).filter(Boolean)) * 0.5;
  return score;
}

function translationGuidance(style, medium, purpose) {
  const notes = [];
  notes.push(`Use ${style.displayName} as the source style, but translate it into ${medium} information design instead of reproducing homepage chrome.`);

  if (style.layoutFamily === 'dark-tooling') {
    notes.push('Keep dark surfaces, hairline edges, and tight typography, but preserve high-contrast text blocks for readability.');
  } else if (style.layoutFamily === 'warm-editorial') {
    notes.push('Keep the warmth, generous whitespace, and rounded surfaces, but reduce decorative consumer UI when the content is dense.');
  } else if (style.layoutFamily === 'consulting-report' || style.layoutFamily === 'executive-report') {
    notes.push('Favor stable grids, sober contrast, and chart clarity over marketing flourish.');
  } else if (style.layoutFamily === 'product-launch') {
    notes.push('Use the source palette and typography bias to support hero statements, proof cards, and clean visual pacing.');
  } else if (style.layoutFamily === 'minimal-monochrome') {
    notes.push('Preserve restraint and whitespace, but ensure there is still enough hierarchy for scanning and speaking.');
  }

  if (purpose === 'report' && !style.suitability?.supportsDenseReport) {
    notes.push('Because the source style is not naturally report-heavy, keep its palette and type cues but structure the layout like a report.');
  }

  return notes.join(' ');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    process.exit(0);
  }

  const catalog = JSON.parse(await fs.readFile(catalogPath, 'utf8'));
  const styles = catalog.styles || [];
  const sorted = styles
    .map(style => ({
      style,
      score: styleScore(style, options.style, options.medium, options.purpose, options.seriousness)
    }))
    .sort((a, b) => b.score - a.score);

  const chosen = sorted[0]?.style;
  if (!chosen) {
    console.error('No styles found in catalog.');
    process.exit(1);
  }

  const result = {
    sourceStyleId: chosen.id,
    displayName: chosen.displayName,
    layoutFamily: chosen.layoutFamily,
    runtimeTemplateFallback: chosen.runtimeTemplateFallback,
    tokens: chosen.tokens,
    suitability: chosen.suitability,
    translationGuidance: translationGuidance(chosen, options.medium, options.purpose)
  };

  console.log(JSON.stringify(result, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
