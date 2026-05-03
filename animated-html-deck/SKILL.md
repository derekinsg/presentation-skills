---
name: animated-html-deck
description: Generate polished, single-file HTML presentations from a user brief. Use when Codex needs to create an offline-ready HTML slide deck or PPT-like presentation with optional native CSS/JS motion presets, embedded local images, exact slide-count control, keyboard navigation, speaker notes, print/export styling, and purpose-aware visual direction based on content, page count, seriousness level, style, and whether the deck is for a speech, pitch, teaching, report, or explanation.
---

# Animated HTML Deck

## Overview

Create self-contained HTML presentation decks that feel like refined PPTs but run directly in a browser. The default deliverable is one clean, offline-ready `.html` file with embedded CSS and JavaScript, embedded local images, keyboard controls, progress UI, speaker notes, fullscreen support, print-friendly styles, lightweight editing, built-in template styles, and optional same-Wi-Fi phone presenter sync that opens through a local IP URL when requested. Default decks are static: use the bundled motion presets only when the user explicitly requests animation or a launch-style demo. Website-inspired styles should be resolved through the sibling `style-polish` skill, then injected into the template as one resolved theme payload.

If the host UI launches this skill through a structured wizard, prefer the launcher's payload over re-asking basic setup questions. Launcher fields are allowed to be empty; missing values should be inferred or defaulted through `scripts/normalize-launcher-payload.mjs`. The launcher is intentionally low-friction and inference-friendly for real briefs; see `references/launcher-design-rationale.md` for the design principles behind that intake model. Low-information requests are different: when the user only asks for "a PPT" without a real subject or use case, run the open brief intake before planning.

## Open Brief Intake Protocol

When the user asks for a deck with a low-information prompt such as "帮我做个 PPT", "做个汇报", "来个演示稿", "make a great deck", or "create a presentation" without a concrete topic/source, do not browse, plan, outline, or generate yet. First ask for a compact PPT brief.

Ask these six items together:

1. Topic or source material: what is the deck about, and is there a PPT/PDF/document/image to use?
2. Purpose: report, pitch, training, product launch, teaching, speech, explanation, or workshop.
3. Audience: who will watch it and what do they already know?
4. Length: exact slide count, or talk duration if slide count is unknown.
5. Style and seriousness: formal, technical, consulting report, product launch, warm teaching, relaxed explanation, or another style; ask for 1-10 seriousness if useful.
6. Speaker script: whether to write per-slide speaker notes / 演讲稿 / 口播稿, and whether delivery cues are needed.

Use this Chinese intake phrasing by default for Chinese low-information requests:

```text
可以，我先把 PPT brief 定清楚。请给我这 6 个信息：
1. 主题是什么，是否有已有材料或源文件？
2. 用途是汇报、路演、培训、发布会，还是教学？
3. 听众是谁？
4. 需要几页，或演讲几分钟？
5. 风格偏正式、科技感、咨询报告、产品发布，还是轻松讲解？
6. 需要我同时写每页演讲稿 / speaker notes 吗？
```

If only some answers are provided, continue with a visible "confirmed / defaulted" brief before planning. Do not silently turn a vague request into an unrelated topic. If the user explicitly says "just decide for me" after the intake, default to 8 slides, balanced seriousness 6/10, modern clear style, concise speaker notes, and label the assumptions.

When speaking context is detected (演讲, 口播, 讲稿, 上台讲, 发布会, 路演, speaker notes, keynote, presenter notes), surface speaker script guidance before generation unless already specified. Default speaker notes should include per-slide narration, transition cue, delivery cue, and one memory point, at roughly 60-90 seconds per content slide.

## Required Inputs

Infer missing details when safe, but ask a concise follow-up if any of these are absent and cannot be reasonably derived:

- Content or topic.
- Exact slide count.
- Seriousness level, preferably 1-10 or a clear verbal equivalent.
- Visual style.
- Optional source style id such as `vercel`, `linear.app`, `stripe`, `figma`, `apple`, or `airbnb`.
- Purpose: speech, pitch, teaching, explanation, report, workshop, or mixed.

If the host UI already supplied a launcher payload with `{ value, source }` fields, consume that payload first and do not repeat questions whose values were already provided or reasonably inferred.

If the user gives limited content, expand it responsibly: create a clear thesis, add logical supporting points, label assumptions, and avoid inventing fake metrics, customers, dates, citations, or claims.

For company-grade decks, also capture or infer:

