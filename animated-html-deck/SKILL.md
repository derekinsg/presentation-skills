---
name: animated-html-deck
description: Generate polished, single-file HTML presentations from a user brief. Use when Codex needs to create an offline-ready HTML slide deck or PPT-like presentation with optional native CSS/JS motion presets, embedded local images, exact slide-count control, keyboard navigation, speaker notes, print/export styling, and purpose-aware visual direction based on content, page count, seriousness level, style, and whether the deck is for a speech, pitch, teaching, report, or explanation.
---

# Animated HTML Deck

## Overview

Create self-contained HTML presentation decks that feel like refined PPTs but run directly in a browser. The default deliverable is one clean, offline-ready `.html` file with embedded CSS and JavaScript, embedded local images, keyboard controls, progress UI, speaker notes, fullscreen support, print-friendly styles, lightweight editing, built-in template styles, and optional same-Wi-Fi phone presenter sync that opens through a local IP URL when requested. Default decks are static: use the bundled motion presets only when the user explicitly requests animation or a launch-style demo. Website-inspired styles should be resolved through the sibling `style-polish` skill, then injected into the template as one resolved theme payload.

If the host UI launches this skill through a structured wizard, prefer the launcher's payload over re-asking basic setup questions. Launcher fields are allowed to be empty; missing values should be inferred or defaulted through `scripts/normalize-launcher-payload.mjs`. The launcher is intentionally low-friction and inference-friendly for real briefs; see `references/launcher-design-rationale.md` for the design principles behind that intake model. Low-information requests are different: when the user only asks for "a PPT" without a real subject or use case, run the open brief intake before planning.

## Open Brief Intake Protocol

When the user asks for a deck with a low-information prompt such as "帮我做个 PPT", "做个汇报", "来个演示稿", "make a great deck", or "create a presentation" without a concrete topic/source, do not browse, plan, outline, or generate yet. First call `request_user_input` once with a single modal brief intake. This is a required tool contract, not prose to summarize.

Tool contract:
- `tool_name`: `request_user_input`
- `call_required`: `true`
- `plain_text_questions_allowed`: `false`
- `max_questions`: `10`
- `default_question_count`: `8`

If `request_user_input` is not available in the current runtime, do not write the 8 questions as text. Reply only: `当前环境没有 brief 弹窗工具，我需要可点击弹窗来收集 PPT brief；请在支持 request_user_input 的模式下重试，或直接粘贴完整 brief。`

The first modal must ask up to 10 questions at once. Use these 8 questions by default, with 2-3 common options each and the modal's built-in `Other` field for free-form answers:

1. Topic/source: ask for the topic or source material. Options: "我会输入主题", "使用已有文件", "根据上下文推断".
2. Source file status: ask whether there is a PPT/PDF/document/image. Options: "没有文件", "有 PPT/PDF", "有文档/图片".
3. Purpose: ask the deck purpose. Options: "汇报/报告", "路演/发布会", "培训/教学".
4. Audience: ask who will watch. Options: "领导/客户", "投资人/合作方", "内部团队/学生".
5. Length: ask slide count or talk duration. Options: "8 页左右", "6 页以内", "10 分钟左右".
6. Style/seriousness: ask visual style and seriousness. Options: "咨询报告 8/10", "科技产品 7/10", "轻松教学 4/10".
7. Speaker notes: ask whether to write speaker notes / 演讲稿. Options: "标准 speaker notes", "详细口播稿", "不要讲稿".
8. Output mode: ask aspect and phone needs. Options: "16:9 普通演示", "9:16 Phone-ready", "16:9 + Phone 同屏".

After the modal response, produce a visible confirmed brief and continue planning. Only if the topic/source remains completely empty should you ask one short free-form follow-up: "主题是什么，或要基于哪个文件制作？"

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

## PDF Export

When the user asks to export, save, render, or convert an HTML deck to PDF, treat PDF as a local publish artifact generated from the HTML source of truth.

