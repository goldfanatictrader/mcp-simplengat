#!/usr/bin/env node
import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { simplengat, SimpleNGATError } from "./client.js";
import { runHealthCheck } from "./health.js";

const server = new McpServer({
  name: "mcp-simplengat",
  version: "1.1.0",
});

function fmt(result: unknown): string {
  return JSON.stringify(result, null, 2);
}

function errText(e: unknown): string {
  if (e instanceof SimpleNGATError) {
    return `${e.message}\n${JSON.stringify(e.body, null, 2)}`;
  }
  return e instanceof Error ? e.message : String(e);
}

// ---------- 1. user/me ----------
server.tool("simplengat_user_me", "View SimpleNGAT user info (credits, role, etc). GET /api/v1/user/me", {}, async () => {
  try {
    const data = await simplengat.userMe();
    return { content: [{ type: "text" as const, text: fmt(data) }] };
  } catch (e) { return { content: [{ type: "text" as const, text: errText(e) }], isError: true }; }
});

// ---------- 2. voices ----------
server.tool("simplengat_list_voices", "List supported voices for R2V video generation. GET /api/v1/voices", {}, async () => {
  try {
    const data = await simplengat.listVoices();
    return { content: [{ type: "text" as const, text: fmt(data) }] };
  } catch (e) { return { content: [{ type: "text" as const, text: errText(e) }], isError: true }; }
});

// ---------- 3. generate image ----------
server.tool(
  "simplengat_generate_image",
  "Generate images (text-to-image or image-to-image). Nano Banana models cost 0.25 credit/image; supported premium image models cost 1 credit/image. POST /api/v1/generate/image",
  {
    prompt: z.string().describe("Description of the image you want to generate"),
    aspectRatio: z.enum(["portrait", "landscape", "16:9", "4:3", "1:1", "3:4", "9:16", "21:9", "auto"]).optional().describe("Nano Banana accepts portrait/landscape; other models accept model-specific ratios such as 16:9, 1:1, 9:16. auto requires a reference image."),
    model: z.enum([
      "nano-banana-pro",
      "nano-banana-2",
      "nano-banana-2-lite",
      "qwen-image",
      "seedream-4.0",
      "seedream-4.5",
      "seedream-5.0-lite",
      "seedream-5.0-pro",
      "kling-3.0",
      "kling-o3",
      "gpt-image-2.0",
      "gpt-image-2.5-flare",
      "gpt-image-2.5-sunburst",
    ]).optional().describe("Default nano-banana-2-lite. Nano Banana models: 0.25 credit/image; supported premium image models: 1 credit/image."),
    count: z.number().int().min(1).max(4).optional().describe("1-4 for Veo 3.1; non-Veo models including Seedance generate exactly 1."),
    referenceImages: z.array(z.string().url()).max(10).optional().describe("Reference image URLs (max 10). If provided -> image-to-image mode"),
  },
  async (args) => {
    try {
      const body: Record<string, unknown> = { prompt: args.prompt };
      if (args.aspectRatio) body.aspectRatio = args.aspectRatio;
      if (args.model) body.model = args.model;
      if (args.count) body.count = args.count;
      if (args.referenceImages) body.referenceImages = args.referenceImages;
      const data = await simplengat.generateImage(body);
      return { content: [{ type: "text" as const, text: fmt(data) }] };
    } catch (e) { return { content: [{ type: "text" as const, text: errText(e) }], isError: true }; }
  }
);

