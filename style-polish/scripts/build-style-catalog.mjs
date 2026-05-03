#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const skillRoot = path.resolve(__dirname, '..');
const vendorRoot = path.join(skillRoot, 'vendor', 'awesome-design-md', 'design-md');
const outputRoot = path.join(skillRoot, 'styles');
const outputFile = path.join(outputRoot, 'style-catalog.json');

const FAMILY_CONFIG = {
  'product-launch': {
    runtimeTemplateFallback: 'apple',
    recommendedUses: ['product-launch', 'tool-showcase', 'capability-intro', 'founder-demo'],
    seriousnessRange: [4, 8],
    supportsCharts: true,
    supportsDenseReport: false,
    supportsSpeakerNarrative: true,
    darkDeckPreferred: false
  },
  'warm-editorial': {
    runtimeTemplateFallback: 'airbnb',
    recommendedUses: ['teaching', 'onboarding', 'community-story', 'consumer-explainer'],
    seriousnessRange: [2, 6],
    supportsCharts: true,
    supportsDenseReport: false,
    supportsSpeakerNarrative: true,
    darkDeckPreferred: false
  },
  'executive-report': {
    runtimeTemplateFallback: 'executive',
    recommendedUses: ['board-update', 'leadership-brief', 'investor-summary', 'enterprise-pitch'],
    seriousnessRange: [7, 10],
    supportsCharts: true,
    supportsDenseReport: true,
    supportsSpeakerNarrative: true,
    darkDeckPreferred: false
  },
  'consulting-report': {
    runtimeTemplateFallback: 'consulting',
    recommendedUses: ['strategy-report', 'market-analysis', 'transformation-plan', 'decision-memo'],
    seriousnessRange: [7, 10],
    supportsCharts: true,
    supportsDenseReport: true,
    supportsSpeakerNarrative: true,
    darkDeckPreferred: false
  },
  'dark-tooling': {
    runtimeTemplateFallback: 'executive',
    recommendedUses: ['developer-tool', 'product-demo', 'technical-explainer', 'launch-deck'],
    seriousnessRange: [5, 8],
    supportsCharts: true,
    supportsDenseReport: false,
    supportsSpeakerNarrative: true,
    darkDeckPreferred: true
  },
  'minimal-monochrome': {
    runtimeTemplateFallback: 'apple',
    recommendedUses: ['founder-story', 'brand-intro', 'minimal-report', 'portfolio-case'],
    seriousnessRange: [5, 9],
    supportsCharts: true,
    supportsDenseReport: false,
    supportsSpeakerNarrative: true,
    darkDeckPreferred: false
  },
  'luxury-brand': {
    runtimeTemplateFallback: 'apple',
    recommendedUses: ['premium-brand', 'vision-deck', 'campaign-idea', 'high-end-showcase'],
    seriousnessRange: [4, 8],
    supportsCharts: false,
    supportsDenseReport: false,
    supportsSpeakerNarrative: true,
    darkDeckPreferred: false
  },
  'playful-consumer': {
    runtimeTemplateFallback: 'airbnb',
    recommendedUses: ['consumer-feature', 'brand-story', 'lightweight-teaching', 'campaign-recap'],
    seriousnessRange: [2, 6],
    supportsCharts: true,
    supportsDenseReport: false,
    supportsSpeakerNarrative: true,
    darkDeckPreferred: false
  },
  'cinematic-dark': {
    runtimeTemplateFallback: 'executive',
    recommendedUses: ['media-showcase', 'launch-film', 'creative-pitch', 'immersive-demo'],
    seriousnessRange: [4, 8],
    supportsCharts: false,
    supportsDenseReport: false,
    supportsSpeakerNarrative: true,
    darkDeckPreferred: true
  }
};

