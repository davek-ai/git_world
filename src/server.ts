import "dotenv/config";
import express from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { Watcher } from "./watcher.js";
import type { SSEEvent } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, "viewer", "public")));

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

// ─── Serve viewer ─────────────────────────────────────────────
app.get("/", (_req, res) => {
  res.sendFile(join(__dirname, "viewer", "index.html"));
});

// ─── Start server ─────────────────────────────────────────────
const PORT = parseInt(process.env.PORT ?? "3000", 10);
app.listen(PORT, () => {
  console.log(`\n  Narrative Engine v2.0`);
  console.log(`  Server: http://localhost:${PORT}`);
  console.log(`  SSE:    http://localhost:${PORT}/api/events`);
  console.log(`  Viewer: http://localhost:${PORT}\n`);
});
