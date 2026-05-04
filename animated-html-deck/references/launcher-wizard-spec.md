# Awesome Presentation Launcher Wizard

Use this spec when a host UI wants to launch `/awesome-presentation` through a structured multi-step dialog instead of a plain chat prompt.

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

### Step 5: Speaker Script Guidance

- `needs_speaker_script`
- `talk_duration_minutes`
- `speaker_script_style`
- `notes_detail`
- `include_delivery_cues`

Suggested Chinese style options:
- 正式汇报
- 路演说服
- 产品发布
- 培训讲解
- 轻松幽默

Actions:
- Next
- Back
- Skip
- Let the system decide

### Step 6: Inference Preview

Show:
- User-provided fields
- Inferred fields
- Defaulted fields
- Any high-risk warnings
- Whether the request still needs clarification before planning

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
- `needs_speaker_script`: whether to write per-slide 演讲稿 / 口播稿 / speaker notes
- `talk_duration_minutes`: intended talk length when slide count is not enough
- `speaker_script_style`: `formal-briefing | roadshow-persuasion | product-launch | training-explanation | warm-humor | balanced-presentation`
- `notes_detail`: `concise | standard | detailed`
- `include_delivery_cues`: whether notes include pause, emphasis, pacing, gesture, and transition cues

## Inference Rules

Use `scripts/normalize-launcher-payload.mjs` as the deterministic fallback layer.

- If the user leaves a field blank, the launcher may send it empty; the normalizer will infer or default it.
- If the raw input is a low-information request such as "帮我做个 PPT", the normalizer should mark `needs_clarification: true` and `clarification_mode: single_modal_brief_intake`; the host or agent should show one clickable brief modal before generation.
- The single-modal intake may contain up to 10 questions. The default uses 8 questions: topic/source, source file status, purpose, audience, length, style/seriousness, speaker notes, and output mode.
- Language defaults to the language of the user's latest text.
- Slide count defaults to 8 unless context strongly implies another value.
- Purpose defaults to `explainer` when no clearer intent is detectable.
- Seriousness defaults to `6`.
- Visual style defaults to `modern, clear, presentation-ready`.
- Speaking mode defaults to `true` for speech/pitch/roadshow/recording-like requests and `false` otherwise.
- Speaker script guidance defaults to on for speaking decks, with 60-90 seconds of notes per content slide, transitions, memory points, and delivery cues unless the user asks for concise notes.
- Branding defaults to `true` only when company/brand/logo signals are present; otherwise `false`.

## High-Risk Cases

The launcher should allow generation even when fields are empty, but it should surface a warning when:

- No topic and no contextual text exist
- The user asked only for a generic PPT/deck/presentation without a real topic, purpose, audience, or source material
- Branding is inferred but there is no company or logo detail
- Exact slide-count sensitivity is implied but no slide count is given
- A speaking context is detected but speaker script style, talk duration, notes detail, or delivery cue needs are not specified

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

`awesome-presentation` should:

- trust launcher payload values first
- avoid re-asking about fields already marked `user_provided`
- usually avoid re-asking fields marked `inferred/defaulted`, unless there is a high-risk warning that materially affects output quality
- ask the single-modal brief intake before planning when `needs_clarification` is true
- surface speaker script defaults or ask one follow-up when `speaker_script_guidance.requires_followup` is true
- call `style-polish` when `visual_style` is abstract or when a website-inspired look is requested
