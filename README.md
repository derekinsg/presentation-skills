# Presentation Skills for Claude Code and Codex

Local, file-based AI skills for making better presentations with Claude Code and Codex. This repository packages reusable skills for generating polished browser-based slide decks, resolving visual direction into concrete design systems, and rewriting speaker scripts into performable presenter notes.

The skills are designed for agentic coding environments: they include `SKILL.md` instructions plus supporting templates, references, schemas, and Node scripts. They are not a hosted SaaS, API wrapper, or paid service. Generated content should always be reviewed and fact-checked by the user.

## Overview

This bundle focuses on presentation work that benefits from code-native output:

- single-file HTML decks that run offline in a browser
- source-deck reconstruction from PDF/PPT/PPTX references
- chart and diagram planning for analytical slides
- website-inspired theme resolution for decks and HTML UI
- slide-by-slide speaker notes and presentation scripts
- PDF export and same-Wi-Fi phone presenter workflows

The main deck skill folder is `animated-html-deck`, while its public skill name is `awesome-presentation`.

## Who This Is For

Use this repository if you want Claude Code or Codex to help with:

- executive briefings, investor decks, reports, product launches, explainers, training decks, and teaching material
- Chinese, English, or bilingual presentation workflows
- HTML decks that remain editable and inspectable as source files
- local-first presentation generation without remote runtime dependencies by default
- repeatable presentation quality checks before sharing or publishing

## Skills Included

| Skill | Folder | Invoke In Claude Code | Invoke In Codex | Purpose |
| --- | --- | --- | --- | --- |
| `awesome-presentation` | `animated-html-deck` | `/awesome-presentation` | `$awesome-presentation` | Generate polished, offline-ready HTML slide decks with notes, controls, charts, PDF export, and optional phone sync. |
| `style-polish` | `style-polish` | `/style-polish` | `$style-polish` | Resolve abstract or website-inspired style requests into one reusable design package. |
| `speaker-polish` | `speaker-polish` | `/speaker-polish` | `$speaker-polish` | Rewrite slide notes, scripts, and narration with stronger structure, rhythm, and delivery guidance. |

## What It Can Do

### Deck Generation

- Create self-contained `.html` decks with embedded CSS and JavaScript.
- Control exact slide count, purpose, audience, seriousness level, visual style, and aspect ratio.
- Support 16:9 and 9:16 layouts with a fullscreen browser canvas.
- Include keyboard navigation, progress UI, fullscreen support, print styles, and built-in controls.
- Embed local images as `data:` URIs and avoid CDN/runtime network dependencies by default.
- Provide editable slide text, accent color editing, drag-to-move selected text, and reset support for local polishing.
- Include editable speaker notes with Save/Reset behavior and local persistence.

### Visual Design

- Turn style requests such as `Vercel`, `Linear`, `Stripe`, `Apple`, `Airbnb`, or `high-end developer tool` into concrete theme packages.
- Return design tokens, layout family, runtime template fallback, suitability guidance, and translation notes.
- Adapt website-inspired looks to presentation media instead of mechanically copying homepage layouts.
- Support executive-report, consulting-report, product-launch, teaching, pitch, and explainer visual directions.

### Charts And Diagrams

- Plan chart or diagram jobs for analytical, report-like, product, pitch, and teaching decks.
- Render KPI strips, timelines, quadrants, scenario matrices, funnels, waterfalls, heatmaps, process flows, and hybrid diagrams.
- Use inline HTML/SVG chart output with `data-chart-type` and `data-chart-spec`.
- Validate normalized chart specs with bundled scripts.
- Require real data from the user, source material, or cited sources for numeric charts; otherwise mark visuals as illustrative or assumption-based.

### Speaker Layer

- Write slide-by-slide speaker notes as presenter-ready narration, not internal slide directions.
- Add transitions, delivery cues, and memory points.
- Preserve facts, numbers, names, dates, and claims while improving structure and cadence.
- Support Chinese business presentation styles and English presentation workflows.
- Offer rhetorical archetypes such as Jobs-inspired clarity, Duarte story structure, Rosling data storytelling, Luo Yonghao-inspired product explanation, and Guo Degang-inspired light humor without impersonation.

### Export And Presenting