// ---------- 4. generate video ----------
server.tool(
  "simplengat_generate_video",
  "Submit video job (T2V/I2V/R2V/I2V-FL). Veo 3.1: 720p=3 credits, 1080p=5 credits. Seedance 2.0=20 credits/video flat; Seedance 2.5=30 credits/video flat. Credits are charged only on successful completion. POST /api/v1/generate/video",
  {
    prompt: z.string().describe("Video description"),
    mode: z.enum(["t2v", "i2v", "r2v", "i2v-fl"]).optional().describe("Optional; auto-detected from inputs. t2v=text-to-video, i2v=image-to-video, r2v=reference-to-video, i2v-fl=first-last-frame"),
    model: z.enum([
      "veo-3.1-lite",
      "v6",
      "v5.6",
      "v5.5",
      "v5",
      "pixverse-c1",
      "kling-o3",
      "seedance-2.5",
      "seedance-2.0",
      "sora-2",
      "wan-3.0",
      "grok",
      "flux",
      "minimax",
      "happyhorse",
      "gemini-omni-flash",
    ]).optional().describe("Default veo-3.1-lite. Seedance 2.5 costs 30 credits/video flat; Seedance 2.0 costs 20 credits/video flat. Other model pricing varies by duration/quality."),
    startImage: z.string().url().optional().describe("Required for i2v and i2v-fl"),
    endImage: z.string().url().optional().describe("Required for i2v-fl"),
    referenceImageIds: z.array(z.string()).optional().describe("Veo 3.1 only. Reference IDs for R2V when not passing referenceImages URLs"),
    referenceImages: z.array(z.string().url()).max(9).optional().describe("Reference image URLs for R2V. Seedance 2.5/2.0 support up to 9."),
    referenceVideos: z.array(z.string().url()).max(3).optional().describe("Seedance 2.5/2.0 only. Up to 3 MP4/MOV/WebM URLs, 2-15s each, max 15s combined; requires at least one image/startImage."),
    referenceAudios: z.array(z.string().url()).max(3).optional().describe("Seedance 2.5/2.0 only. Up to 3 WAV/MP3 URLs, 2-15s each, max 15s combined; requires at least one image/startImage."),
    voice: z.string().optional().describe("Optional R2V narration voice, e.g. achird. See simplengat_list_voices"),
    resolution: z.enum(["720p", "1080p"]).optional().describe("Default 720p"),
    aspectRatio: z.enum(["portrait", "landscape", "16:9", "9:16", "1:1", "3:4", "4:3", "21:9"]).optional().describe("Veo uses portrait/landscape. Seedance 2.5/2.0 support 16:9, 9:16, 1:1, 3:4, 4:3, 21:9."),
    count: z.number().int().min(1).max(4).optional().describe("1-4, default 1"),
    quality: z.string().optional().describe("Model-specific quality tier, for non-default models that support it"),
    duration: z.number().int().positive().optional().describe("Clip duration in seconds. Seedance 2.5: 5/8/10/12/15/30. Seedance 2.0: 5/8/10/12/15."),
    audio: z.boolean().optional().describe("Whether to generate native audio, for models that support it"),
  },
  async (args) => {
    try {
      if ((args.mode === "i2v" || args.mode === "i2v-fl") && !args.startImage) {
        return { content: [{ type: "text" as const, text: "startImage is required for i2v and i2v-fl modes" }], isError: true };
      }
      if (args.mode === "i2v-fl" && !args.endImage) {
        return { content: [{ type: "text" as const, text: "endImage is required for i2v-fl mode" }], isError: true };
      }
      const isSeedance = args.model === "seedance-2.5" || args.model === "seedance-2.0";
      if ((args.referenceVideos?.length || args.referenceAudios?.length) && !isSeedance) {
        return { content: [{ type: "text" as const, text: "referenceVideos/referenceAudios are supported only by seedance-2.5 and seedance-2.0" }], isError: true };
      }
      if ((args.referenceVideos?.length || args.referenceAudios?.length) && !(args.referenceImages?.length || args.startImage)) {
        return { content: [{ type: "text" as const, text: "Seedance video/audio references require at least one referenceImages URL or startImage" }], isError: true };
      }
      if (isSeedance && args.count && args.count !== 1) {
        return { content: [{ type: "text" as const, text: "Seedance generates exactly 1 video per request; count must be 1" }], isError: true };
      }
      if (isSeedance && args.quality && !["480p", "720p", "1080p"].includes(args.quality)) {
        return { content: [{ type: "text" as const, text: "Seedance quality must be 480p, 720p, or 1080p" }], isError: true };
      }
      const allowedSeedanceDurations = args.model === "seedance-2.5" ? [5, 8, 10, 12, 15, 30] : args.model === "seedance-2.0" ? [5, 8, 10, 12, 15] : null;
      if (allowedSeedanceDurations && args.duration && !allowedSeedanceDurations.includes(args.duration)) {
        return { content: [{ type: "text" as const, text: `Invalid ${args.model} duration. Allowed: ${allowedSeedanceDurations.join(", ")} seconds` }], isError: true };
      }
      const data = await simplengat.generateVideo({ ...args });
      return { content: [{ type: "text" as const, text: fmt(data) }] };
    } catch (e) { return { content: [{ type: "text" as const, text: errText(e) }], isError: true }; }
  }
);