const SITE_FAMILY_OVERRIDES = {
  airbnb: 'warm-editorial',
  apple: 'product-launch',
  bmw: 'luxury-brand',
  'bmw-m': 'luxury-brand',
  bugatti: 'luxury-brand',
  claude: 'warm-editorial',
  cursor: 'dark-tooling',
  elevenlabs: 'cinematic-dark',
  ferrari: 'luxury-brand',
  figma: 'playful-consumer',
  linear: 'dark-tooling',
  'linear.app': 'dark-tooling',
  meta: 'product-launch',
  miro: 'playful-consumer',
  nike: 'luxury-brand',
  notion: 'warm-editorial',
  pinterest: 'playful-consumer',
  posthog: 'dark-tooling',
  raycast: 'dark-tooling',
  resend: 'minimal-monochrome',
  runwayml: 'cinematic-dark',
  shopify: 'product-launch',
  spacex: 'minimal-monochrome',
  spotify: 'cinematic-dark',
  starbucks: 'warm-editorial',
  stripe: 'product-launch',
  supabase: 'dark-tooling',
  tesla: 'luxury-brand',
  uber: 'minimal-monochrome',
  vercel: 'minimal-monochrome',
  voltagent: 'dark-tooling',
  webflow: 'product-launch',
  wired: 'warm-editorial',
  'x.ai': 'minimal-monochrome'
};

