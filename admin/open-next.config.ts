import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Minimal config: no R2-backed incremental cache override yet — that needs
// an R2 bucket provisioned in the Cloudflare dashboard first. Without it,
// ISR/revalidation falls back to OpenNext's default in-memory cache (fine
// for an admin panel that's mostly dynamic/server-rendered, not a
// heavily-revalidated static site).
export default defineCloudflareConfig();