- Run `node animated-html-deck/scripts/export-html-to-pdf.mjs [deck.html] [output.pdf]` after the HTML deck exists.
- If no HTML path is supplied, scan only the project root for `.html` files. Use the file automatically only when exactly one root HTML deck exists; otherwise ask for an explicit path.
- Default output path is the same folder and basename as the HTML deck with `.pdf`.
- Generated decks must include a visible `Export PDF` button beside the single `Phone` presenter/publish button.
- Do not promise unconditional automatic PDF download. Automatic PDF generation depends on local Node plus Chrome/Chromium, or on the bundled presenter server export endpoint.
- In raw `file://` mode, `Export PDF` must provide a browser-native `Print / Save as PDF` fallback that calls `window.print()` so any modern browser user can save a PDF manually.
- In raw `file://` mode, also show a copyable `export-html-to-pdf.mjs` command as an advanced export path, but do not make the terminal command the only fallback.
- In presenter-server mode, `Export PDF` calls `POST /export/pdf?session=...` and reports the saved local PDF path.
- Default PDF content is slide-only. Controls, speaker notes, phone panels, edit hints, and runtime UI must be hidden through print CSS.
- Use the deck's existing `@media print` and `@page` rules so 16:9 and 9:16 aspect modes export with matching page sizing.
- Export uses local Chrome/Chromium headless printing. If no browser is found, ask the user to install Chrome/Chromium or set `CHROME_PATH`.
- Do not treat PDF as the editable deliverable. Keep the HTML deck as the source of truth and the PDF as a saved local publish/export file.

## Fullscreen Canvas Contract

Generated decks must treat the browser viewport as the presentation stage and `.slides` as the true slide canvas. Do not wrap the canvas in a decorative browser frame, card, or preview shell.

- Live `.deck` must fill the viewport with `100vw` and `100vh`; do not subtract controls height from the stage.
- Live `.slides` must use a real aspect-ratio canvas. Default 16:9 uses `min(100vw, calc(100vh * 16 / 9))` by `min(100vh, calc(100vw * 9 / 16))`; 9:16 uses `min(100vw, calc(100vh * 9 / 16))` by `min(100vh, calc(100vw * 16 / 9))`.
- The active slide background must cover the full `.slides` canvas. In 9:16 desktop preview, outer stage gutters are allowed because the phone-shaped slide canvas is centered inside the viewport.
- Controls are an overlay on top of the slide, not a layout element that resizes the slide canvas.
- Use internal slide padding to keep important content clear of the bottom controls.
- `Ratio: 16:9 / 9:16` changes live canvas geometry, layout bias, phone preview aspect, and print sizing.
- Print/PDF export still uses `@page deck-wide` and `@page deck-phone` for strict page dimensions.

## Chart Intelligence Protocol

Every generated deck must include a visual planning pass after the slide outline is locked and before HTML is written. This is a skill-level capability, not a per-page decoration.

- Read `references/chart-intelligence.md` for chart planning rules whenever the deck is analytical, report-like, educational, product-oriented, pitch-oriented, or data-bearing.
- For each slide job, add one visual job: `none`, `chart`, `diagram`, or `hybrid`.
- Prefer chart/diagram expression over bullet lists when the content is a trend, comparison, sequence, funnel, risk map, process, scenario, metric summary, market map, or decision tradeoff.
- Report, investment research, market analysis, fundraising pitch, product strategy, executive briefing, and teaching decks should usually have structured visuals on 30-50% of content slides unless the user asks for text-only minimalism.
- Use `references/chart-patterns.md` to choose chart types such as KPI strip, timeline, quadrant, scenario matrix, yield curve, funnel, waterfall, heatmap, and process/flow.
- Use `references/chart-spec.schema.json` as the normalized chart contract. When deterministic validation/rendering is useful, validate with `scripts/validate-chart-spec.mjs` and render with `scripts/render-chart-spec.mjs`.
- Generated chart markup must use inline HTML/SVG, `.viz-card` styling, `data-chart-type`, and `data-chart-spec`. Do not add remote chart libraries, CDN CSS, remote fonts, or analytics.
- Real numeric charts require user-provided data, attached/source-deck data, or cited public/official sources. If data is thin, use concept diagrams, process flows, timelines, scenario matrices, or mark the chart as `illustrative` / `assumption`.
- Every chart needs a visible title, takeaway, and source/note. Speaker notes should explain the chart's implication, not repeat every label.