// ---------- 5. video status ----------
server.tool(
  "simplengat_video_status",
  "Poll video generation status. For 1080p, polling triggers upscale automatically once 720p finishes. GET /api/v1/generate/video/status",
  {
    jobId: z.string().describe("Job ID from simplengat_generate_video"),
    resolution: z.string().optional().describe('Pass "1080p" if 1080p was requested'),
    upscaleJobId: z.string().optional().describe("Upscale Job ID returned during 1080p upscaling phase"),
  },
  async (args) => {
    try {
      const data = await simplengat.videoStatus(args);
      return { content: [{ type: "text" as const, text: fmt(data) }] };
    } catch (e) { return { content: [{ type: "text" as const, text: errText(e) }], isError: true }; }
  }
);

// ---------- 6. upscale image ----------
server.tool(
  "simplengat_upscale_image",
  "Upscale generated images to 2K/4K. Free for 2K; 4K VIP only. POST /api/v1/generate/image/upscale",
  {
    mediaGenerationId: z.string().describe("Media Generation ID from generate_image response"),
    resolution: z.enum(["2k", "4k"]).optional().describe("Default 2k"),
  },
  async (args) => {
    try {
      const data = await simplengat.upscaleImage({ ...args });
      return { content: [{ type: "text" as const, text: fmt(data) }] };
    } catch (e) { return { content: [{ type: "text" as const, text: errText(e) }], isError: true }; }
  }
);

// ---------- 7. delete upscaled ----------
server.tool(
  "simplengat_delete_upscaled",
  "Delete temporary upscaled file from GCS after downloading. DELETE /api/v1/generate/image/upscale?url=...",
  {
    url: z.string().url().describe("Signed GCS URL from upscale_image response"),
  },
  async (args) => {
    try {
      const data = await simplengat.deleteUpscaled(args.url);
      return { content: [{ type: "text" as const, text: fmt(data) }] };
    } catch (e) { return { content: [{ type: "text" as const, text: errText(e) }], isError: true }; }
  }
);

// ---------- 8. list models ----------
server.tool(
  "simplengat_list_models",
  "List all supported image/video models with aspect ratios, qualities, durations, and credit pricing. GET /api/v1/models",
  {},
  async () => {
    try {
      const data = await simplengat.listModels();
      return { content: [{ type: "text" as const, text: fmt(data) }] };
    } catch (e) { return { content: [{ type: "text" as const, text: errText(e) }], isError: true }; }
  }
);

// ---------- 9. motion control ----------
server.tool(
  "simplengat_motion_control",
  "Animate a character photo using motion from a reference video. v5.6 costs 3 credits; kling-2.6-pro/kling-3.0-std cost 40; kling-3.0-pro costs 50. Charged only on completion. POST /api/v1/generate/video/motion-control",
  {
    characterImage: z.string().url().describe("URL of the character photo to animate"),
    motionVideo: z.string().url().describe("URL of the reference video whose motion drives the character"),
    quality: z.enum(["360p", "540p", "720p"]).optional().describe("Default 720p for v5.6; ignored by Kling motion-control models"),
    model: z.enum(["v5.6", "kling-2.6-pro", "kling-3.0-std", "kling-3.0-pro"]).optional().describe("Default v5.6 (3 credits). Kling 2.6 Pro / 3.0 Std = 40 credits; Kling 3.0 Pro = 50 credits."),
  },
  async (args) => {
    try {
      const data = await simplengat.motionControl({ ...args });
      return { content: [{ type: "text" as const, text: fmt(data) }] };
    } catch (e) { return { content: [{ type: "text" as const, text: errText(e) }], isError: true }; }
  }
);

// ---------- 10. health check (outage/maintenance) ----------
server.tool(
  "simplengat_health_check",
  "Health check SimpleNGAT: api+voices GRATIS, image ~0.25 kredit (simple prompt, lite), video submit ~3 kredit 720p. Gunakan saat dicurigai outage/maintenance. Overall: healthy/degraded/down.",
  {
    imagePrompt: z.string().optional().describe("Default: simple red circle test"),
    videoPrompt: z.string().optional().describe("Default: static red circle test"),
    checkImage: z.boolean().optional().describe("Default true (0.25 kredit)"),
    checkVideo: z.boolean().optional().describe("Default false (hemat) — set true untuk cek video generator juga"),
    pollVideo: z.boolean().optional().describe("Default false — poll status job setelah submit"),
  },
  async (args) => {
    try {
      const data = await runHealthCheck({
        imagePrompt: args.imagePrompt,
        videoPrompt: args.videoPrompt,
        checkImage: args.checkImage ?? true,
        checkVideo: args.checkVideo ?? false,
        pollVideo: args.pollVideo ?? false,
      });
      return { content: [{ type: "text" as const, text: fmt(data) }] };
    } catch (e) { return { content: [{ type: "text" as const, text: errText(e) }], isError: true }; }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[mcp-simplengat] running on stdio");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
