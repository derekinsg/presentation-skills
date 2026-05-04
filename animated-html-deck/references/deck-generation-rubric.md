# Deck Generation Rubric

Use this rubric to translate a user brief into a polished single-file HTML presentation. Keep the deck self-contained unless the user explicitly approves external assets.

## Pre-Generation Checklist

- Identify topic, audience, language, and speaking context.
- Lock the exact slide count before writing HTML.
- Classify purpose: speech, pitch, teaching, explanation, report, workshop, or mixed.
- Convert seriousness to a 1-10 level.
- Select a visual style and name the design intent in one sentence for yourself.
- If the user references a real website or brand-inspired direction, resolve it through the sibling `style-polish` skill before you write slide HTML.
- For company-grade decks, identify company/product name, logo availability, brand color, confidentiality needs, source/date labels, and the built-in template to use.
- Identify available local images, their role, and whether they should be logos, screenshots, diagrams, cover media, or supporting visuals.
- Create a slide-level visual plan: `none`, `chart`, `diagram`, or `hybrid`.
- Decide what must be visible on slides versus moved into speaker notes.
- If content is thin, expand with logical structure and clearly framed assumptions; do not fabricate proof.

## Purpose Mapping

- Speech: build a clear arc, strong opening, memorable transitions, concise slide text, richer speaker notes.
- Pitch: define problem, urgency, solution, product experience, proof, buyer or market, model, ask, and close.
- Explanation: introduce concepts progressively, use examples, show process diagrams, keep labels precise.
- Teaching: add learning goals, analogies, worked examples, checks for understanding, recap, and pacing notes.
- Report: lead with conclusion, show evidence, explain implications, identify risks, close with decisions or next steps.

## Slide Count Patterns

- 4-6 slides: thesis, context, core idea, evidence or walkthrough, recommendation, close.
- 7-10 slides: title, agenda/thesis, situation, problem, insight, solution/process, evidence, implications, next steps, close.
- 11+ slides: divide into sections with divider slides and recurring navigation context.
- Always adapt to the requested count exactly. Combine or split slide jobs instead of changing the count.

## Built-In Template Mapping

- Apple: product launch, tool demos, capability introductions, premium but calm narratives. Use big type, low density, broad whitespace, and blue emphasis.
- Airbnb: approachable explainers, onboarding, learning, community, lifestyle, and informal product education. Use warm surfaces, rounded cards, friendly pacing, and coral emphasis.
- Executive Corporate: company roadshows, leadership updates, serious pitches, investor-style summaries, and boardroom narratives. Use compact proof, sober blue/teal emphasis, and motion only when requested.
- Consulting Report: strategy recommendations, operating-model explanations, market analysis, transformation plans, and dense reports. Use structured sections, analytical grids, muted accents, and precise labels.

If the user names a brand-inspired style, map it to the closest built-in template unless they explicitly request a custom design.

## Website Style Mapping

- Use `style-polish` as the first stop for source-style selection.
- Treat the chosen source style as a reference system, not as a homepage clone.
- Resolve every requested source style into:
  - one `layoutFamily`
  - one `runtimeTemplateFallback`
  - one final token set for colors, surfaces, and typography bias
- Ship only the resolved style payload inside the generated deck. Do not embed the entire catalog or vendor repo into the final HTML.
- If the source style is weak for dense charts or reports, keep its palette and typography cues but fall back to `executive-report` or `consulting-report` structure.

## Seriousness Scale

- 1-2 playful: bright accents, conversational copy, larger shapes, generous whitespace.
- 3-4 relaxed: warm palette, friendly examples, simple diagrams, low text density.
- 5-6 balanced: crisp hierarchy, moderate contrast, practical layouts, medium density.
- 7-8 formal: restrained colors, compact evidence, precise wording, minimal decoration.
- 9-10 boardroom: sober palette, high information integrity, dense but readable evidence, no gimmicks.

## Visual And Motion Rules

