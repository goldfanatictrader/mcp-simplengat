const BASE_URL = process.env.SIMPLENGAT_BASE_URL?.replace(/\/$/, "") || "https://simplengat.com/api/v1";

function apiKey(): string {
  const key = process.env.SIMPLENGAT_API_KEY;
  if (!key) throw new Error("SIMPLENGAT_API_KEY is not set. Get one at https://simplengat.com/dashboard/api-settings");
  return key;
}

export class SimpleNGATError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

function friendlyError(status: number): string {
  switch (status) {
    case 401: return "API key invalid or missing (401)";
    case 402: return "Insufficient credits (402)";
    case 403: return "Account does not have the API role (403)";
    case 429: return "Rate limit exceeded, max 100/min (429)";
    case 500: return "SimpleNGAT internal server error (500)";
    default: return `SimpleNGAT request failed (HTTP ${status})`;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Authorization": `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let data: unknown = text;
  try { data = text ? JSON.parse(text) : null; } catch { /* keep raw text */ }
  if (!res.ok) throw new SimpleNGATError(res.status, friendlyError(res.status), data);
  return data as T;
}

export const simplengat = {
  userMe: () => request("/user/me"),
  listVoices: () => request("/voices"),
  listModels: () => request("/models"),
  motionControl: (body: Record<string, unknown>) =>
    request("/generate/video/motion-control", { method: "POST", body: JSON.stringify(body) }),
  generateImage: (body: Record<string, unknown>) =>
    request("/generate/image", { method: "POST", body: JSON.stringify(body) }),
  generateVideo: (body: Record<string, unknown>) =>
    request("/generate/video", { method: "POST", body: JSON.stringify(body) }),
  videoStatus: (params: { jobId: string; resolution?: string; upscaleJobId?: string }) => {
    const qs = new URLSearchParams({ jobId: params.jobId });
    if (params.resolution) qs.set("resolution", params.resolution);
    if (params.upscaleJobId) qs.set("upscaleJobId", params.upscaleJobId);
    return request(`/generate/video/status?${qs.toString()}`);
  },
  upscaleImage: (body: Record<string, unknown>) =>
    request("/generate/image/upscale", { method: "POST", body: JSON.stringify(body) }),
  deleteUpscaled: (url: string) =>
    request(`/generate/image/upscale?url=${encodeURIComponent(url)}`, { method: "DELETE" }),
};
