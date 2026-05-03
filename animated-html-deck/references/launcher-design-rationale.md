# Animated HTML Deck Launcher Design Rationale

This note explains why the `/animated-html-deck` launcher is designed as a low-friction, inference-friendly intake flow instead of a rigid form or a fully automatic black box.

It is written for two audiences:

- host UI implementers who need a clear mental model for the launcher
- skill maintainers who need to know which inputs should be asked early, inferred quietly, or deferred

## Core Principles

### 1. Scaffolding

Users often know they need "a PPT" before they know the exact topic, structure, or narrative. The launcher should therefore break an intimidating blank state into a few small prompts that are easy to answer.

In practice, that means asking for only the minimum shape of the deck first:

- what the topic is
- what kind of deck it is
- how many slides it should roughly have
- whether it is meant to be spoken aloud

This reduces the cost of starting.

### 2. Progressive Disclosure

Not every session needs every detail up front. A user should not have to answer branding, presenter, motion, image, and export questions before the system even knows what the deck is about.

So the launcher should reveal detail in layers:

- first, basic deck intent
- then, structural and visual direction
- then, optional presentation or export details

This keeps the first step light while still allowing more precise output later.

### 3. Mixed-Initiative Interaction

The launcher is intentionally neither "the user must fill everything" nor "the model guesses everything." It is a mixed-initiative flow:

- the user provides what they know
- the system infers what is safe to infer
- the preview step makes those assumptions visible before generation

This is why the launcher payload distinguishes source types such as:

- `user_provided`
- `inferred`
- `defaulted`

Those markers are not implementation noise. They are the contract that lets the skill avoid redundant follow-up questions while still surfacing meaningful uncertainty.

### 4. Cognitive Load Control

Deck generation asks for many possible inputs: topic, audience, purpose, style, slide count, images, notes, presenter mode, and more. Asking for all of them at once increases abandonment and lowers answer quality.

The launcher is therefore optimized to lower working-memory pressure:

- fields are optional
- smart defaults exist
- inference is preferred over interrogation
- preview is used to correct assumptions instead of forcing precision too early

## Product Rules That Follow From Those Principles

These principles translate into a few concrete rules.

### All fields should be skippable

Optional fields reduce startup friction. If a user only knows the rough topic, they should still be able to begin.

### Preview is a correction layer, not a punishment layer

The user should see what the system inferred or defaulted, but the preview exists to help them steer the result, not to block them with form validation.

### Ask only what materially improves the deck

The first screen should not ask for downstream details like phone presenter, image mode, or polish archetype unless those details are central to the request.

### Downstream specialists stay downstream

The launcher should not front-load every specialized decision:

- `style-polish` is for visual style resolution
- `speaker-polish` is for speaking-note rewriting
- presenter and LAN sync are output behaviors, not first-step identity questions

The launcher should collect just enough information to know when those systems are needed.

## Why The Current Launcher Looks The Way It Does

The current launcher flow starts with topic and language, then moves to structure and visual direction, then to speaking mode, then preview. That ordering is intentional:

- topic anchors everything else
- structure and purpose influence slide count, density, and tone
- speaking mode influences notes depth and presenter behavior
- preview catches inference errors before generation

The current contract does not yet require a separate discovery payload layer. If a host UI later adds a pre-launch discovery step for vague or blank requests, it should still follow the same design rules in this document: short prompts, optional answers, visible inference, and low blocking.

## Anti-Patterns To Avoid

The launcher should avoid these failure modes:

- a giant first-screen form with 15 or more fields
- forcing users to answer every missing field before continuing
- generating a generic deck from an empty request without showing assumptions
- asking style, notes, export, and presenter questions before the core topic is clear
- pushing specialized choices upstream when they belong to `style-polish` or `speaker-polish`

## How To Use This Document

Use this rationale together with:

- `references/launcher-wizard-spec.md` for the concrete wizard flow
- `references/launcher-payload.schema.json` for the payload contract
- `scripts/normalize-launcher-payload.mjs` for deterministic inference and defaults

If those implementation artifacts evolve, update this rationale only when the launcher's design intent changes, not for every field-level tweak.
