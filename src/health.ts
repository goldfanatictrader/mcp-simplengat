import { simplengat, SimpleNGATError } from "./client.js";

export type HealthStatus = "ok" | "fail";
export type OverallStatus = "healthy" | "degraded" | "down";

export interface CheckResult {
  name: string;
  status: HealthStatus;
  latencyMs: number;
  // outage / maintenance detection hints
  httpStatus?: number;
  detail?: string;
  creditsUsed?: number;
  // video-specific
  jobId?: string;
  jobStatus?: string;
}

export interface HealthOptions {
  /** simple prompt for image generator (default hemat, 1 gambar lite) */
  imagePrompt?: string;
  /** simple prompt for video generator */
  videoPrompt?: string;
  /** cek image generator beneran (kena 0.25 kredit). default true */
  checkImage?: boolean;
  /** cek video generator beneran (kena 3 kredit 720p jika submit sukses). default true */
  checkVideo?: boolean;
  /** poll status video setelah submit (default false — submit OK sudah cukup untuk deteksi outage) */
  pollVideo?: boolean;
  /** max poll video (ms). default 60_000 */
  pollTimeoutMs?: number;
  /** timeout per-request (ms). default 30_000 */
  timeoutMs?: number;
}

const DEFAULT_IMAGE_PROMPT = "health check: simple red circle on plain white background, flat vector";
const DEFAULT_VIDEO_PROMPT = "health check: static red circle on white background, no motion, 1 second";

async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let t: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    t = setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms (possible outage/maintenance)`)), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    clearTimeout(t!);
  }
}

function classifyError(e: unknown): { httpStatus?: number; detail: string } {
  if (e instanceof SimpleNGATError) {
    // 500 / network = kemungkinan outage atau maintenance
    const hint =
      e.status === 500 ? " (kemungkinan outage/maintenance di sisi SimpleNGAT)"
      : e.status === 429 ? " (rate limit, bukan outage)"
      : e.status === 402 ? " (kredit habis, API-nya hidup)"
      : e.status === 401 ? " (API key salah/hilang, API-nya hidup)"
      : e.status === 403 ? " (akun tanpa role API, API-nya hidup)"
      : "";
    return { httpStatus: e.status, detail: `${e.message}${hint} :: ${JSON.stringify(e.body)?.slice(0, 500)}` };
  }
  const msg = e instanceof Error ? e.message : String(e);
  // fetch TypeError = network/DNS = outage atau maintenance
  const hint = /fetch failed|ECONN|ENOTFOUND|timeout/i.test(msg) ? " (network/timeout — kemungkinan outage/maintenance)" : "";
  return { detail: `${msg}${hint}` };
}

async function runCheck(name: string, fn: () => Promise<unknown>, timeoutMs: number): Promise<CheckResult> {
  const start = Date.now();
  try {
    const data = await withTimeout(fn(), timeoutMs, name);
    const d = data as Record<string, unknown>;
    return {
      name,
      status: "ok",
      latencyMs: Date.now() - start,
      detail: JSON.stringify(d)?.slice(0, 500),
      creditsUsed: typeof d?.["creditsUsed"] === "number" ? (d["creditsUsed"] as number) : undefined,
    };
  } catch (e) {
    const c = classifyError(e);
    return { name, status: "fail", latencyMs: Date.now() - start, ...c };
  }
}

export async function runHealthCheck(opts: HealthOptions = {}) {
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const imagePrompt = opts.imagePrompt ?? DEFAULT_IMAGE_PROMPT;
  const videoPrompt = opts.videoPrompt ?? DEFAULT_VIDEO_PROMPT;
  const doImage = opts.checkImage ?? true;
  const doVideo = opts.checkVideo ?? true;
  const pollVideo = opts.pollVideo ?? false;
  const pollTimeoutMs = opts.pollTimeoutMs ?? 60_000;

  const startedAt = new Date().toISOString();
  const checks: CheckResult[] = [];

  // 1. API dasar — GRATIS, selalu jalan. Kalau ini fail -> kemungkinan besar outage/maintenance.
  checks.push(await runCheck("api", () => simplengat.userMe(), timeoutMs));

  // 2. Voices — GRATIS. Validasi routing /voices masih hidup.
  checks.push(await runCheck("voices", () => simplengat.listVoices(), timeoutMs));

  // 3. Image generator — BAYAR 0.25 kredit. Simple prompt, model lite biar murah & cepat.
  if (doImage) {
    checks.push(
      await runCheck(
        "image_generator",
        () => simplengat.generateImage({ prompt: imagePrompt, model: "nano-banana-2-lite", aspectRatio: "portrait", count: 1 }),
        timeoutMs
      )
    );
  }

  // 4. Video generator — BAYAR 3 kredit (720p) hanya jika submit sukses.
  // Submit job (T2V, 720p, portrait, count 1) = simple prompt, paling murah.
  if (doVideo) {
    const submit = await runCheck(
      "video_generator_submit",
      () => simplengat.generateVideo({ prompt: videoPrompt, mode: "t2v", resolution: "720p", aspectRatio: "portrait", count: 1 }),
      timeoutMs
    );
    checks.push(submit);

    // Opsional: poll sekali untuk tahu job masuk antrean / processing / completed.
    // Tidak wajib — submit "created" saja sudah membuktikan generator nerima job (bukan outage).
    if (pollVideo && submit.status === "ok") {
      const body = JSON.parse(submit.detail ?? "{}") as { jobId?: string };
      const jobId = body.jobId;
      if (jobId) {
        const deadline = Date.now() + pollTimeoutMs;
        let last: CheckResult = { name: "video_generator_status", status: "fail", latencyMs: 0, detail: "no poll yet" };
        while (Date.now() < deadline) {
          last = await runCheck("video_generator_status", () => simplengat.videoStatus({ jobId }), timeoutMs);
          try {
            const s = JSON.parse(last.detail ?? "{}") as { status?: string };
            if (s.status === "completed" || s.status === "failed") break;
          } catch { /* keep polling on unparseable */ }
          if (last.status === "fail") break;
          await new Promise((r) => setTimeout(r, 5000));
        }
        const enriched: CheckResult = { ...last, jobId };
        try {
          const s = JSON.parse(last.detail ?? "{}") as { status?: string };
          if (s.status) enriched.jobStatus = s.status;
        } catch { /* ignore */ }
        checks.push(enriched);
      }
    }
  }

  const failed = checks.filter((c) => c.status === "fail").map((c) => c.name);
  // api fail = down (kemungkinan outage/maintenance). generator fail tapi api ok = degraded.
  const apiFailed = failed.includes("api");
  const overall: OverallStatus = failed.length === 0 ? "healthy" : apiFailed ? "down" : "degraded";

  return {
    tool: "simplengat_health_check",
    overall,
    startedAt,
    summary:
      overall === "healthy"
        ? "Semua endpoint respons OK — tidak terdeteksi outage/maintenance."
        : overall === "down"
          ? "API dasar (user/me) gagal — kemungkinan outage/maintenance SimpleNGAT atau network. Cek https://simplengat.com dan coba lagi 1-2 menit."
          : `Sebagian gagal (${failed.join(", ")}) tapi API dasar hidup — kemungkinan gangguan parsial di generator terkait, bukan full outage.`,
    checks,
    costNote: "quick (api+voices) = GRATIS. image check = ~0.25 kredit. video submit = ~3 kredit (720p, hanya jika sukses).",
  };
}