- Export HTML decks to slide-only PDFs through Chrome/Chromium when available.
- Provide browser print fallback for raw `file://` decks.
- Run a local presenter server for LAN deck URLs.
- Show same-Wi-Fi phone presenter links and QR codes.
- Sync slide state and speaker notes from the desktop deck to the phone presenter.

### Source Deck Workflows

- Extract page references from root-level `.pdf`, `.ppt`, and `.pptx` files.
- Rebuild source decks as editable HTML/CSS where practical.
- Use rendered page images as visual references rather than defaulting to screenshot-only slides.
- Support PPT/PPTX conversion when LibreOffice/`soffice` is available; otherwise ask the user to export source decks as PDF.

### Quality And Safety

- Keep generated decks local-first and inspectable.
- Avoid remote fonts, remote images, analytics, and package installs by default.
- Avoid invented metrics, customer names, citations, quotes, and dates.
- Include smoke tests for skill metadata, bundled resources, chart scripts, PDF export, presenter server behavior, and public-release risk patterns.

## Install For Claude Code

Claude Code supports filesystem skills in personal or project skill directories. See the official Claude Code skills docs: <https://code.claude.com/docs/en/skills>

Clone this repository:

```bash
git clone https://github.com/derekinsg/presentation-skills.git
cd presentation-skills
```

Install as personal Claude Code skills:

```bash
mkdir -p ~/.claude/skills
cp -R animated-html-deck ~/.claude/skills/awesome-presentation
cp -R style-polish ~/.claude/skills/style-polish
cp -R speaker-polish ~/.claude/skills/speaker-polish
```

Or install into a project so the skills are available only there:

```bash
mkdir -p .claude/skills
cp -R animated-html-deck .claude/skills/awesome-presentation
cp -R style-polish .claude/skills/style-polish
cp -R speaker-polish .claude/skills/speaker-polish
```

Start Claude Code in the target project and invoke:

```text
/awesome-presentation
/style-polish
/speaker-polish
```

Claude Code can also load skills automatically when a request matches the skill description.

## Install For Codex

Clone this repository:

```bash
git clone https://github.com/derekinsg/presentation-skills.git
cd presentation-skills
```

Copy the skill folders into your Codex skills directory:

```bash
mkdir -p "$CODEX_HOME/skills"
cp -R animated-html-deck "$CODEX_HOME/skills/"
cp -R style-polish "$CODEX_HOME/skills/"
cp -R speaker-polish "$CODEX_HOME/skills/"
```

Then invoke the skills in Codex:

```text
Use $awesome-presentation to create an 8-slide deck...
Use $style-polish to resolve a visual direction...
Use $speaker-polish to rewrite these speaker notes...
```

## Quickstart Prompts

Claude Code:

```text
/awesome-presentation Create an 8-slide Chinese investor pitch HTML deck about an AI customer service product. Seriousness 9/10. Style like Vercel. Include speaker notes.
```

```text
/style-polish Resolve a boardroom strategy-report theme. The visual direction should feel like a high-end developer tool, seriousness 8/10.
```

```text
/speaker-polish Rewrite these slide notes in a Steve Jobs inspired product-launch style. Preserve every fact and give speaker notes, delivery cues, and memory points.
```

Codex:

```text
Use $awesome-presentation to create an 8-slide Chinese investor pitch HTML deck about an AI customer service product. Seriousness 9/10. Style like Vercel. Include speaker notes.
```

```text
Use $style-polish to choose a style for a strategy report. The vibe should feel like a high-end developer tool, but readable in a boardroom.
```

```text
Use $speaker-polish to improve these HTML deck notes with Hans Rosling inspired data storytelling. Do not change visible slide text.
```

More examples: [examples/prompts.md](examples/prompts.md)

## Common Workflows

### Generate A New HTML Deck

Use `awesome-presentation` with a clear topic, audience, slide count, seriousness level, purpose, and style direction. The output should be one local `.html` file unless you ask for supporting files.

### Rebuild A Source Deck

Place a `.pdf`, `.ppt`, or `.pptx` in the project root and ask `awesome-presentation` to recreate or convert it. The skill uses `animated-html-deck/scripts/extract-source-pages.mjs` to render source-page references and locks the slide count to the source page count.

### Export A Deck To PDF