- Company or product name.
- Logo source if available. If the user provides a local logo path, embed it inline as base64 or inline SVG. If not, use a text logo or initials.
- Local image paths for screenshots, product photos, diagrams, or illustrations. Convert them to `data:` URIs before inserting them into the HTML.
- Preferred built-in template: Apple, Airbnb, Executive Corporate, or Consulting Report.
- Preferred source style when the user wants a specific website-inspired look. Resolve it through `style-polish` first.

## Source Deck Replication

When the user asks to复刻, recreate, convert, or rebuild an existing PPT/PDF into an HTML deck, treat root-level source files as first-class input.

- Scan only the project root for `.pdf`, `.ppt`, or `.pptx` files. Do not search subdirectories for source decks by default.
- If exactly one root source file exists, use it automatically.
- If multiple root source files exist, ask the user to choose the intended file.
- If the user supplies an explicit source path, use that file instead of auto-detection.
- Run `node animated-html-deck/scripts/extract-source-pages.mjs [source.pdf|source.pptx|source.ppt]` before planning the HTML deck.
- Consume the generated `manifest.json`; treat `pageCount` as the locked slide count and create exactly one HTML `.slide` per source page.
- Default to editable replication: use rendered page PNGs as visual references for layout, typography, color, hierarchy, charts, and imagery, then rebuild the slide with semantic HTML/CSS.
- Only use a full-page rendered image as the actual slide body when the page is mostly photographic/bitmap content or when editable reconstruction would materially reduce fidelity. If used, embed it as a `data:` URI and keep notes/controls intact.
- PPT/PPTX support depends on LibreOffice/`soffice` conversion. If conversion is unavailable, ask the user to export the deck as PDF or install LibreOffice.

## Workflow

1. Read `references/deck-generation-rubric.md` before designing the deck whenever purpose, seriousness, style, or audience affects the output.
2. If the user wants a real website-inspired style, use the sibling `style-polish` skill first. Read `../style-polish/SKILL.md` and use its resolved output instead of redoing style selection here.
3. If the user wants source deck replication, run `scripts/extract-source-pages.mjs` first, inspect the manifest and page references, and lock the slide count to the source `pageCount`.
4. Start from `assets/single-file-deck-template.html` unless the user explicitly requests a different framework.
5. Plan the deck before writing HTML:
   - If a host launcher payload is present, normalize it first with `scripts/normalize-launcher-payload.mjs`.
   - If normalization returns `needs_clarification: true`, ask the brief intake questions and wait for the user's answers before planning.
   - If normalization returns `speaker_script_guidance.requires_followup: true`, confirm or state speaker-note defaults before generation.
   - Lock the exact slide count and create a slide-by-slide outline with one job per slide.
   - For source deck replication, make each slide job correspond to the same-numbered source page and preserve page order exactly.
   - Pick a structure that matches the purpose.
   - Decide tone, density, color restraint, and motion intensity from seriousness level.
   - If a specific source style is requested, get one resolved theme package from `style-polish` before writing slide HTML.
6. Replace the template content with a complete deck:
   - Match the requested slide count exactly. Do not add appendix, cover, agenda, or closing slides beyond the requested count unless the user asks.
   - Keep every dependency local and inline. Do not use external CDNs, remote fonts, remote image URLs, analytics, package installs, or runtime network access by default.
   - Use semantic slide sections and reusable layout classes.
   - For source deck replication, rebuild editable HTML/CSS content wherever practical and use each rendered page image as a reference, not as the default output.
   - If you use a source style, inject one resolved theme payload into the template and ship only that chosen style in the HTML. Do not ship the full style library inside the deck.
   - Keep `data-motion-mode="static"` on the body by default. Do not add `data-motion` or `.fragment` by default. Use motion presets only when the user explicitly asks for animation, advanced motion, product-launch feel, or a similar animated deck.
   - Use `media-frame`, `media-bleed`, `media-split`, `logo-lockup`, and `image-caption` components for visual material.
   - Include `<aside class="notes">` on every slide. Put narration, transitions, and delivery cues there instead of overloading visible slide text.
   - Keep the built-in template switcher, lightweight editing controls, recording presenter mode, and phone presenter hooks unless the user explicitly asks for a minimal deck.
7. Verify the HTML before delivery:
   - Confirm slide count by counting `.slide` sections.
   - For source deck replication, confirm the `.slide` count equals the source manifest `pageCount`.
   - Confirm arrow keys, space, Home/End, fullscreen button, progress, notes toggle, and print styles are present.
   - Confirm no external URLs or linked assets exist. Logos and images must be inline `data:` URIs or generated with HTML/CSS, not remote.
   - Confirm text fits at common desktop and mobile widths and the first viewport shows the actual deck.