- Choose 2-4 theme colors plus neutral text/background colors.
- Use system fonts and CSS variables.
- Use chart intelligence for analytical, report, pitch, product, and teaching decks: choose a chart/diagram pattern before writing visual slide content.
- Default decks are static: keep `data-motion-mode="static"` and do not add `data-motion` or `.fragment` unless the user explicitly requests animation, advanced motion, product-launch feel, or similar.
- When motion is requested, set `data-motion-mode="animated"` and use `hero-reveal` for title moments, `mask-wipe` for labels, `media-parallax` for images, `card-stack` for cards, `metric-count` for numbers, `chart-draw` for charts, `process-trace` for process layouts, and `stagger-rise` for supporting copy.
- Make requested transitions 520-960ms with subtle depth and easing. Serious decks should use fewer fragments, not weaker craft.
- Avoid animation that changes layout after text is read.
- Keep `prefers-reduced-motion` support for animated decks.
- Build charts and diagrams from HTML/CSS when possible; keep labels readable and legends simple.
- Render chart specs inline with `.viz-card`, `data-chart-type`, and `data-chart-spec`; never depend on remote chart libraries.
- Use slide layouts that match content, not repeated generic cards.

## Image And Media Rules

- Embed local images as `data:` URIs using `scripts/image-to-data-uri.mjs`.
- Do not reference remote image URLs, image CDNs, remote logos, remote fonts, or analytics by default.
- Use `media-frame`, `media-bleed`, `media-split`, `logo-lockup`, and `image-caption` for consistent placement.
- Every meaningful image needs concise `alt` text. Use empty `alt=""` only for decorative generated placeholders.
- Use `object-fit`, `aspect-ratio`, and responsive constraints so images do not stretch, overlap text, or overflow on mobile.
- Do not invent real product screenshots, customer logos, press logos, or brand assets. Use clearly illustrative placeholders when no asset is provided.

## Brand And Source Content

- Do not create fixed page headers or footers.
- Put company names, logos, dates, source labels, confidentiality notes, or page context into ordinary slide content when needed.
- Embed user-provided local logos inline as `data:` URIs or inline SVG. Do not reference remote logo URLs by default.
- If no logo is provided, use a short text mark or initials as ordinary content. Never invent a real company logo.

## Content Expansion Rules

- For missing proof, use phrasing like "illustrative scenario", "assumption", or "example workflow".
- Do not invent real customer names, revenue, market size, dates, citations, regulatory facts, or benchmark claims.
- Prefer useful placeholder language over fake authority when the user has not supplied data.
- Move optional talking points into notes rather than filling slides with dense prose.

## Delivery QA Checklist

- Slide count matches the requested number exactly.
- Every slide has one `<section class="slide">` and one `<aside class="notes">`.
- The first screen is the deck itself.
- No external network dependencies exist.
- Logos and content images are inline `data:` URIs or HTML/CSS visuals, and remain visible at desktop and mobile widths.
- Meaningful images include `alt` text and captions when useful.
- Keyboard controls work: Arrow keys, space, Home, End.
- Progress indicator reflects the current slide.
- Notes exist on every slide and are hidden by default.
- Default controls include previous, next, Cursor, Edit, A+/A-, Reset, Color, Mode, Template, Ratio, Publish/IP, Phone, Notes, and Full.
- Template switching changes layout feel and density, not only the accent color.
- Default static decks contain no `data-motion` or `.fragment`; animated decks use multiple presets sequenced by narrative priority, not a single generic fade.
- Edit mode can modify slide text, adjust size, drag selected text, reset edits, and change accent color; Cursor exits editing and clears selected text.
- Ratio mode can switch between true 16:9 and 9:16 slide canvases, with matching print page sizing.
- Live browser mode uses a true fullscreen canvas: `.deck` and `.slides` fill the viewport and controls overlay the slide instead of shrinking it into a framed stage.
- If phone presenter support is included, it is optional: the deck still works from `file://`, and same-Wi-Fi sync is activated only by the local presenter server.
- Phone presenter QR codes must point to the computer's LAN IP, not `localhost` or `127.0.0.1`.
- If a source website style is used, the final deck must still contain only one resolved style, not the full 70-style catalog.
- Print CSS outputs one slide per page.
- Chart bars and images remain visible in print mode.
- Text fits without overlap at desktop and mobile widths.
- The visual style matches seriousness, purpose, audience, and user language.
