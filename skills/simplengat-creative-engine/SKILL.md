---
name: simplengat-creative-engine
description: Headless creative-production workflow for SimpleNGAT. Use when an agent must turn songs, lyrics, characters, products, references, or creative briefs into consistent image/video generations across multiple models. Covers project setup, semantic @references, identity/continuity locking, audio slicing, music-video planning, prompt compilation, model routing, paid generation, QA, retry/repair, lipsync, timeline assembly, and export. No UI is required.
---

# SimpleNGAT Creative Engine

SimpleNGAT is a headless creative engine. ChatGPT/MCP/API is the interface. Do not design or depend on a dashboard, canvas, or timeline UI unless explicitly requested.

## Official MCP execution surface

Prefer the official hosted MCP at `https://simplengat.com/api/mcp` whenever it is connected. Treat it as the production source of truth.

Current hosted tools:

- `list_models` — discover models, options, and prices
- `get_credit_balance` — read credits and membership
- `generate_image` — generate images from a prompt or references
- `generate_video` — submit a video generation
- `upscale_video` — upscale a generated video to 4K
- `generate_music` — generate a song/music asset
- `list_speech_voices` — search available TTS voices
- `generate_speech` — generate speech as MP3
- `get_job_status` — poll video, upscale, or music jobs
- `list_gallery` — recover/list recent generated images and videos

Before material paid work, call `list_models` and `get_credit_balance`. Do not rely on stale hard-coded pricing or model limits when the hosted tools are available.

For async work, submit once, preserve the job ID, and poll with `get_job_status` until a terminal state. Never blindly resubmit an ambiguous paid mutation.

The Node MCP contained in this repository is a local/dev compatibility adapter over REST API v1. It is not the hosted production MCP. If local fallback behavior conflicts with the official hosted MCP, hosted `list_models` and hosted tool behavior are authoritative.

## Core execution model

Use this order for substantial creative jobs:

1. Create or resolve the project.
2. Register source assets.
3. Build semantic references and continuity locks.
4. Analyze the brief/audio/lyrics before generation.
5. Build a shot or asset plan.
6. Compile semantic references into provider-specific references.
7. Route each shot to the most suitable supported model.
8. Submit paid jobs once and preserve job IDs.
9. Poll async jobs with `get_job_status` until terminal state when using the official MCP.
10. Run QA against the intended identity, continuity, physics, lipsync, and shot brief.
11. Retry or repair only failed criteria.
12. Select takes and build a timeline/sequence manifest.
13. Render/export only after coverage and continuity pass.

Never jump directly from a vague user brief to a large batch of paid generations.

## Headless project state

Treat every production as persistent structured state, not a loose conversation.

Recommended project layout:

```text
/project
  /characters
  /wardrobe
  /locations
  /products
  /audio
  /stems
  /shots
  /generations
  /selected-takes
  /final
  project.json
  continuity.json
  timeline.json
```

Persist enough metadata to reproduce every selected output: source references, semantic aliases, prompt, provider/model, mode, duration, resolution, aspect ratio, audio/reference mapping, job ID, cost, status, QA result, and selected/rejected state.

## Semantic @reference layer

Users and agents should reason with semantic references instead of numeric provider slots whenever possible.

Examples:

```text
@Sastra
@Adam
@Raya
@Stage_Main
@MasterSong
@Song_000_015
@Product_Main
```

The compiler maps semantic aliases to provider inputs for each generation. Example:

```text
@Sastra       -> referenceImages[0] / @Image1
@Adam         -> referenceImages[1] / @Image2
@Raya         -> referenceImages[2] / @Image3
@Song_000_015 -> referenceAudios[0] / @Audio1
```

When a model family uses `@Image1`, `@Audio1`, or similar prompt tokens, the prompt MUST explicitly mention the corresponding token and its role. Supplying an array without mentioning the asset in the prompt is not considered a fully compiled reference workflow.

Example:

```text
@Image1 is Sastra, lead vocalist and guitarist. Preserve exact identity, face, hair, body proportions, wardrobe, and guitar role.
@Image2 is Adam, bassist. Preserve exact identity, glasses, wardrobe, body proportions, and bass role.
@Image3 is Raya, drummer. Preserve exact identity, face, hair, wardrobe, body proportions, and drum role.
@Audio1 is the exact performance reference. Follow its timing, tempo, phrasing, beat accents, and performance energy.
```

Do not rely only on prose descriptions of a referenced person's appearance when a locked image reference exists.

## Reference upload rules

