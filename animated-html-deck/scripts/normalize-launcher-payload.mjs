#!/usr/bin/env node
import fs from 'node:fs/promises';

function usage() {
  return [
    'Usage: node scripts/normalize-launcher-payload.mjs [payload.json]',
    '',
    'Reads launcher payload JSON from a file or stdin and fills missing fields',
    'with inferred/defaulted values for animated-html-deck startup flows.'
  ].join('\n');
}

function detectLanguage(text) {
  if (!text) return null;
  if (/[\u4e00-\u9fff]/.test(text)) return 'zh-CN';
  if (/[a-z]/i.test(text)) return 'en';
  return null;
}

function parseSlideCount(text) {
  if (!text) return null;
  const patterns = [
    /(\d+)\s*(?:页|page|pages|slides?)/i,
    /大约\s*(\d+)\s*页/,
    /about\s*(\d+)\s*(?:slides?|pages?)/i
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return Number(match[1]);
  }
  return null;
}

function parseSeriousness(text) {
  if (!text) return null;
  const patterns = [
    /(?:严肃度|严肃|seriousness|tone|氛围)\s*(?:是|为|:|：)?\s*(\d{1,2})\s*\/\s*10/i,
    /(\d{1,2})\s*\/\s*10\s*(?:严肃|serious|seriousness|tone|氛围)/i,
    /(?:严肃度|严肃|seriousness|tone|氛围)\s*(?:是|为|:|：)?\s*(\d{1,2})/i
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const value = Number(match[1]);
    if (Number.isFinite(value)) return Math.max(1, Math.min(10, value));
  }
  return null;
}

function containsAny(text, terms) {
  const lower = (text || '').toLowerCase();
  return terms.some(term => lower.includes(term.toLowerCase()));
}

function textHasAny(text, patterns) {
  return patterns.some(pattern => pattern.test(text || ''));
}

function coerceBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (['true', 'yes', '1', '是'].includes(value.toLowerCase())) return true;
    if (['false', 'no', '0', '否'].includes(value.toLowerCase())) return false;
  }
  return null;
}

function normalizeField(raw, fallbackValue = null) {
  if (raw && typeof raw === 'object' && 'value' in raw) {
    return {
      value: raw.value,
      source: raw.source || 'user_provided'
    };
  }
  if (raw !== undefined && raw !== null && raw !== '') {
    return {
      value: raw,
      source: 'user_provided'
    };
  }
  return {
    value: fallbackValue,
    source: fallbackValue === null ? null : 'defaulted'
  };
}

function briefText(payload) {
  return [
    payload.raw_input,
    payload.context_title,
    payload.context_summary
  ].filter(Boolean).join('\n');
}

function inferPurpose(text) {
  if (!text || !text.trim()) return null;
  if (containsAny(text, ['路演', '融资', 'pitch', 'fundraising', 'roadshow'])) return 'pitch';
  if (containsAny(text, ['教学', '课程', 'lesson', 'teach', 'training'])) return 'teaching';
  if (containsAny(text, ['报告', '汇报', '分析', 'report', 'analysis', 'board'])) return 'report';
  if (containsAny(text, ['演讲', '口播', '发布会', 'speech', 'talk', 'keynote'])) return 'speech';
  if (containsAny(text, ['workshop', '训练营', '工作坊'])) return 'workshop';
  if (containsAny(text, ['介绍', '说明', 'explainer', 'overview', '介绍一下'])) return 'explanation';
  return 'explanation';
}

function hasDeckRequest(text) {
  return containsAny(text, [
    'ppt',
    'deck',
    'slides',
    'slide deck',
    'presentation',
    '演示稿',
    '幻灯片',
    '汇报'
  ]);
}

function hasGenericMakeIntent(text) {
  return containsAny(text, [
    '帮我做',
    '做个',
    '做一个',
    '来个',
    '生成',
    'create',
    'make',
    'build'
  ]);
}

function hasConcreteTopicSignal(text) {
  if (!text || !text.trim()) return false;
  if (textHasAny(text, [
    /主题\s*(?:是|为|:|：)/,
    /about\s+[\w\u4e00-\u9fff]/i,
    /关于[\w\u4e00-\u9fff]/,
    /内容\s*(?:是|为|:|：)/,
    /topic\s*(?:is|:)/i
  ])) return true;

  const cleaned = text
    .replace(/\$?animated-html-deck/gi, '')
    .replace(/use\s+/gi, '')
    .replace(/帮我|请|麻烦|做一个|做个|来个|生成|create|make|build/gi, '')
    .replace(/ppt|deck|slides?|presentation|演示稿|幻灯片/gi, '')
    .replace(/[，。,.!！?？:：]/g, ' ')
    .trim();

  return cleaned.length >= 12 && !/^(great|nice|good|漂亮|好看|高级|专业)$/i.test(cleaned);
}

