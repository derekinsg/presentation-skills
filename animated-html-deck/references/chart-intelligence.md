# Chart Intelligence

Use this reference whenever a deck contains analysis, data, comparison, process, market sizing, teaching, product flow, or decision-making content. The goal is to make charts a skill-level habit, not a one-off page trick.

## Visual Planning Contract

After the slide outline is locked and before writing HTML, create a visual job for every slide:

- `none`: the slide should stay typographic or image-led.
- `chart`: numeric data is available and can be shown honestly.
- `diagram`: relationships, process, concepts, or decisions matter more than exact values.
- `hybrid`: combine a concise chart with 1-2 explanatory cards.

For report, market analysis, investment research, fundraising pitch, product strategy, teaching, and executive briefing decks, at least 30-50% of content slides should contain a chart, diagram, matrix, timeline, KPI strip, or other structured visual unless the user explicitly asks for minimal text-only slides.

## Data Integrity Rules

- Use real numeric charts only when values come from the user, an attached source, or a cited official/public source.
- If values are approximate or invented for structure, mark the chart `assumption` or `illustrative` in the note/source.
- Do not invent real revenue, market size, customers, dates, regulatory facts, stock prices, yields, or benchmark claims.
- If data is thin, use concept diagrams, process flows, comparison matrices, scenario matrices, timelines, or quadrant maps instead of fake numeric charts.
- Every chart needs a visible takeaway, concise labels, and a source/note area.

## Chart Selection

- KPI strip: 2-4 headline numbers with short labels.
- Yield curve / line: ordered points over maturity, time, maturity, price, adoption, or performance.
- Bar / waterfall: contribution, variance, ranked comparison, before/after movement.
- Funnel: conversion, sales pipeline, onboarding steps, adoption drop-off.
- Timeline: roadmap, milestones, historical sequence, policy/event chronology.
- Quadrant: strategic positioning, risk/impact, attractiveness/feasibility, competitive map.
- Scenario matrix: base/upside/downside, rates/growth/inflation scenarios, operating alternatives.
- Heatmap: cross-impact, segment attractiveness, capability maturity, risk intensity.
- Process/flow: product workflow, operating model, teaching sequence, implementation plan.

## Quality Standard

A chart should answer one question. Its title says what it is, its takeaway says what changed or matters, and its note/source says where the numbers came from or why they are illustrative. Prefer one strong chart over four small decorative graphics.

## Rendering

Use `references/chart-spec.schema.json` as the shape for chart specs. Validate with `scripts/validate-chart-spec.mjs` and render with `scripts/render-chart-spec.mjs` when deterministic output is useful. Generated decks should embed rendered chart HTML/SVG inline and keep the original chart spec in `data-chart-spec`.