## Workflow

1. Read `references/deck-generation-rubric.md` before designing the deck whenever purpose, seriousness, style, or audience affects the output.
2. If the user wants a real website-inspired style, use the sibling `style-polish` skill first. Read `../style-polish/SKILL.md` and use its resolved output instead of redoing style selection here.
3. If the user wants source deck replication, run `scripts/extract-source-pages.mjs` first, inspect the manifest and page references, and lock the slide count to the source `pageCount`.
4. Start from `assets/single-file-deck-template.html` unless the user explicitly requests a different framework.
5. Plan the deck before writing HTML:
   - If a host launcher payload is present, normalize it first with `scripts/normalize-launcher-payload.mjs`.
   - If normalization returns `needs_clarification: true`, use one `request_user_input` modal for the single-modal brief intake and wait for the user's answers before planning.
   - If normalization returns `speaker_script_guidance.requires_followup: true`, confirm or state speaker-note defaults before generation.
   - Lock the exact slide count and create a slide-by-slide outline with one job per slide.
   - For source deck replication, make each slide job correspond to the same-numbered source page and preserve page order exactly.
   - Pick a structure that matches the purpose.
   - Decide tone, density, color restraint, and motion intensity from seriousness level.
   - If a specific source style is requested, get one resolved theme package from `style-polish` before writing slide HTML.
   - Add a chart/diagram visual job for each slide. For slides with charts, produce or validate one `chartSpec` before writing final slide markup.
6. Replace the template content with a complete deck:
   - Match the requested slide count exactly. Do not add appendix, cover, agenda, or closing slides beyond the requested count unless the user asks.
   - Keep every dependency local and inline. Do not use external CDNs, remote fonts, remote image URLs, analytics, package installs, or runtime network access by default.
   - Use semantic slide sections and reusable layout classes.
   - For source deck replication, rebuild editable HTML/CSS content wherever practical and use each rendered page image as a reference, not as the default output.
   - If you use a source style, inject one resolved theme payload into the template and ship only that chosen style in the HTML. Do not ship the full style library inside the deck.
   - Keep `data-motion-mode="static"` on the body by default. Do not add `data-motion` or `.fragment` by default. Use motion presets only when the user explicitly asks for animation, advanced motion, product-launch feel, or a similar animated deck.
   - Use `media-frame`, `media-bleed`, `media-split`, `logo-lockup`, and `image-caption` components for visual material.
   - Use `.viz-card` components for charts and diagrams, preserving `data-chart-type` and `data-chart-spec` on the rendered figure.
   - Include `<aside class="notes">` on every slide. Put narration, transitions, and delivery cues there instead of overloading visible slide text.
   - Keep the built-in template switcher, lightweight editing controls, recording presenter mode, and phone presenter hooks unless the user explicitly asks for a minimal deck.
7. Verify the HTML before delivery:
   - Confirm slide count by counting `.slide` sections.
   - For source deck replication, confirm the `.slide` count equals the source manifest `pageCount`.
   - Confirm arrow keys, space, Home/End, click-to-advance, progress, notes toggle, and print styles are present.
   - Confirm no external URLs or linked assets exist. Logos and images must be inline `data:` URIs or generated with HTML/CSS, not remote.
   - Confirm text fits at common desktop and mobile widths and the first viewport shows the actual deck.
   - For PDF-capable deliverables, verify at least one working PDF path exists: successful local export, presenter-server `/export/pdf`, or the raw-file browser `Print / Save as PDF` fallback. A visible `Export PDF` button with no usable fallback fails QA.
