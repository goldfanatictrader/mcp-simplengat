---
name: tempuploader
description: Temporary image uploader via Cloudflare Worker + R2. Public REST API tanpa API key, per-file TTL, delete publik, validasi 5MB image-only. Gunakan saat upload, serve, info, hapus, atau deploy ulang tempuploader.
---

# tempuploader — Temporary Image Uploader Skill

Worker: `tempuploader` → `https://tempuploader.surya16.workers.dev`
Bucket R2: `omnia-user-uploads-temp` (binding `BUCKET`)
Repo lokal: `/root/tempuploader` (`src/index.js`, `wrangler.jsonc`)

Aturan utama:
- Media image/video/audio tidak boleh disimpan di MCP.
- Upload image hanya ke endpoint tempuploader.
- Publik tanpa API key; jangan membuat endpoint list.
- Maksimum 5MB; hanya jpg/png/webp/gif dengan validasi magic bytes.
- TTL default 86400 detik, minimum 60, maksimum 604800.
## API

Base: `https://tempuploader.surya16.workers.dev`

### Upload image

```bash
curl -F "file=@foto.png" -F "expiresIn=3600" https://tempuploader.surya16.workers.dev/upload
```

Response berisi `url`, `infoUrl`, `deleteUrl`, `expiresIn`, dan `expiresAt`.

### Serve dan info

```bash
curl -o out.png https://tempuploader.surya16.workers.dev/i/<id>
curl https://tempuploader.surya16.workers.dev/info/<id>
```

GET yang sudah expired mengembalikan 410 dan menghapus object secara async.

### Delete publik

```bash
curl -X DELETE https://tempuploader.surya16.workers.dev/i/<id>
```

Delete bersifat publik; siapa pun yang mengetahui ID dapat menghapus file.
## Integrasi dengan MCP SimpleNGAT

SimpleNGAT hanya menyimpan metadata dan URL eksternal. Jangan menulis media ke:
- `output/`
- `projects/*/assets/`
- `projects/*/outputs/`
- `temp-upload-*`

Untuk image reference, upload lebih dulu ke tempuploader lalu kirim `j.url` ke SimpleNGAT. Untuk video/audio, gunakan URL eksternal yang sudah tersedia; tempuploader ini image-only.

Contoh browser:

```js
const fd = new FormData();
fd.append("file", file);
fd.append("expiresIn", "86400");
const response = await fetch("https://tempuploader.surya16.workers.dev/upload", {
  method: "POST", body: fd
});
const result = await response.json();
const imageUrl = result.url;
```
## Operasi dan verifikasi

```bash
cd /root/tempuploader
npm install
npx wrangler deploy --dry-run --cwd /root/tempuploader
npx wrangler deploy --cwd /root/tempuploader
npx wrangler tail --cwd /root/tempuploader
```

Jangan menjalankan wrangler dari `/root` tanpa `--cwd`.

Verifikasi:

```bash
W=https://tempuploader.surya16.workers.dev
curl -s "$W/health"
curl -s -F "file=@test.png" -F "expiresIn=3600" "$W/upload"
```

Cron `0 * * * *` membersihkan object expired. Tidak ada endpoint list publik.
