# SimpleNGAT MCP

SimpleNGAT now provides an official hosted MCP server for Claude, ChatGPT, Cursor, Codex, Gemini CLI, VS Code, Windsurf, Antigravity, and other MCP-compatible agents.

## Official hosted MCP — primary

**MCP URL**

```text
https://simplengat.com/api/mcp
```

The hosted MCP is the production source of truth. It supports OAuth/login for interactive clients and API-key based access for agents/scripts that cannot open a browser.

Unauthenticated discovery correctly advertises the OAuth protected-resource metadata for `https://simplengat.com/api/mcp`.

### Official tools

| Tool | Purpose |
|---|---|
| `list_models` | Models, supported options, and prices |
| `get_credit_balance` | Current credits and membership |
| `generate_image` | Generate images from text or reference images |
| `generate_video` | Start a video generation job |
| `upscale_video` | Upscale a generated video to 4K |
| `generate_music` | Generate a song from a description |
| `list_speech_voices` | Search available text-to-speech voices |
| `generate_speech` | Generate speech audio as MP3 |
| `get_job_status` | Poll video, upscale, or music generation jobs |
| `list_gallery` | List recent generated images and videos |

Always call `list_models` before expensive generation work when model availability, options, duration, or pricing matters.

A minimal agent workflow is:

```text
list_models
→ get_credit_balance
→ generate_image / generate_video / generate_music / generate_speech
→ get_job_status (for async jobs)
→ list_gallery when recent outputs need to be recovered
```

## This repository — local/dev fallback

This repository contains a local stdio MCP adapter for SimpleNGAT REST API v1 plus reusable agent workflow skills. It is useful for development, local scripting, tests, custom agents, and environments that cannot use the hosted OAuth MCP directly.

It is **not** the production hosted MCP implementation and should not be deployed as a replacement for `https://simplengat.com/api/mcp`.

Base REST URL: `https://simplengat.com/api/v1`

### Setup local fallback

```bash
git clone https://github.com/goldfanatictrader/mcp-simplengat.git
cd mcp-simplengat
npm install
cp .env.example .env
# Add SIMPLENGAT_API_KEY from the SimpleNGAT dashboard
npm run build
npm start
```

### Local fallback tools

The local adapter currently exposes REST-oriented compatibility tools including:

- `simplengat_user_me`
- `simplengat_list_voices`
- `simplengat_generate_image`
- `simplengat_generate_video`
- `simplengat_video_status`
- `simplengat_upscale_image`
- `simplengat_delete_upscaled`
- `simplengat_list_models`
- `simplengat_motion_control`
- `simplengat_health_check`

For new agent workflows, prefer the official hosted tool names whenever the hosted MCP is connected.

## Seedance and multimodal references

The local fallback includes support for the newer Seedance video contract, including:

- Seedance 2.5
- Seedance 2.0
- image references
- video references
- audio references
- Seedance aspect ratios
- duration validation
- model discovery through `/models`

Example local fallback request:

```json
{
  "model": "seedance-2.5",
  "mode": "r2v",
  "prompt": "@Image1 performs to @Audio1...",
  "referenceImages": ["https://..."],
  "referenceAudios": ["https://...mp3"],
  "aspectRatio": "16:9",
  "quality": "1080p",
  "duration": 15,
  "audio": true
}
```

Do not assume the local adapter's historical limits or pricing are authoritative. Prefer `list_models` from the official hosted MCP for current capability and pricing discovery.

## Agent workflow skill

Use:

```text
skills/simplengat-creative-engine/SKILL.md
```

The skill teaches agents how to use SimpleNGAT as a headless creative-production engine, including:

- model discovery and budget checks
- semantic `@references`
- identity and continuity locks
- music-video audio/lyrics segmentation
- prompt compilation
- model routing
- paid-generation safety
- async job polling
- QA
- retry/repair
- lipsync strategy
- timeline assembly
- cost control

The official hosted MCP tools are the preferred execution surface. The local adapter is a fallback.

## Music-video reference workflow

For music-video projects such as **Terbang Bersamaku**, the recommended sequence is:

```text
list_models
→ get_credit_balance
→ register/prepare character references
→ analyze song structure + lyrics
→ split audio by phrase/model limit
→ compile @Image / @Audio references
→ generate_video
→ get_job_status
→ QA identity / hands / instruments / lipsync / continuity
→ retry or repair only failed dimensions
→ assemble selected clips against the original master audio
```

For visible singing, include the exact lyric line matching the attached audio segment. For full-band/wide shots, the master mix is usually the better performance reference. The original master song remains the authoritative final soundtrack.

## Health check for local fallback

```bash
npm run health
npm run health:full
npm run health:poll
```

These commands exercise the REST/local adapter. They are separate from the official hosted MCP health/auth flow.

## Media handling

`skills/tempuploader/SKILL.md` documents the temporary image-reference uploader used by some local workflows. It is not the official SimpleNGAT MCP server and should not be confused with the hosted MCP.

Avoid committing runtime media, generated project assets, `.env`, logs, local project databases, or temporary reference files to this repository.

## License

MIT — see `LICENSE`.