8. If the user wants phone speaker notes, projection, or same-Wi-Fi sync, default to a LAN publish flow after generating the deck. Start `scripts/presenter-server.mjs` and give the user the opened computer PPT URL plus the phone presenter URL/QR status instead of telling them to open the raw file.

## Purpose Structures

- Speech: title/thesis, stakes, core argument, supporting proof, emotional turn, memorable close.
- Pitch: problem, urgency, solution, product flow, proof, market or buyer, business model, ask or next step.
- Explanation: concept, context, breakdown, process, example, implication, recap.
- Teaching: hook, learning goals, concept chunks, analogy, worked example, check for understanding, recap.
- Report: executive answer, context, evidence, analysis, risks, recommendation, decision or next steps.

Adapt these patterns to the requested slide count. If there are fewer slides than a pattern needs, combine adjacent jobs. If there are more, split dense jobs into focused sections.

## Output Contract

- Deliver a single `.html` file unless the user asks for supporting files.
- Embed all CSS and JavaScript in the file.
- Embed local images as `data:` URIs with clear `alt` text.
- Use system fonts or inline-safe font stacks.
- Use native CSS and JavaScript for navigation. Use native motion presets only when explicitly requested.
- Include print support with one slide per page.
- Include speaker notes on every slide; notes are hidden by default.
- Include Mode, Template, Edit, A+/A-, Reset, Color, Phone, Notes, Full, previous, and next controls by default.
- Include editable slide text, theme accent color editing, drag-to-move selected text, and reset for local presentation polishing.
- Include optional phone presenter support when using the bundled template. The deck must still open as a standalone file; cross-device sync only works after running the local presenter server, which is the default publish path for phone-ready sessions and should open a LAN IP deck URL.
- Avoid visible instructions about how to use the deck. The presentation content should be the first-screen experience.

## Built-In Templates

- Apple: low-density product launch feel, large quiet typography, generous whitespace, minimal borders, blue accent. Prefer for product capability, tool introduction, and executive-friendly demos.
- Airbnb: warm, rounded, friendly, more card-like, coral accent. Prefer for approachable explainers, onboarding, community, and teaching content.
- Executive Corporate: restrained, compact, sober, formal, blue/teal accent. Prefer for leadership updates, boardroom pitches, company roadshows, and serious reports.
- Consulting Report: structured, analytical, higher density, report-like grids, muted accent. Prefer for strategy, market, operations, and recommendation decks.

Template switching must change layout feel, density, radius, shadow, and emphasis style, not only colors. When a specific website style is requested, resolve it through `style-polish` first, then map it to one layout family plus one runtime template fallback.

## Motion System

- Default decks are static. When the user explicitly requests animation, set `data-motion-mode="animated"` on the body and use `data-motion` presets to create premium, product-launch-style motion:
  - `hero-reveal`: large title or closing statement with masked depth reveal.
  - `mask-wipe`: kicker, section labels, and precise text reveals.
  - `media-parallax`: screenshots, product images, and diagrams with subtle scale/depth.
  - `card-stack`: cards, comparisons, and callouts with layered rise.
  - `metric-count`: metric cards with count-up numbers using `.metric-number[data-count-to]`.
  - `chart-draw`: charts whose bars or lines draw after the element appears.
  - `process-trace`: process layouts with a traced connector line.
  - `stagger-rise`: supporting copy and small groups.
- Motion should sequence attention and feel high-end, not busy. For serious decks, use fewer animated fragments and slower, subtler presets.
- Keep `prefers-reduced-motion` support intact.

## Image Rules

- For local images, run `node scripts/image-to-data-uri.mjs /path/to/image.png` and paste the output into `<img src="...">`.
- For remote image URLs, do not link them directly by default. Download and embed only when browsing/downloading is appropriate for the user request; otherwise ask for a local file.
- Never invent real product screenshots, customer logos, or brand assets. If no image is provided, use HTML/CSS diagrams, charts, or clearly illustrative placeholders.
- Use `alt` text on every meaningful image. Use empty `alt=""` only for purely decorative generated placeholders.
- Put logos or company names in normal slide content such as `logo-lockup`; put content images inside slide body media components.

## Design Guidance