8. If the user wants a PDF file, run `scripts/export-html-to-pdf.mjs` after HTML verification. If export succeeds, return the local PDF path alongside the HTML source path. If export fails because the environment lacks Chrome/Chromium, has a path issue, or cannot run Node, return the HTML path and explicitly point to the deck's browser `Print / Save as PDF` fallback.
9. If the user wants phone speaker notes, projection, or same-Wi-Fi sync, default to a LAN publish flow after generating the deck. Start `scripts/presenter-server.mjs` and give the user the opened computer PPT URL plus the phone presenter URL/QR status instead of telling them to open the raw file.

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
- Include only Cursor, Edit, Color, Mode, Ratio, Template, Export PDF, Phone, Note, and Hide controls by default.
- Include editable slide text, editable/savable speaker notes, theme accent color editing, drag-to-move selected text, reset for local presentation polishing, explicit 16:9/9:16 aspect control, and a copyable LAN/IP publish command for raw file mode.
- Include optional phone presenter support when using the bundled template. The deck must still open as a standalone file; cross-device sync only works after running the local presenter server, which is the default publish path for phone-ready sessions and should open a LAN IP deck URL.
- Avoid visible instructions about how to use the deck. The presentation content should be the first-screen experience.

## Speaker Notes Editing Contract

Speaker notes are presenter scripts and must be editable from the deck UI, not only static `<aside class="notes">` content.

- Every generated deck must include a stable `data-deck-id` on `<body>`. Rebuilds of the same subject should reuse the same deck id so saved notes can restore after refresh or regeneration when slide order is unchanged.
- The `Notes` panel must include `notesEditor`, `notesSave`, `notesReset`, and `notesSaveStatus` controls.
- `Save` must convert textarea text to safe HTML, write it back to the current slide's `.notes`, persist the plain text in `localStorage` under `animated-html-deck-notes:${deckId}:${slideIndex}`, and immediately republish `/sync/state` when served mode is active.
- `Reset` must restore the current slide's original `.notes` HTML and clear that slide's localStorage entry.
- `buildSyncState()` must always read the current `.notes.innerHTML` so the phone presenter receives the edited/saved script as `notesHtml`.
- The phone presenter displays the synced notes as read-only by default; do not add phone-side script editing unless explicitly requested.

## Control Runtime Contract

Built-in controls must be runnable, not just visible. Use stable IDs: `cursorToggle`, `editToggle`, `colorToggle`, `accentColorPicker`, `modeToggle`, `ratioToggle`, `templateToggle`, `exportPdfToggle`, `phoneToggle`, `notesToggle`, and `hideToggle`.

- `Color` must use `colorToggle` as the canonical control id. Keep JS compatibility with old `colorButton` decks, but do not generate new `colorButton`-only controls.
- Make `Color` a native trigger for `accentColorPicker`, such as `<label for="accentColorPicker">Color</label>`, and also listen to both `input` and `change` so the accent updates during drag and after confirmation.
- `Cursor` must call `setCursorMode()`, exit editing, clear DOM selection, remove `.is-selected` / `.is-dragging`, and close `contentEditable`.
- `Edit` must be the only visible control that enables text selection, drag-to-move, and contentEditable nodes.
- Bind control events through a safe helper so one missing optional control warns through `console.warn` but does not prevent the rest of the controls from binding.
- Expose `window.__deckControlHealth` with required controls, bound controls, and live state for editing, accent color, aspect, PDF export, phone panel, notes panel, controls visibility, and fullscreen state.

## Go Live / Phone Sync Contract

Any deck with `GO LIVE`, `Launch`, or `Phone` controls must use the bundled presenter-server contract. This applies even when the user asks for a custom minimal control bar instead of the default template controls.