After an HTML deck exists, ask for PDF export. The skill uses:

```bash
node animated-html-deck/scripts/export-html-to-pdf.mjs deck.html
```

The HTML remains the editable source of truth; the PDF is a local publish artifact.

### Present With Phone Notes

For same-Wi-Fi phone presenter sync, run:

```bash
node animated-html-deck/scripts/presenter-server.mjs deck.html --port 4173 --deck-host lan
```

The server reports a computer deck URL, local fallback URL, phone presenter URL, and QR URL. Keep the terminal open while presenting.

### Resolve A Visual Style Before Deck Generation

Use `style-polish` first when a deck should feel like a specific website or design system. Feed the resolved theme package into `awesome-presentation`.

### Polish Speaker Notes Only

Use `speaker-polish` when the slides already exist and you only want stronger narration, transitions, delivery cues, and memory points.

## Documentation

- Chinese quickstart: [docs/quickstart.zh-CN.md](docs/quickstart.zh-CN.md)
- Chinese black-box simulation test flow: [docs/simulation-test.zh-CN.md](docs/simulation-test.zh-CN.md)
- Chinese manual acceptance checklist: [docs/manual-acceptance-checklist.zh-CN.md](docs/manual-acceptance-checklist.zh-CN.md)
- Copy-ready prompts: [examples/prompts.md](examples/prompts.md)

## Testing

Run the repository smoke suite before publishing or installing from a fresh clone:

```bash
npm test
```

The smoke suite checks:

- skill metadata and referenced bundled resources
- deterministic launcher, style, image, and chart helper scripts
- chart spec validation and inline rendering
- single-file deck template runtime features
- local PDF export behavior
- presenter server startup, deck URLs, phone URLs, and QR URLs
- public-release risk patterns such as secrets or local absolute paths
- agent simulation prompt fixtures

For a black-box install test, follow [docs/simulation-test.zh-CN.md](docs/simulation-test.zh-CN.md).

## Repository Layout

```text
animated-html-deck/
  SKILL.md
  assets/single-file-deck-template.html
  references/
  scripts/
style-polish/
  SKILL.md
  references/
  scripts/
  styles/style-catalog.json
speaker-polish/
  SKILL.md
docs/
examples/
tests/
```

Important scripts:

- `animated-html-deck/scripts/extract-source-pages.mjs`
- `animated-html-deck/scripts/export-html-to-pdf.mjs`
- `animated-html-deck/scripts/image-to-data-uri.mjs`
- `animated-html-deck/scripts/normalize-launcher-payload.mjs`
- `animated-html-deck/scripts/presenter-server.mjs`
- `animated-html-deck/scripts/render-chart-spec.mjs`
- `animated-html-deck/scripts/validate-chart-spec.mjs`
- `style-polish/scripts/resolve-style-theme.mjs`

## Release Checklist

Before cutting a release:

1. Run `npm test`.
2. Review `git status --short --ignored`.
3. Make sure generated root HTML decks, screenshots, local caches, private source material, and machine-specific files are not staged.
4. Follow the black-box flow in [docs/simulation-test.zh-CN.md](docs/simulation-test.zh-CN.md).
5. Install the skills into a fresh Claude Code or Codex skills directory and run at least one prompt for each skill.
6. Open generated decks at desktop and mobile widths; check text fit, navigation, speaker notes, print preview, and phone sync when relevant.
7. Build a release zip from tracked files:

```bash
git archive --format zip --prefix=presentation-skills/ -o presentation-skills.zip HEAD
```

## Limitations And Fact-Checking

- This repository provides local skills and scripts, not a hosted service.
- Generated presentation content may be incomplete or wrong if the source brief is incomplete.
- Users must verify claims, metrics, customer names, dates, citations, and market data.
- Numeric charts should use user-provided, source-deck, or cited data. If data is thin, the skill should use illustrative diagrams or clearly label assumptions.
- PDF export depends on local Node.js and Chrome/Chromium. PPT/PPTX source extraction depends on LibreOffice/`soffice`.
- Phone sync requires the local presenter server and devices on the same Wi-Fi network.

## License

This repository is released under the MIT License. The vendored `awesome-design-md` material keeps its own upstream license in `style-polish/vendor/awesome-design-md/LICENSE`.