function isLowInformationDeckRequest(text, payload) {
  if (!text || !text.trim()) return false;
  const hasStructuredTopic = payload.topic && typeof payload.topic === 'object'
    ? Boolean(payload.topic.value)
    : Boolean(payload.topic);
  if (hasStructuredTopic) return false;
  if (!hasDeckRequest(text) || !hasGenericMakeIntent(text)) return false;
  return !hasConcreteTopicSignal(text);
}

function inferSeriousness(text, purpose) {
  if (!text || !text.trim()) return null;
  const parsed = parseSeriousness(text);
  if (parsed) return parsed;
  if (containsAny(text, ['董事会', '投委会', 'board', 'investor', 'serious', '严肃'])) return 8;
  if (purpose === 'report' || purpose === 'pitch') return 7;
  if (purpose === 'teaching') return 5;
  if (containsAny(text, ['活泼', '轻松', 'relaxed', 'playful'])) return 4;
  return 6;
}

function inferStyle(text, purpose) {
  if (!text || !text.trim()) return null;
  if (containsAny(text, ['vercel', 'linear', 'stripe', 'figma', 'apple', 'airbnb'])) {
    const known = ['vercel', 'linear.app', 'stripe', 'figma', 'apple', 'airbnb'];
    for (const style of known) {
      const probe = style === 'linear.app' ? 'linear' : style;
      if (containsAny(text, [probe])) return style;
    }
  }
  if (containsAny(text, ['高端企业', 'executive', 'boardroom', 'enterprise'])) return 'executive corporate';
  if (containsAny(text, ['开发者工具', 'tooling', 'developer tool', 'modern tool'])) return 'vercel-inspired';
  if (containsAny(text, ['亲和', '温暖', 'friendly', 'warm'])) return 'airbnb-inspired';
  if (purpose === 'report') return 'consulting-report';
  return 'modern, clear, presentation-ready';
}

function inferSpeaking(text, purpose) {
  if (!text || !text.trim()) return null;
  if (containsAny(text, [
    '演讲',
    '口播',
    '讲稿',
    '演讲稿',
    'speaker notes',
    'presenter',
    'notes',
    '录屏',
    'keynote',
    'speech',
    '上台讲',
    '汇报',
    '发布会',
    '路演'
  ])) return true;
  if (purpose === 'speech' || purpose === 'pitch') return true;
  return false;
}

function inferBranded(text) {
  if (!text || !text.trim()) return null;
  if (containsAny(text, ['logo', '品牌', '公司', '企业', 'brand', 'corporate'])) return true;
  return false;
}

function inferTopic(text) {
  const trimmed = (text || '').trim();
  if (!trimmed) return null;
  return trimmed.length > 160 ? `${trimmed.slice(0, 157)}...` : trimmed;
}

function inferSlideCount(text, purpose, isSpeakingDeck) {
  if (!text || !text.trim()) return null;
  const parsed = parseSlideCount(text);
  if (parsed) return parsed;
  if (purpose === 'teaching') return 10;
  if (purpose === 'pitch') return 8;
  if (purpose === 'report') return 8;
  if (isSpeakingDeck) return 8;
  return 8;
}

function inferSpeakerScriptGuidance(text, purpose, isSpeakingDeck) {
  const explicitScript = containsAny(text, ['讲稿', '演讲稿', '口播稿', 'speaker notes', 'notes', 'delivery cues']);
  const needsGuidance = Boolean(isSpeakingDeck) || explicitScript;
  const style = purpose === 'pitch'
    ? 'roadshow-persuasion'
    : purpose === 'speech'
      ? 'product-launch-or-keynote'
      : purpose === 'teaching'
        ? 'training-explanation'
        : purpose === 'report'
          ? 'formal-briefing'
          : 'balanced-presentation';

  return {
    needs_guidance: needsGuidance,
    requires_followup: needsGuidance && !explicitScript,
    default_per_slide_seconds: 75,
    notes_detail: needsGuidance ? 'speaker-notes-with-transitions-memory-point-and-delivery-cues' : 'concise-speaker-notes',
    style
  };
}