Image references:
- Preserve original bytes whenever possible.
- Do not resize, recompress, screenshot, OCR, or base64-reencode merely to move an image between environments.
- Preferred flow: ChatGPT attachment -> raw file transfer -> Desktop Commander host -> tempuploader -> public URL -> SimpleNGAT.
- `tempuploader` is image-only.

Audio/video references:
- Preserve original bytes.
- Do not send audio/video to the image-only tempuploader.
- Use a raw media host, object storage, or provider-compatible public URL.
- Record checksum and byte size when moving source media so transfer integrity can be verified.

Generated outputs are not reference-upload inputs unless the workflow explicitly promotes them into the continuity registry.

## Identity and continuity lock

For recurring real or fictional people, establish an identity lock before batch video generation.

Minimum identity package:
- clean face reference
- multi-angle or character sheet where possible
- body/proportion reference where relevant
- wardrobe lock
- role/instrument lock for performers
- distinctive accessories such as glasses

For a band or cast, store one semantic identity per person and one group continuity definition.

Do not silently change wardrobe, hairstyle, instrument, product variant, location palette, or lighting language between shots after continuity is locked.

## Music Video Studio workflow

Use this workflow when the input includes a finished song or performance track.

### 1. Ingest

Required when available:
- master audio
- lyrics
- character references
- roles/instruments
- visual direction

Optional:
- stems
- location references
- wardrobe references
- storyboard or desired narrative

### 2. Analyze audio before generation

Determine:
- total duration
- major sections: intro, verse, pre-chorus, chorus, bridge, instrumental, outro
- lyric phrase boundaries
- energy changes
- beat/phrase landmarks that should drive cuts

Prefer phrase-aware segments over arbitrary fixed windows.

### 3. Respect provider audio limits

Read the live SimpleNGAT model/API capability before slicing.

If the SimpleNGAT wrapper currently limits a reference-audio file to 15 seconds, do not send a 30-second file even if the underlying upstream model documentation supports 30 seconds. The active gateway contract is authoritative for execution.

Build overlapping segments only when continuity or phrase completion requires it. Record source start/end time for every segment.

### 4. Choose shot duration by content

Typical guidance:
- vocal close/medium close: 8-12 seconds
- full-band performance: 10-15 seconds
- chorus hero: 12-15 seconds
- instrument/detail cutaway: 5-8 seconds
- longer durations only when motion complexity and identity drift risk are acceptable

A model supporting 30 seconds does not imply every shot should be 30 seconds.

### 5. Use exact lyrics for visible vocal performance

When the singer's mouth is clearly visible, include only the exact lyric text that belongs to the attached audio segment.

Example:

```text
@Image1 sings exactly:
"Kau lelah menahan semua
Dunia terlalu berat"

Match mouth movement, syllable timing, emotion, and phrasing to @Audio1.
```

Do not paste lyrics from a different timestamp.

### 6. Reference mapping for a band-performance shot

Example three-person performance compile:

```text
@Image1 = lead vocal + guitar
@Image2 = bass
@Image3 = drums
@Audio1 = exact master or stem segment for this shot
```

The prompt must state each role explicitly and direct performance timing from `@Audio1`.

### 7. Master vs stem strategy

Use the master mix for wide/full-band shots.

For singer close-ups, prefer the vocal stem when available if it improves phoneme/lipsync clarity.

For instrument-specific motion work, a corresponding stem may be useful, but do not assume the provider will infer perfect instrumental fingering solely from audio.

### 8. Generated audio is not the final soundtrack

The final music video timeline uses the original master song as the authoritative soundtrack. Generated clip audio may guide performance or lipsync but should not replace the master unless the user explicitly wants regenerated audio.

## Prompt compiler

Build prompts from structured fields, not ad-hoc prose.

Recommended components:

```text
REFERENCE MAP
IDENTITY LOCKS
SHOT PURPOSE
PERFORMANCE / SUBJECT ACTION
LYRIC OR SPOKEN TEXT
CAMERA
BLOCKING
LIGHTING
LOCATION
CONTINUITY RULES
PHYSICS / PRODUCT RULES
NEGATIVE CONSTRAINTS
AUDIO BEHAVIOR
```

For complex reference models, explicit reference mapping comes first.

Avoid contradictory camera directions. One shot should have one primary camera idea unless the model is intentionally asked for a multi-cut clip and is known to handle it reliably.

## Model routing

Always read the live model catalog before paid execution.

Route based on required capability, not brand preference:
- identity/reference count
- image/video/audio references
- lipsync/performance behavior
- max duration
- output quality
- aspect ratio
- cost
- speed
- known physics/continuity behavior

Do not silently switch to a substantially more expensive model.