- Do not hard-code `localhost:3000`, `http://localhost:3000/<deck>.html?session=default`, or any other unrelated development server as the launch target.
- `GO LIVE` / `Launch` in raw `file://` mode must discover the presenter server by scanning the expected presenter port range and calling `/sync/config?session=default`.
- Treat the presenter server as online only when the fetch succeeds, `response.ok` is true, and the JSON includes a usable `localDeckUrl`.
- Validate that `config.deckName` matches the current deck filename before redirecting. If the deck names do not match, keep scanning or show the launch command.
- Redirect only to `config.localDeckUrl` or the equivalent presenter-server `/deck?session=...` URL. Never redirect to a guessed raw filename route on port 3000.
- If no matching server is found, do not navigate and do not create a 404. Show a copyable command such as `node animated-html-deck/scripts/presenter-server.mjs deck.html --port 4175 --deck-host local` or `--deck-host lan`.
- In served mode, publish slide state after render/navigation through `/sync/state`, including current slide index, title, notes, deck URL, presenter URL, and next-slide preview when available.
- In served mode, listen to `/sync/commands` with `EventSource` so phone presenter actions such as `next` and `prev` control the desktop deck.
- `Phone` cannot be a placeholder. In served mode it must read `/sync/config`, display the phone presenter URL and QR URL, and keep state/commands in sync. In raw file mode it must show the presenter-server launch command instead.
- Phone-ready deliverables should start `scripts/presenter-server.mjs` for the user when possible, then lead with the computer deck URL and phone presenter URL/QR status instead of asking the user to rely on the raw file.

## Built-In Templates (Premium Design)

- **Style A: Tech Platinum (白金精密版)**: 极致的实验室制图感。使用白底配合 `32px` 或 `40px` 的极细点阵网格（Dot Grid），采用 `1px` 极细边框（Hairline Border）和微弱的悬浮阴影。小标签和数据标注强制使用等宽字体（Monospace），核心色为电光蓝（Electric Blue）。适用于高端投研报告、金融数据演示、精密 SaaS 产品。
- **Style B: Cyber Deep (深空赛博版)**: 沉浸式未来感。背景使用深海黑（#0F172A）到深藏青的非线性渐变。大量应用毛玻璃质感（Glassmorphism），配合 `1px` 的发光边框和多层霓虹色扩散阴影。文字使用亮白色，重要标注使用荧光色（如荧光绿、荧光紫）。适用于 AI 产品发布会、技术趋势展望、数据智能展示。
- **Style C: Swiss Editorial (瑞士排版版)**: 极致的文字张力和留白。采用瑞士国际主义排版风格，使用极大的字号对比（例如标题 6rem，正文 1.2rem）。严格遵循 12 列或 24 列网格系统。配色方案仅限黑、白、红（或单一高饱和色）。适用于战略大纲、品牌发布、极简主义设计演讲。

Template switching must change layout feel, density, radius, shadow depth, and background texture, not only colors. When a specific website style is requested, resolve it through `style-polish` first, then map it to one premium layout family plus one runtime template fallback.

## Motion System (Choreographed)

- **Default Motion**: 默认幻灯片具有基础切换动效。当用户明确要求动画或“发布会感”时，设置 `data-motion-mode="animated"` 并使用 `data-motion` 预设，创建具有物理感和叙事性的高级动效。
- **Physics-based Easing**: 严禁使用生硬的 `ease-in-out`。必须使用 `cubic-bezier(0.16, 1, 0.3, 1)` (Apple Style) 或具有微弹性的 `cubic-bezier(0.22, 1, 0.36, 1)`，模拟物理世界的惯性。
- **Staggered Entry (交错进入)**: 禁止所有元素同时弹出。必须使用层层递进的时序逻辑（Staggered index），让标题、副标题、卡片依次升起，建立视觉引导。
- **Premium Presets**:
  - `hero-reveal`: 带有遮罩深度偏移的标题显现。
  - `glass-wipe`: 模拟磨砂玻璃扫过的背景或文字显现。
  - `media-float`: 图片或截图带有微小的 3D 悬浮视差。
  - `card-stack`: 具有物理层叠感的卡片展开。
  - `metric-pulse`: 数字增长的同时带有微小的呼吸缩放感。
  - `chart-grow`: 图表数据的平滑生长动画。
- Motion should sequence attention and feel high-end, not busy. For serious decks, use fewer animated fragments and slower, more graceful transitions. Keep `prefers-reduced-motion` support intact.

## Image Rules

- For local images, run `node scripts/image-to-data-uri.mjs /path/to/image.png` and paste the output into `<img src="...">`.
- For remote image URLs, do not link them directly by default. Download and embed only when browsing/downloading is appropriate for the user request; otherwise ask for a local file.
- Never invent real product screenshots, customer logos, or brand assets. If no image is provided, use HTML/CSS diagrams, charts, or clearly illustrative placeholders.
- Use `alt` text on every meaningful image. Use empty `alt=""` only for purely decorative generated placeholders.
- Put logos or company names in normal slide content such as `logo-lockup`; put content images inside slide body media components.

