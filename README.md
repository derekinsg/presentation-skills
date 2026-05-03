# Presentation Skills for Codex and ChatGPT

This repository packages three presentation-focused AI skills for public GitHub distribution:

- `animated-html-deck`: generate self-contained browser-based HTML slide decks with speaker notes, print styles, editing controls, optional motion presets, and optional same-Wi-Fi presenter sync.
- `style-polish`: resolve a vague or website-inspired visual direction into one reusable design theme package.
- `speaker-polish`: rewrite presentation scripts and speaker notes with clear, performable, master-inspired rhetorical patterns.

The first public release target is a GitHub-distributed skill bundle. It is not a hosted SaaS, API wrapper, or paid service. Generated deck content should always be fact-checked by the user, especially claims, metrics, customer names, dates, and citations.

## Documentation

- Chinese quickstart: [docs/quickstart.zh-CN.md](docs/quickstart.zh-CN.md)
- Chinese black-box simulation test flow: [docs/simulation-test.zh-CN.md](docs/simulation-test.zh-CN.md)
- Chinese manual acceptance checklist: [docs/manual-acceptance-checklist.zh-CN.md](docs/manual-acceptance-checklist.zh-CN.md)
- Copy-ready prompts: [examples/prompts.md](examples/prompts.md)

## Install

Clone this repository:

```bash
git clone https://github.com/<your-org>/<your-repo>.git
cd <your-repo>
```

For Codex-style local skills, copy any skill folder you want to use into your local skills directory:

```bash
mkdir -p "$CODEX_HOME/skills"
cp -R animated-html-deck style-polish speaker-polish "$CODEX_HOME/skills/"
```

For ChatGPT Skills, download a release zip and upload the skill folder through the ChatGPT Skills UI. OpenAI's current Skills documentation is the source of truth for supported upload, sharing, and product-specific behavior: <https://help.openai.com/en/articles/20001066-skills-in-chatgpt>

## Real-User Simulation

The most realistic test is a black-box install from a fresh directory:

```bash
mkdir -p ~/tmp/skill-e2e-test
cd ~/tmp/skill-e2e-test
git clone https://github.com/<your-org>/<your-repo>.git
cd <your-repo>
npm test
```

Then install into a clean local skill environment:

```bash
export CODEX_HOME="$(mktemp -d)"
mkdir -p "$CODEX_HOME/skills"
cp -R animated-html-deck style-polish speaker-polish "$CODEX_HOME/skills/"
```

Open a new Codex session and run at least one prompt for each skill. For full steps, use [docs/simulation-test.zh-CN.md](docs/simulation-test.zh-CN.md).

## Quick Test

Run the repository smoke suite before publishing or installing from a fresh clone:

```bash
npm test
```

The smoke suite checks:

- skill metadata and UI metadata
- references to bundled assets, scripts, and documentation
- deterministic launcher/style/image helper scripts
- HTML deck template contract: notes, controls, print styles, static default, and no remote runtime assets
- local presenter server startup and URL reporting
- public-release risk patterns such as secrets or local absolute paths
- agent simulation prompt fixtures for manual forward testing

## Example Prompts

See [examples/prompts.md](examples/prompts.md) for copy-ready prompts. Minimal examples:

```text
Use $animated-html-deck to create an 8-slide Chinese investor pitch HTML deck about an AI customer service product. Seriousness 9/10. Style like Vercel. Include speaker notes.
```

```text
Use $style-polish to resolve a PPT theme for a boardroom strategy report. The visual direction should feel like a high-end developer tool, seriousness 8/10.
```

```text
Use $speaker-polish to rewrite these slide notes in a Steve Jobs inspired product-launch style. Preserve every fact and give speaker notes, delivery cues, and memory points.
```

## Release Checklist

Before cutting `v0.1.0-beta`:

1. Run `npm test`.
2. Review `git status --short --ignored` and make sure generated root HTML decks, screenshots, local caches, and private materials are not staged.
3. Follow the black-box flow in [docs/simulation-test.zh-CN.md](docs/simulation-test.zh-CN.md).
4. Manually install the skills into a fresh local skills directory and run at least one prompt for each skill.
5. Open 3-5 generated decks on desktop and mobile widths; check text fit, navigation, speaker notes, and print preview.
6. Ask 2-3 external users to install from the README and file issues for any friction.
7. Build a release zip from tracked files:

```bash
git archive --format zip --prefix=presentation-skills-v0.1.0-beta/ -o presentation-skills-v0.1.0-beta.zip HEAD
```

## Licensing

This repository is released under the MIT License. The vendored `awesome-design-md` material keeps its own upstream license in `style-polish/vendor/awesome-design-md/LICENSE`.
