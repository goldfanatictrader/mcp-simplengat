# MCP Server SimpleNGAT

MCP Server (stdio) untuk [SimpleNGAT API v1](https://simplengat.com/api-docs) — generate image & video dari Claude Code / OpenCode / custom agent.

Base URL: `https://simplengat.com/api/v1` | Auth: `Bearer SIMPLENGAT_API_KEY` | Rate limit: `100 req/min`

## 1. Setup

```bash
cd /root/mcp-simplengat
npm install
cp .env.example .env
# isi SIMPLENGAT_API_KEY (https://simplengat.com/dashboard/api-settings)
nano .env
npm run build
```

## 2. Jalankan

```bash
npm start
```

## 3. Tools (8)

| Tool | Endpoint | Deskripsi |
|------|----------|-----------|
| `simplengat_user_me` | `GET /user/me` | Info user, credits, role |
| `simplengat_list_voices` | `GET /voices` | Daftar voice R2V |
| `simplengat_generate_image` | `POST /generate/image` | T2I / I2I, Nano Banana Pro/2/2-Lite, 0.25 kredit/gambar, `count` 1-4, `referenceImages` max 10 |
| `simplengat_generate_video` | `POST /generate/video` | T2V/I2V/R2V/I2V-FL, 720p=3 kredit, 1080p=5 kredit (hangus hanya jika sukses) |
| `simplengat_video_status` | `GET /generate/video/status?jobId=` | Poll status; 1080p auto-trigger upscale |
| `simplengat_upscale_image` | `POST /generate/image/upscale` | Upscale 2K (free) / 4K (VIP) |
| `simplengat_delete_upscaled` | `DELETE /generate/image/upscale?url=` | Hapus file upscale sementara |
| `simplengat_health_check` | gabungan | Deteksi outage/maintenance, lihat §6 |

Contoh generate video:
- T2V: `{ prompt, mode: "t2v" }`
- I2V: `{ prompt, mode: "i2v", startImage: "https://..." }`
- R2V: `{ prompt, mode: "r2v", referenceImages: ["https://..."], voice: "achird" }`
- I2V-FL: `{ prompt, mode: "i2v-fl", startImage, endImage, resolution: "1080p", count: 4 }`

## 4. Pakai di Claude Code / OpenCode

`~/.claude.json` atau `~/.config/opencode/opencode.json`:

```json
{
  "mcp": {
    "simplengat": {
      "type": "local",
      "command": ["node", "/root/mcp-simplengat/dist/index.js"],
      "enabled": true,
      "environment": { "SIMPLENGAT_API_KEY": "sk_..." }
    }
  }
}
```

Claude Code CLI:

```bash
claude mcp add simplengat -- node /root/mcp-simplengat/dist/index.js
```

## 5. Error codes

401 key salah/hilang, 402 kredit habis, 403 akun tanpa role API, 429 rate limit, 500 internal.

## 6. Health check (outage / maintenance)

Simple prompt, hemat kredit:

- `npm run health` — api + voices (GRATIS) + image 1x `nano-banana-2-lite` (~0.25 kredit)
- `npm run health:full` — ditambah video T2V 720p submit (~3 kredit, hanya jika sukses)
- `npm run health:poll` — full + poll status job video

Via MCP: `simplengat_health_check` (`checkVideo: true` untuk ikut cek video, `pollVideo: true` untuk poll).

Output: `overall: healthy | degraded | down` + `latencyMs` per cek + klasifikasi:
`api` gagal = kemungkinan outage/maintenance; generator gagal tapi api hidup = gangguan parsial.

## 7. License

MIT — lihat `LICENSE`.