## Design Guidance (Premium Principles)

- **Aesthetics First (视觉优先)**: 生成的幻灯片必须让用户感到“WOW”。禁止使用浏览器默认配色、无阴影的色块或单调的白底黑字。
- **Rich Backgrounds (富背景)**: 优先使用非线性渐变（Linear/Radial/Mesh Gradients）。在背景中加入极细的噪点（Noise Texture）或动态微弱的弥散光，提升视觉深度。
- **Typography (现代排版)**: 优先选择 `Inter`, `Outfit`, `Manrope` 等具有国际化审美的高品质无衬线字体。中文标题应使用大字重、大比例字号对比，营造层级感。
- **Glassmorphism (玻璃拟态)**: 灵活使用 `backdrop-filter: blur()`，配合微透明的面板背景、低浓度多层阴影（Smooth Shadows）和 1px 半透明边框，模拟精美的物理质感。
- **Interaction (交互反馈)**: 所有可点击的元素（按钮、卡片、导航）必须包含悬浮态（Hover）的缩放、投影加深或微妙的发光效果。
- **Information Density (信息密度)**: 严肃报告通过紧凑布局和精致的网格系统体现专业度；产品发布通过极致的留白和巨大的标题体现冲击力。
- **Visual Metaphors**: 使用 HTML/CSS 制作精美的图表、示意图和视觉隐喻（如进度追踪、天平对比、热力图），而不是枯燥的列表。
- **Website-inspired Look**: 当用户请求某种网页风格时，保留其配色逻辑、排版偏差和表面处理（Surface Treatment），但将其转化为适合大屏演示的排版逻辑，不要机械复刻网页布局。

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
- `scripts/export-html-to-pdf.mjs`: export an HTML deck to a slide-only local PDF through Chrome/Chromium headless print mode.
- `scripts/normalize-launcher-payload.mjs`: normalize a partial launcher payload into inferred/defaulted deck inputs with source markers and high-risk warnings.
- `scripts/validate-chart-spec.mjs`: validate normalized chart specs for data integrity, supported chart types, and no remote dependencies.
- `scripts/render-chart-spec.mjs`: render a validated chart spec into inline HTML/SVG for single-file decks.
- `references/chart-intelligence.md`: read when planning chart/diagram usage across a deck.
- `references/chart-patterns.md`: read when choosing chart types for reports, pitches, teaching decks, product explainers, and data-poor briefs.
- `references/chart-spec.schema.json`: the normalized chart contract for reusable skill-level chart generation.
- `scripts/presenter-server.mjs`: use when the user wants phone-based speaker notes, projection, or same-Wi-Fi presenter sync. Run `node scripts/presenter-server.mjs deck.html --port 4173 --deck-host lan` so the computer opens the LAN IP deck URL by default; then scan the `Phone Presenter` QR code from the phone. The phone URL must use the computer's LAN IP, never `localhost` or `127.0.0.1`. If the user explicitly wants an offline-only file, skip the server.
- `references/deck-generation-rubric.md`: read when mapping user intent to slide structure, tone, animation intensity, content expansion, and final QA checks.
- `../style-polish/SKILL.md`: use when the user wants a website-inspired look or when you need a resolved theme package.
- `../style-polish/styles/style-catalog.json`: read only when you need to inspect the normalized style data directly.
- `../style-polish/scripts/resolve-style-theme.mjs`: use when you want a deterministic resolved style package for deck generation.
## Publish Rules

- Default deliverable: return the generated `.html` file path for offline use.
- PDF deliverable: if the user asks for a saved PDF, run `node animated-html-deck/scripts/export-html-to-pdf.mjs deck.html [output.pdf]`. Return both the editable HTML source path and local PDF path when export succeeds; if export fails, return the HTML source path plus the browser `Print / Save as PDF` fallback and the error reason.
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