- Treat "seriousness" as a design control, not a mood label:
  - 1-3 relaxed: expressive layouts, warmer copy, lively but readable motion.
  - 4-6 balanced: crisp hierarchy, moderate contrast, selective animation.
  - 7-8 formal: restrained colors, compact information, slower transitions.
  - 9-10 boardroom: sober palette, subtle motion, dense evidence, no decorative gimmicks.
- For static decks, rely on layout and information design. When animation is requested, use it to sequence attention, not to decorate every element; favor layered masking, subtle depth, stagger, and chart drawing over generic fade-ins.
- Prefer strong layout systems: title, agenda/thesis, section divider, metric, comparison, process, evidence, quote, recommendation, conclusion.
- Keep slide copy concise. Move narration into speaker notes.
- Create charts, diagrams, and visual metaphors with HTML/CSS when they improve comprehension.
- For branded decks, use ordinary content components for logos, company names, source labels, or dates. Do not add fixed page headers or footers.
- When a website-inspired style is requested, keep the source site's color logic, typography bias, and surface treatment, but translate it into slide-friendly information design. Do not mechanically recreate the source homepage layout or browser chrome.

## Chinese Example Prompts

```text
使用 $animated-html-deck 生成一个 8 页中文商业路演 HTML PPT，主题是 AI 客服产品融资介绍，氛围 9/10 严肃，风格是高端企业感，目的用于 10 分钟演讲。
```

```text
使用 $animated-html-deck 做一个 6 页产品说明型 HTML 演示，内容是面向销售团队介绍新版 CRM 工作流，氛围 6/10，风格现代、清晰、偏工具感，目的用于说明和培训。
```

```text
使用 $animated-html-deck 制作一个 10 页教学型 HTML PPT，主题是给高中生讲解机器学习基本概念，氛围 3/10，风格活泼但不要幼稚。
```

## Resource Use

- `assets/single-file-deck-template.html`: copy this as the starting point for every default deck, then replace sample slides and theme variables.
- `references/launcher-wizard-spec.md`: use this when the host UI wants a multi-step launcher for `/animated-html-deck`.
- `references/launcher-design-rationale.md`: explains why the launcher is skippable, inference-friendly, and preview-driven, and how to keep future launcher extensions aligned with that model.
- `references/launcher-payload.schema.json`: the structured launcher contract for host UI payloads.
- `scripts/image-to-data-uri.mjs`: convert a local image into an inline `data:` URI for single-file decks.
- `scripts/extract-source-pages.mjs`: detect a root `.pdf`, `.ppt`, or `.pptx`, render every page to PNG references, and write a `manifest.json` for editable source deck replication.
- `scripts/normalize-launcher-payload.mjs`: normalize a partial launcher payload into inferred/defaulted deck inputs with source markers and high-risk warnings.
- `scripts/presenter-server.mjs`: use when the user wants phone-based speaker notes, projection, or same-Wi-Fi presenter sync. Run `node scripts/presenter-server.mjs deck.html --port 4173 --deck-host lan` so the computer opens the LAN IP deck URL by default; then scan the `Phone Presenter` QR code from the phone. The phone URL must use the computer's LAN IP, never `localhost` or `127.0.0.1`. If the user explicitly wants an offline-only file, skip the server.
- `references/deck-generation-rubric.md`: read when mapping user intent to slide structure, tone, animation intensity, content expansion, and final QA checks.
- `../style-polish/SKILL.md`: use when the user wants a website-inspired look or when you need a resolved theme package.
- `../style-polish/styles/style-catalog.json`: read only when you need to inspect the normalized style data directly.
- `../style-polish/scripts/resolve-style-theme.mjs`: use when you want a deterministic resolved style package for deck generation.
## Publish Rules

- Default deliverable: return the generated `.html` file path for offline use.
- Default phone-sync deliverable: if the user asks for phone notes, presenter sync, QR scanning, same-Wi-Fi linking, or projection with mobile notes, do not make the raw `file://` deck the main entrypoint.
- For those phone-sync requests, Codex should automatically start:
  `node scripts/presenter-server.mjs deck.html --port 4173 --deck-host lan`
- In the final response for phone-sync sessions, lead with:
  - the computer deck LAN URL
  - the phone presenter URL or QR status
  - a brief note that the raw HTML remains as an offline backup only

## Launcher Payload Behavior

- Treat all launcher fields as optional.
- Prefer `user_provided` values over `inferred`, and `inferred` over `defaulted`.
- Do not re-ask about fields already marked `user_provided`.
- Usually avoid re-asking fields marked `inferred` or `defaulted`, unless `normalize-launcher-payload.mjs` surfaced a high-risk warning that materially affects deck quality.
