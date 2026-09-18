#!/usr/bin/env node
// Standalone health check CLI: npm run health [-- --full]  (tanpa perlu MCP client)
import "dotenv/config";
import { runHealthCheck } from "./health.js";

const args = process.argv.slice(2);
const full = args.includes("--full"); // --full = termasuk video submit (bayar)
const noVideo = args.includes("--no-video");
const poll = args.includes("--poll");

const result = await runHealthCheck({
  checkImage: true,
  checkVideo: full && !noVideo ? true : args.includes("--video") ? true : full,
  pollVideo: poll,
});

// default `npm run health` = api + voices + image (hemat).
// `npm run health:full` = + video submit. `--poll` = + poll status video sekali jalan.
console.log(JSON.stringify(result, null, 2));
process.exit(result.overall === "down" ? 2 : result.overall === "degraded" ? 1 : 0);
