#!/usr/bin/env node
import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { simplengat, SimpleNGATError } from "./client.js";
import { runHealthCheck } from "./health.js";

const server = new McpServer({
  name: "mcp-simplengat",
  version: "1.0.0",
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
  "Generate images (text-to-image or image-to-image). Models: nano-banana-pro, nano-banana-2, nano-banana-2-lite. Cost 0.25 credit/image. POST /api/v1/generate/image",
  {
    prompt: z.string().describe("Description of the image you want to generate"),
    aspectRatio: z.enum(["portrait", "landscape"]).optional().describe("Default portrait"),
    model: z.enum(["nano-banana-pro", "nano-banana-2", "nano-banana-2-lite"]).optional().describe("Default nano-banana-pro"),
    count: z.number().int().min(1).max(4).optional().describe("1-4, default 1"),
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
  "Submit video job (T2V/I2V/R2V/I2V-FL). 720p=3 credits, 1080p=5 credits (only charged on success). POST /api/v1/generate/video",
  {
    prompt: z.string().describe("Video description"),
    mode: z.enum(["t2v", "i2v", "r2v", "i2v-fl"]).describe("t2v=text-to-video, i2v=image-to-video, r2v=reference-to-video, i2v-fl=first-last-frame"),
    startImage: z.string().url().optional().describe("Required for i2v and i2v-fl"),
    endImage: z.string().url().optional().describe("Required for i2v-fl"),
    referenceImageIds: z.array(z.string()).optional().describe("Required for r2v if not passing referenceImages"),
    referenceImages: z.array(z.string().url()).optional().describe("Reference image URLs for r2v (auto-uploads)"),
    voice: z.string().optional().describe("Optional R2V narration voice, e.g. achird. See simplengat_list_voices"),
    resolution: z.enum(["720p", "1080p"]).optional().describe("Default 720p"),
    aspectRatio: z.enum(["portrait", "landscape"]).optional().describe("Default portrait"),
    count: z.number().int().min(1).max(4).optional().describe("1-4, default 1"),
  },
  async (args) => {
    try {
      if ((args.mode === "i2v" || args.mode === "i2v-fl") && !args.startImage) {
        return { content: [{ type: "text" as const, text: "startImage is required for i2v and i2v-fl modes" }], isError: true };
      }
      if (args.mode === "i2v-fl" && !args.endImage) {
        return { content: [{ type: "text" as const, text: "endImage is required for i2v-fl mode" }], isError: true };
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

// ---------- 8. health check (outage/maintenance) ----------
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
