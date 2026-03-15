import "dotenv/config";
import express from "express";
import https from "https";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { Watcher } from "./watcher.js";
import type { SSEEvent } from "./types.js";
import { execSync } from "child_process";
import { existsSync, readFileSync, writeFileSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, "viewer", "public")));

// Serve SparkJS module for 3D splat rendering
app.get("/spark.js", (_req, res) => {
  res.type("application/javascript");
  res.sendFile(join(__dirname, "..", "node_modules", "@sparkjsdev", "spark", "dist", "spark.module.min.js"));
});

// ─── SSE connections ──────────────────────────────────────────
const sseClients = new Set<express.Response>();

function broadcast(event: SSEEvent) {
  const data = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
  for (const res of sseClients) {
    res.write(data);
  }
}

// ─── Watcher instance (created on POST /api/watch) ───────────
let watcher: Watcher | null = null;

// ─── SSE endpoint ─────────────────────────────────────────────
app.get("/api/events", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });
  res.write("event: connected\ndata: {}\n\n");
  sseClients.add(res);
  req.on("close", () => sseClients.delete(res));
});

// ─── Start watching a repo ────────────────────────────────────
app.post("/api/watch", async (req, res) => {
  const { repo_url, model, chapter_count } = req.body as {
    repo_url: string;
    model?: "Marble 0.1-plus" | "Marble 0.1-mini";
    chapter_count?: number;
  };
  const numChapters = Math.max(1, Math.min(chapter_count ?? 1, 8));

  if (!repo_url) {
    res.status(400).json({ error: "repo_url required" });
    return;
  }

  const worldlabsKey = process.env.WORLDLABS_API_KEY;
  if (!worldlabsKey) {
    res.status(500).json({ error: "WORLDLABS_API_KEY not set" });
    return;
  }

  // Stop previous watcher
  watcher?.stopWatching();

  watcher = new Watcher({
    repoUrl: repo_url,
    githubToken: process.env.GITHUB_TOKEN,
    worldlabsApiKey: worldlabsKey,
    model: model ?? "Marble 0.1-mini",
  });
  watcher.onEvent(broadcast);

  res.json({ status: "initializing", repo_url });

  // Run pipeline in background
  try {
    await watcher.initialize();
    await watcher.buildChapters(numChapters);
    watcher.startWatching();
  } catch (err) {
    console.error("Pipeline error:", err);
    broadcast({
      type: "chapter_failed",
      data: {
        error: err instanceof Error ? err.message : String(err),
      },
    });
  }
});

// ─── Get current state ────────────────────────────────────────
app.get("/api/state", async (_req, res) => {
  // Active watcher takes priority
  if (watcher) {
    res.json({
      state: watcher.getState(),
      bible: watcher.getBible(),
    });
    return;
  }
  // Fall back to persisted state files from CLI runs
  try {
    const { readFile } = await import("fs/promises");
    const [stateRaw, bibleRaw] = await Promise.all([
      readFile("world-state.json", "utf-8").catch(() => null),
      readFile("story-bible.json", "utf-8").catch(() => null),
    ]);
    if (stateRaw) {
      res.json({
        state: JSON.parse(stateRaw),
        bible: bibleRaw ? JSON.parse(bibleRaw) : null,
      });
      return;
    }
  } catch {}
  res.status(404).json({ error: "No state available" });
});

// ─── Get manifest ─────────────────────────────────────────────
app.get("/api/manifest", async (_req, res) => {
  try {
    const { readFile } = await import("fs/promises");
    const raw = await readFile("manifest.json", "utf-8");
    res.json(JSON.parse(raw));
  } catch {
    res.status(404).json({ error: "No manifest yet" });
  }
});

// ─── Get world history ────────────────────────────────────────
app.get("/api/history", async (_req, res) => {
  try {
    const { loadHistory } = await import("./history.js");
    const history = await loadHistory();
    res.json(history);
  } catch {
    res.json([]);
  }
});

