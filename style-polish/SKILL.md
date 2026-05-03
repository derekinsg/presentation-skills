---
name: style-polish
description: Resolve a website-inspired or abstract visual direction into a reusable design decision package for HTML/UI work. Use when Codex needs to turn a style reference like Vercel, Linear, Stripe, Apple, Airbnb, or a phrase like "high-end developer tool" into a normalized source style, layout family, token set, suitability guidance, and translation notes that downstream generators such as HTML decks, landing pages, dashboards, or reports can consume.
---

# Style Polish

## Overview

Use this skill to turn broad design taste into a stable, reusable style decision. The skill reads the vendored `awesome-design-md` library, uses the generated `styles/style-catalog.json`, and returns one resolved style package instead of vague adjectives.

This skill is medium-agnostic. It can support PPT, web UI, generic HTML, and document-like layouts. It does not generate a full product by itself; it chooses and explains the design system that another generator should consume.

## Inputs

- `style`: optional source style id such as `vercel`, `linear.app`, `stripe`, `apple`, `airbnb`, or an abstract description such as "high-end developer tool".
- `medium`: `ppt`, `web`, `doc`, or `generic-html`.
- `purpose`: `launch`, `report`, `teaching`, `pitch`, `explainer`, or similar.
- `seriousness`: preferred seriousness level, ideally `1-10`.

Infer missing fields when safe. If the user does not name a source style, choose one from the catalog and say which one you chose.

## Workflow

1. Read `styles/style-catalog.json` first.
2. If the user named a specific site, resolve it exactly when possible.
3. If the user gave only mood words, read `references/style-selection-guide.md`, then use `scripts/resolve-style-theme.mjs` or the catalog itself to choose the best source style.
4. Output one resolved style package with:
   - `sourceStyleId`
   - `displayName`
   - `layoutFamily`
   - `runtimeTemplateFallback`
   - `tokens`
   - `suitability`
   - `translationGuidance`
5. Keep the translation grounded: preserve palette, typography bias, and surface treatment, but adapt the source site to the target medium. Do not mechanically reproduce homepage chrome or navigation patterns.

## Output Rules

- Choose one source style unless the user explicitly asks for comparisons.
- Produce one resolved theme package that a downstream generator can inject into its template.
- Do not embed the full style catalog into downstream output.
- If the chosen source style is weak for dense reporting or chart-heavy material, keep the source palette and typography cues but shift layout toward `executive-report` or `consulting-report`.
- If the user asks for multiple variants, resolve each variant separately rather than averaging them together.

## Resource Use

- `styles/style-catalog.json`: primary source of normalized style data.
- `references/style-selection-guide.md`: use when the style request is ambiguous or medium-sensitive.
- `vendor/awesome-design-md/design-md/`: read the specific source style's `DESIGN.md` when you need more nuance than the catalog summary provides.
- `scripts/build-style-catalog.mjs`: rebuild the normalized catalog after updating the vendored style library.
- `scripts/resolve-style-theme.mjs`: deterministically resolve a style request into a single theme package for downstream consumers.

## Example Prompts

```text
Use $style-polish to resolve a style for a PPT about an AI product launch. I want it to feel like Vercel, seriousness 6/10.
```

```text
Use $style-polish to choose a style for a strategy report. The vibe should feel like a high-end developer tool, but readable in a boardroom.
```

```text
Use $style-polish for a landing page hero. I want something close to Airbnb warmth, but a bit more professional.
```