const COLOR_PREFERENCES = {
  bg: ['canvas', 'background', 'surface-black', 'surface-dark', 'surface-1', 'surface-card', 'surface', 'canvas-parchment', 'body-background'],
  ink: ['ink', 'body', 'heading', 'body-on-dark', 'inverse-ink', 'on-dark'],
  muted: ['muted', 'body-muted', 'ink-muted', 'ink-subtle', 'muted-soft', 'ink-muted-48', 'ink-tertiary'],
  panel: ['panel', 'surface-card', 'surface-1', 'surface-soft', 'surface', 'surface-pearl', 'inverse-surface-1'],
  panelSoft: ['panel-soft', 'surface-soft', 'surface-2', 'surface-strong', 'surface-pearl', 'inverse-surface-2'],
  line: ['hairline', 'divider-soft', 'border-strong', 'hairline-soft', 'line'],
  accent: ['primary', 'primary-focus', 'link-blue', 'develop-blue', 'ship-red', 'preview-pink', 'luxe', 'plus'],
  accent2: ['primary-on-dark', 'primary-hover', 'primary-active', 'link-blue', 'preview-pink', 'magenta', 'develop-blue', 'ruby']
};

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function stripQuotes(value) {
  return value.replace(/^['"]|['"]$/g, '').trim();
}

function normalizeHex(value) {
  const match = value && value.match(/#([0-9a-f]{3,8})/i);
  if (!match) return null;
  const hex = match[0].toLowerCase();
  if (hex.length === 4) {
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }
  return hex.slice(0, 7);
}

function hexToRgb(hex) {
  const clean = normalizeHex(hex);
  if (!clean) return null;
  const value = parseInt(clean.slice(1), 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255
  };
}

function luminance(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return 1;
  const channels = [rgb.r, rgb.g, rgb.b].map(channel => {
    const srgb = channel / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function mixHex(hex, targetHex, amount) {
  const source = hexToRgb(hex);
  const target = hexToRgb(targetHex);
  if (!source || !target) return hex;
  const mix = channel => Math.round(source[channel] + (target[channel] - source[channel]) * amount);
  return `#${[mix('r'), mix('g'), mix('b')].map(value => value.toString(16).padStart(2, '0')).join('')}`;
}

function parseStructuredFrontmatter(text) {
  if (!text.startsWith('---\n')) return null;
  const end = text.indexOf('\n---', 4);
  if (end === -1) return null;
  const frontmatter = text.slice(4, end).split('\n');
  const data = { colors: {}, typography: {} };
  let section = null;

  for (const rawLine of frontmatter) {
    const line = rawLine.replace(/\t/g, '  ');
    const topMatch = line.match(/^([a-zA-Z0-9_.-]+):\s*(.*)$/);
    if (topMatch && !line.startsWith('  ')) {
      const [, key, value] = topMatch;
      section = value === '' ? key : null;
      if (value !== '') data[key] = stripQuotes(value);
      if (key === 'colors' || key === 'typography') {
        if (!data[key]) data[key] = {};
        section = key;
      }
      continue;
    }

    if (section === 'colors') {
      const nestedMatch = line.match(/^\s{2}([a-zA-Z0-9_.-]+):\s*(.+)$/);
      if (nestedMatch) {
        data.colors[nestedMatch[1]] = stripQuotes(nestedMatch[2]);
      }
      continue;
    }

    if (section === 'typography') {
      const nestedMatch = line.match(/^\s{2}([a-zA-Z0-9_.-]+):\s*(.+)$/);
      if (nestedMatch) {
        data.typography[nestedMatch[1]] = stripQuotes(nestedMatch[2]);
      }
    }
  }

  data.body = text.slice(end + 4).trim();
  return data;
}

function parseProse(text) {
  const heading = text.match(/^#\s+(.+)$/m);
  const paragraphs = text
    .split('\n\n')
    .map(chunk => chunk.trim())
    .filter(chunk => chunk && !chunk.startsWith('#') && !chunk.startsWith('##'));
  return {
    name: heading ? heading[1].replace(/^Design System Inspired by\s+/i, '').trim() : 'Unknown',
    description: paragraphs[0] || '',
    body: text
  };
}

function extractColorEntries(text) {
  const colors = {};
  const bulletRegex = /[-*]\s+\*\*([^*]+)\*\*\s+\(`?(#[0-9a-fA-F]{3,8})`?\)/g;
  let match = null;
  while ((match = bulletRegex.exec(text))) {
    colors[slugify(match[1])] = match[2];
  }
  return colors;
}

function pickColor(colors, preferences, fallback = null) {
  const entries = Object.entries(colors);
  const hasPreferenceToken = (key, preference) => {
    if (key === preference) return true;
    return key.startsWith(`${preference}-`) || key.endsWith(`-${preference}`) || key.includes(`-${preference}-`);
  };
  for (const preference of preferences) {
    const exact = colors[preference];
    if (exact) return normalizeHex(exact);
    const partial = entries.find(([key]) => hasPreferenceToken(key, preference));
    if (partial) return normalizeHex(partial[1]);
  }
  return normalizeHex(fallback);
}

function pickDarkNeutral(colors) {
  const entries = Object.entries(colors)
    .filter(([key, value]) => normalizeHex(value))
    .filter(([key]) => !/(primary|accent|hover|focus|active|pink|purple|magenta|ruby|red|blue|green|yellow|orange)/.test(key));
  entries.sort((a, b) => luminance(a[1]) - luminance(b[1]));
  return entries.length ? normalizeHex(entries[0][1]) : null;
}

function inferDensity(text) {
  const lower = text.toLowerCase();
  if (/(spacious|generous whitespace|gallery|airy|premium white space|minimal)/.test(lower)) return 'airy';
  if (/(dense|technical|report|analytical|structured|boardroom|evidence)/.test(lower)) return 'dense';
  return 'balanced';
}

function inferRadius(text) {
  const lower = text.toLowerCase();
  if (/(pill|rounded|softly rounded|friendly|human)/.test(lower)) return 'large';
  if (/(conservative border-radius|hard corner|precise|report-like)/.test(lower)) return 'small';
  return 'medium';
}

function inferShadow(text) {
  const lower = text.toLowerCase();
  if (/(no shadows|shadow-as-border|minimalism|hairline borders)/.test(lower)) return 'minimal';
  if (/(multi-layer shadow|ambient depth|cinematic|floating)/.test(lower)) return 'dramatic';
  return 'moderate';
}

function inferFamily(siteId, text, bgColor) {
  const siteKey = siteId.toLowerCase();
  if (SITE_FAMILY_OVERRIDES[siteKey]) return SITE_FAMILY_OVERRIDES[siteKey];

  const lower = text.toLowerCase();
  const darkCanvas = luminance(bgColor || '#ffffff') < 0.18;
  if (/(strategy|consulting|report|analysis|board|decision memo|analytical|market analysis)/.test(lower)) return 'consulting-report';
  if (/(media-rich|film|immersive|cinematic|audio-waveform)/.test(lower)) return 'cinematic-dark';
  if (/(luxury|automotive|supercar|museum|gallery|premium brand|fashion)/.test(lower)) return 'luxury-brand';
  if (/(developer|code|tool|terminal|product-focused|technical|infrastructure|workflow software)/.test(lower) && darkCanvas) return 'dark-tooling';
  if (/(developer|code|tool|terminal|product-focused|technical|infrastructure)/.test(lower)) return 'product-launch';
  if (/(consumer|marketplace|warm|friendly|rounded|community|travel|hospitality)/.test(lower)) return 'warm-editorial';
  if (/(editorial|magazine|serif|reading-optimized|news)/.test(lower)) return 'warm-editorial';
  if (/(playful|vibrant|multi-color|creator|illustrated|photography-driven)/.test(lower)) return 'playful-consumer';
  if (/(consumer|marketplace|warm|friendly|rounded|community)/.test(lower)) return 'warm-editorial';
  if (/(monochrome|black and white|restrained|philosophical|minimal)/.test(lower)) return 'minimal-monochrome';
  if (darkCanvas) return 'dark-tooling';
  return 'product-launch';
}

function buildTokens(colors, family) {
  const accent = pickColor(colors, COLOR_PREFERENCES.accent, '#3366ff') || '#3366ff';
  const accent2 = pickColor(colors, COLOR_PREFERENCES.accent2, mixHex(accent, '#ffffff', 0.32)) || mixHex(accent, '#ffffff', 0.32);
  const bg = pickColor(colors, COLOR_PREFERENCES.bg, FAMILY_CONFIG[family].darkDeckPreferred ? '#0f1115' : '#f6f7fb') || (FAMILY_CONFIG[family].darkDeckPreferred ? '#0f1115' : '#f6f7fb');
  const inkDefault = luminance(bg) < 0.25 ? '#f5f7fb' : '#17191f';
  const ink = pickColor(colors, COLOR_PREFERENCES.ink, null) || pickDarkNeutral(colors) || inkDefault;
  const muted = pickColor(colors, COLOR_PREFERENCES.muted, luminance(bg) < 0.25 ? '#9aa3b2' : '#5f6978') || (luminance(bg) < 0.25 ? '#9aa3b2' : '#5f6978');
  const panel = pickColor(colors, COLOR_PREFERENCES.panel, luminance(bg) < 0.25 ? mixHex(bg, '#ffffff', 0.08) : '#ffffff') || '#ffffff';
  const panelSoft = pickColor(colors, COLOR_PREFERENCES.panelSoft, luminance(bg) < 0.25 ? mixHex(bg, '#ffffff', 0.12) : mixHex(bg, '#111111', 0.04)) || mixHex(bg, '#111111', 0.04);
  const line = pickColor(colors, COLOR_PREFERENCES.line, luminance(bg) < 0.25 ? mixHex(bg, '#ffffff', 0.18) : '#d7dce4') || '#d7dce4';

  return {
    bg,
    ink,
    muted,
    panel,
    panelSoft,
    line,
    accent,
    accent2
  };
}

function buildTypographyHints(structured, text) {
  const lower = text.toLowerCase();
  const displayFamily = structured?.typography?.['hero-display'] || structured?.typography?.['display-xl'] || '';
  const codeFamily = lower.includes('mono') ? 'monospace' : '';
  const tracking = /(negative letter-spacing|compressed|tightens the text)/.test(lower) ? 'tight' : 'normal';
  let weight = 'balanced';
  if (/(weight 300|light weight|ethereal|whispered authority)/.test(lower)) weight = 'light';
  else if (/(700|800|bold|heavy|typographic muscle)/.test(lower)) weight = 'strong';

  return {
    displayFamily: displayFamily || null,
    codeFamily: codeFamily || null,
    weightBias: weight,
    trackingBias: tracking
  };
}

function buildStyleRecord(siteId, text) {
  const structured = parseStructuredFrontmatter(text);
  const parsed = structured || parseProse(text);
  const colors = structured
    ? Object.fromEntries(Object.entries(structured.colors || {}).map(([key, value]) => [slugify(key), value]))
    : extractColorEntries(text);
  const bodyText = `${parsed.description || ''}\n${parsed.body || ''}`;
  const bgCandidate = pickColor(colors, COLOR_PREFERENCES.bg, '#ffffff') || '#ffffff';
  const family = inferFamily(siteId, bodyText, bgCandidate);
  const familyConfig = FAMILY_CONFIG[family];
  const tokens = buildTokens(colors, family);

  return {
    id: siteId,
    displayName: parsed.name || siteId,
    sourceType: structured ? 'structured' : 'prose',
    sourceFile: `vendor/awesome-design-md/design-md/${siteId}/DESIGN.md`,
    layoutFamily: family,
    runtimeTemplateFallback: familyConfig.runtimeTemplateFallback,
    summary: (parsed.description || '').replace(/\s+/g, ' ').trim(),
    tokens,
    traits: {
      density: inferDensity(bodyText),
      radius: inferRadius(bodyText),
      shadow: inferShadow(bodyText),
      darkCanvas: luminance(tokens.bg) < 0.25,
      typography: buildTypographyHints(structured, bodyText)
    },
    suitability: {
      recommendedUses: familyConfig.recommendedUses,
      seriousnessRange: familyConfig.seriousnessRange,
      supportsCharts: familyConfig.supportsCharts,
      supportsDenseReport: familyConfig.supportsDenseReport,
      supportsSpeakerNarrative: familyConfig.supportsSpeakerNarrative,
      darkDeckPreferred: familyConfig.darkDeckPreferred
    }
  };
}

async function main() {
  const entries = await fs.readdir(vendorRoot, { withFileTypes: true });
  const siteDirs = entries.filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
  const styles = [];

  for (const siteId of siteDirs) {
    const designPath = path.join(vendorRoot, siteId, 'DESIGN.md');
    try {
      const text = await fs.readFile(designPath, 'utf8');
      styles.push(buildStyleRecord(siteId, text));
    } catch (error) {
      styles.push({
        id: siteId,
        displayName: siteId,
        sourceType: 'unreadable',
        sourceFile: `vendor/awesome-design-md/design-md/${siteId}/DESIGN.md`,
        layoutFamily: 'product-launch',
        runtimeTemplateFallback: 'apple',
        summary: `Failed to parse DESIGN.md: ${error.message}`,
        tokens: {
          bg: '#f6f7fb',
          ink: '#17191f',
          muted: '#5f6978',
          panel: '#ffffff',
          panelSoft: '#eef1f5',
          line: '#d7dce4',
          accent: '#3366ff',
          accent2: '#7aa2ff'
        },
        traits: {
          density: 'balanced',
          radius: 'medium',
          shadow: 'moderate',
          darkCanvas: false,
          typography: {
            displayFamily: null,
            codeFamily: null,
            weightBias: 'balanced',
            trackingBias: 'normal'
          }
        },
        suitability: {
          recommendedUses: FAMILY_CONFIG['product-launch'].recommendedUses,
          seriousnessRange: FAMILY_CONFIG['product-launch'].seriousnessRange,
          supportsCharts: true,
          supportsDenseReport: false,
          supportsSpeakerNarrative: true,
          darkDeckPreferred: false
        }
      });
    }
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    source: 'vendor/awesome-design-md/design-md',
    count: styles.length,
    families: Object.entries(FAMILY_CONFIG).map(([id, config]) => ({
      id,
      runtimeTemplateFallback: config.runtimeTemplateFallback,
      recommendedUses: config.recommendedUses,
      seriousnessRange: config.seriousnessRange
    })),
    styles
  };

  await fs.mkdir(outputRoot, { recursive: true });
  await fs.writeFile(outputFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`Built ${styles.length} styles -> ${path.relative(process.cwd(), outputFile)}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