function withSource(existing, inferredValue, defaultValue = null) {
  if (existing.source && existing.value !== null && existing.value !== undefined && existing.value !== '') {
    return existing;
  }
  if (inferredValue !== null && inferredValue !== undefined && inferredValue !== '') {
    return { value: inferredValue, source: 'inferred' };
  }
  return { value: defaultValue, source: 'defaulted' };
}

async function readInput(fileArg) {
  if (fileArg) {
    return fs.readFile(fileArg, 'utf8');
  }
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return chunks.join('');
}

async function main() {
  const arg = process.argv[2];
  if (arg === '--help' || arg === '-h') {
    console.log(usage());
    process.exit(0);
  }

  const raw = await readInput(arg);
  const payload = JSON.parse(raw || '{}');
  const text = briefText(payload);
  const lowInformationDeckRequest = isLowInformationDeckRequest(text, payload);

  const topic = normalizeField(payload.topic);
  const language = normalizeField(payload.language);
  const slideCount = normalizeField(payload.slide_count);
  const purpose = normalizeField(payload.purpose);
  const seriousness = normalizeField(payload.seriousness);
  const visualStyle = normalizeField(payload.visual_style);
  const speakingDeck = normalizeField(payload.is_speaking_deck);
  const branded = normalizeField(payload.is_branded);

  const resolvedPurpose = withSource(purpose, inferPurpose(text), 'explanation');
  const resolvedSpeaking = withSource(
    speakingDeck,
    coerceBoolean(speakingDeck.value) ?? inferSpeaking(text, resolvedPurpose.value),
    false
  );

  const normalized = {
    topic: withSource(topic, inferTopic(text), '待确认主题'),
    language: withSource(language, detectLanguage(text), 'zh-CN'),
    slide_count: withSource(slideCount, inferSlideCount(text, resolvedPurpose.value, resolvedSpeaking.value), 8),
    purpose: resolvedPurpose.source ? resolvedPurpose : { value: 'explanation', source: 'defaulted' },
    seriousness: withSource(seriousness, inferSeriousness(text, resolvedPurpose.value), 6),
    visual_style: withSource(visualStyle, inferStyle(text, resolvedPurpose.value), 'modern, clear, presentation-ready'),
    is_speaking_deck: resolvedSpeaking,
    is_branded: withSource(branded, coerceBoolean(branded.value) ?? inferBranded(text), false)
  };
  const speakerScriptGuidance = inferSpeakerScriptGuidance(
    text,
    normalized.purpose.value,
    normalized.is_speaking_deck.value
  );

  const highRiskWarnings = [];
  const clarificationQuestions = [];
  if (!text.trim()) {
    highRiskWarnings.push('No topic or contextual text was provided; topic is only a placeholder.');
  }
  if (lowInformationDeckRequest) {
    highRiskWarnings.push('Open deck request is too vague; ask for topic, purpose, audience, slide count or duration, style, and speaker script needs before planning.');
    clarificationQuestions.push(
      '主题是什么，是否有已有材料或源文件？',
      '用途是汇报、路演、培训、发布会、教学，还是说明？',
      '听众是谁？',
      '需要几页，或演讲几分钟？',
      '风格偏正式、科技感、咨询报告、产品发布，还是轻松讲解？',
      '需要我同时写每页演讲稿 / speaker notes 吗？'
    );
  }
  if (normalized.is_branded.value === true && !containsAny(text, ['logo', '品牌', '公司', '企业', 'brand', 'corporate'])) {
    highRiskWarnings.push('Branding was inferred but no company or logo detail is present.');
  }
  if (!parseSlideCount(text) && containsAny(text, ['严格', 'exact', 'precisely', '必须']) && !slideCount.value) {
    highRiskWarnings.push('Slide count may be sensitive, but no exact count was provided.');
  }
  if (speakerScriptGuidance.requires_followup) {
    highRiskWarnings.push('Speaking context was detected; confirm speaker script style, talk duration, notes detail, and delivery cues before final generation if not already obvious.');
  }

  const summary = {
    raw_input: payload.raw_input || '',
    context_title: payload.context_title || '',
    context_summary: payload.context_summary || '',
    normalized,
    needs_clarification: lowInformationDeckRequest,
    clarification_questions: clarificationQuestions,
    speaker_script_guidance: speakerScriptGuidance,
    high_risk_warnings: highRiskWarnings
  };

  console.log(JSON.stringify(summary, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