// ─── Explore user/org repos ───────────────────────────────────
app.post("/api/explore", async (req, res) => {
  const { owner } = req.body as { owner: string };
  if (!owner) {
    res.status(400).json({ error: "owner required" });
    return;
  }

  try {
    const { GitHubAnalyzer } = await import("./github.js");
    const gh = new GitHubAnalyzer(process.env.GITHUB_TOKEN);
    const [profile, repos] = await Promise.all([
      gh.getProfile(owner),
      gh.listRepos(owner),
    ]);
    res.json({ profile, repos });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

// ─── Get contributors for a repo ──────────────────────────────
app.post("/api/contributors", async (req, res) => {
  const { repo_url, count } = req.body as { repo_url: string; count?: number };
  if (!repo_url) {
    res.status(400).json({ error: "repo_url required" });
    return;
  }

  try {
    const { GitHubAnalyzer } = await import("./github.js");
    const gh = new GitHubAnalyzer(process.env.GITHUB_TOKEN);
    const contributors = await gh.getContributors(repo_url, count ?? 8);
    res.json({ repo_url, contributors });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

// ─── Batch generate worlds for multiple repos ─────────────────
app.post("/api/batch", async (req, res) => {
  const { repo_urls, model } = req.body as {
    repo_urls: string[];
    model?: "Marble 0.1-plus" | "Marble 0.1-mini";
  };

  if (!repo_urls?.length) {
    res.status(400).json({ error: "repo_urls required" });
    return;
  }

  const worldlabsKey = process.env.WORLDLABS_API_KEY;
  if (!worldlabsKey) {
    res.status(500).json({ error: "WORLDLABS_API_KEY not set" });
    return;
  }

  res.json({ status: "generating", count: repo_urls.length });

  // Generate each repo sequentially in background
  for (const repoUrl of repo_urls) {
    watcher?.stopWatching();

    watcher = new Watcher({
      repoUrl: repoUrl,
      githubToken: process.env.GITHUB_TOKEN,
      worldlabsApiKey: worldlabsKey,
      model: model ?? "Marble 0.1-mini",
    });
    watcher.onEvent(broadcast);

    try {
      await watcher.initialize();
      await watcher.buildChapters(1); // 1 chapter per repo for batch
    } catch (err) {
      console.error(`Batch error for ${repoUrl}:`, err);
      broadcast({
        type: "chapter_failed",
        data: {
          error: err instanceof Error ? err.message : String(err),
          repo_url: repoUrl,
        },
      });
    }
  }

  broadcast({
    type: "world_update",
    data: { status: "batch_complete", count: repo_urls.length },
  });
});

// ─── Serve viewer ─────────────────────────────────────────────
app.get("/", (_req, res) => {
  res.sendFile(join(__dirname, "viewer", "index.html"));
});

// ─── Start server ─────────────────────────────────────────────
const PORT = parseInt(process.env.PORT ?? "3000", 10);
// Find local IP
import os from "os";
const nets = os.networkInterfaces();
let localIp = "localhost";
for (const iface of Object.values(nets)) {
  for (const cfg of (iface as any[])) {
    if (cfg.family === "IPv4" && !cfg.internal) { localIp = cfg.address; break; }
  }
}

// HTTP server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n  Narrative Engine v2.0`);
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Network: http://${localIp}:${PORT}`);
});

// HTTPS server (required for WebXR on headsets)
const HTTPS_PORT = parseInt(process.env.HTTPS_PORT ?? "3443", 10);
try {
  const certDir = join(__dirname, "..");
  const keyPath = join(certDir, ".dev-key.pem");
  const certPath = join(certDir, ".dev-cert.pem");

  // Generate self-signed cert with openssl if not exists
  if (!existsSync(keyPath) || !existsSync(certPath)) {
    console.log("  Generating self-signed certificate...");
    execSync(`openssl req -x509 -newkey rsa:2048 -keyout "${keyPath}" -out "${certPath}" -days 365 -nodes -subj "/CN=${localIp}" -addext "subjectAltName=IP:${localIp},IP:127.0.0.1,DNS:localhost" 2>/dev/null`);
  }

  const key = readFileSync(keyPath);
  const cert = readFileSync(certPath);

  https.createServer({ key, cert }, app).listen(HTTPS_PORT, "0.0.0.0", () => {
    console.log(`  HTTPS:   https://${localIp}:${HTTPS_PORT}`);
    console.log(`  Pico:    Open https://${localIp}:${HTTPS_PORT} in headset browser`);
    console.log(`           (accept the self-signed cert warning)\n`);
  });
} catch (err) {
  console.log(`  HTTPS:   failed to start (${(err as Error).message})`);
  console.log(`           Install openssl or use HTTP for non-VR viewing\n`);
}