If SimpleNGAT has both a cheap bulk-generation model and a higher-cost specialist, use the cheaper model for coverage and the specialist only for hero shots or repair when justified.

## Paid generation safety

Before a paid call, validate:
- model exists in live catalog
- reference URLs are reachable
- required references are present
- prompt mentions provider `@reference` tokens where required
- duration is supported
- audio segment complies with gateway limits
- aspect ratio/resolution are supported
- expected credit cost is acceptable

Submit a paid mutation once. Preserve returned job ID.

If the request times out after submission, treat state as ambiguous and reconcile the existing job before retrying. Never blindly duplicate a paid POST.

## Polling

Poll the returned job ID with `get_job_status` until a terminal state when using the official MCP. Do not tell the user a generation is complete while status is `started`, `queued`, `processing`, or equivalent.

When completed, persist:
- output URL
- provider/model
- job ID
- actual credit cost
- remaining balance when available
- generation prompt and references

## QA rubric

Evaluate a generated clip before accepting it.

For human performance:
- identity/face drift
- hairstyle/accessory drift
- wardrobe continuity
- body proportion consistency
- hand/finger integrity
- instrument continuity
- instrument-playing plausibility
- drum-stick and impact physics
- lipsync accuracy when required
- blocking continuity
- camera stability
- lighting/location continuity

For products:
- exact product geometry
- branding/text consistency
- color/SKU consistency
- no autonomous object motion
- no spontaneous duplication/disappearance
- believable contact and gravity

Reject a take if a critical lock fails even if the clip is visually attractive.

## Retry and repair policy

Do not regenerate blindly.

Classify failure first:
- identity
- hands/physics
- instrument/product continuity
- lipsync
- camera
- lighting/location
- prompt mismatch
- provider failure

Then repair only the failed dimension.

Examples:
- good performance, bad lipsync -> lipsync repair, not full regeneration
- correct identity, bad drum physics -> regenerate drummer-focused shot or shorten duration
- good shot, inconsistent grade -> finishing/color repair
- repeated provider weakness -> route that shot to another supported model

Keep accepted elements locked during repair.

## Lipsync workflow

Use lipsync only where visible mouth precision matters.

Do not spend lipsync resources on:
- wide shots where the mouth is not readable
- drummer-only shots
- bassist/guitarist detail shots without visible singing
- silhouettes
- instrumental sections

For vocal close-ups:
1. generate or select the best identity/performance take
2. apply the exact vocal/master segment
3. lipsync repair
4. QA phoneme timing and identity preservation
5. place repaired clip back on the master timeline

## Timeline assembly

A timeline manifest should reference selected takes and the original master audio.

Each timeline item should include:
- start/end time on song timeline
- selected generation ID/output URL
- source audio segment
- shot role
- transition/cut type if needed
- QA status

Avoid making the video generator responsible for the entire music-video edit. Beat-accurate final cuts belong in timeline assembly/editing.

## Cost control

Track budget per project and per shot.

Reserve retry capacity. Do not spend the entire balance on first-pass coverage.

For example, if 44 generations are affordable, a safer plan may be roughly 28-32 intended shots/takes plus the remaining capacity for retries, repairs, or hero alternatives.

## Agent behavior

When the user says "kerjakan", execute the workflow with available tools instead of returning only a prompt.

When execution is impossible because a required mutation or binary-transfer tool is unavailable, state the exact blocker. Do not claim a generation occurred.

Do not substitute a T2V pilot when the user explicitly requires character and audio references. That is a different experiment and must be labeled as such before spending credits.

Do not repeatedly ask for information already registered in project state.

## MVP API surface

The headless engine should converge toward primitives such as:

```text
project_create
project_upload_asset
identity_create
identity_add_reference
identity_generate_sheet
identity_lock
audio_analyze
audio_split
lyrics_align
stem_extract
cinema_create_profile
location_create
wardrobe_create
music_video_plan
music_video_generate_shot
music_video_retry_shot
music_video_generate_sequence
lipsync_apply
video_edit
video_to_video
qa_face
qa_hands
qa_instrument
qa_lipsync
qa_continuity
timeline_build
timeline_render
upscale_video
project_export
```

The user should not need to manually orchestrate these primitives for common workflows. A higher-level operation such as `music_video_generate` should call them internally while preserving inspectable project state.

## First reference implementation

Use the current real-artist band project "Terbang Bersamaku" as the first reference implementation of the Music Video Studio workflow: real identities, generated band performance, semantic character references, phrase-aligned audio slices, exact lyrics for vocal shots, QA/retry, and master-audio timeline assembly.
