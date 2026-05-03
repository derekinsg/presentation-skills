# Animated HTML Deck Launcher Wizard

Use this spec when a host UI wants to launch `/animated-html-deck` through a structured multi-step dialog instead of a plain chat prompt.

See also: `references/launcher-design-rationale.md` for the design principles behind this flow and for guidance on when to ask, infer, defer, or preview launcher inputs.

## Goal

Reduce startup friction while still collecting useful information for deck generation. All launcher fields are optional. If the user skips them, the system should infer or default them before generation.

## Step Flow

### Step 1: Topic And Language

- `topic`
- `language`

Actions:
- Next
- Skip
- Let the system decide

### Step 2: Structure Goal

- `slide_count`
- `purpose`
- `seriousness`

Actions:
- Next
- Back
- Skip
- Let the system decide

### Step 3: Visual Direction

- `visual_style`
- `is_branded`

Actions:
- Next
- Back
- Skip
- Let the system decide

### Step 4: Presentation Mode

- `is_speaking_deck`

Actions:
- Next
- Back
- Skip
- Let the system decide

### Step 5: Inference Preview

Show:
- User-provided fields
- Inferred fields
- Defaulted fields
- Any high-risk warnings

Actions:
- Generate now
- Back and edit

## Field Semantics

- `topic`: user topic, or best inferred subject from freeform input/context
- `language`: output language
- `slide_count`: exact or best-estimate page count
- `purpose`: `speech | pitch | teaching | explanation | report | workshop | explainer`
- `seriousness`: 1-10
- `visual_style`: abstract style phrase or source-style hint
- `is_speaking_deck`: whether the deck is optimized for spoken delivery and richer notes
- `is_branded`: whether the deck should assume company / product branding follow-up

## Inference Rules

Use `scripts/normalize-launcher-payload.mjs` as the deterministic fallback layer.

- If the user leaves a field blank, the launcher may send it empty; the normalizer will infer or default it.
- Language defaults to the language of the user's latest text.
- Slide count defaults to 8 unless context strongly implies another value.
- Purpose defaults to `explainer` when no clearer intent is detectable.
- Seriousness defaults to `6`.
- Visual style defaults to `modern, clear, presentation-ready`.
- Speaking mode defaults to `true` for speech/pitch/roadshow/recording-like requests and `false` otherwise.
- Branding defaults to `true` only when company/brand/logo signals are present; otherwise `false`.

## High-Risk Cases

The launcher should allow generation even when fields are empty, but it should surface a warning when:

- No topic and no contextual text exist
- Branding is inferred but there is no company or logo detail
- Exact slide-count sensitivity is implied but no slide count is given

## Payload Contract

Emit the payload described in `launcher-payload.schema.json`.

Each structured field must carry:

- `value`
- `source`: `user_provided | inferred | defaulted`

The host UI should pass:

- the user's raw input as `raw_input`
- optional task title as `context_title`
- optional attachment/context summary as `context_summary`

## Downstream Behavior

`animated-html-deck` should:

- trust launcher payload values first
- avoid re-asking about fields already marked `user_provided`
- usually avoid re-asking fields marked `inferred/defaulted`, unless there is a high-risk warning that materially affects output quality
- call `style-polish` when `visual_style` is abstract or when a website-inspired look is requested
