import "dotenv/config";
import { Watcher } from "./watcher.js";

const args = process.argv.slice(2);
const command = args[0];
const repoUrl = args[1] ?? process.env.REPO_URL;

if (!repoUrl && command !== "help") {
  console.error("Usage: narrative-engine <watch|generate> <github-url>");
  process.exit(1);
}

const worldlabsKey = process.env.WORLDLABS_API_KEY;
if (!worldlabsKey) {
  console.error("Set WORLDLABS_API_KEY in environment");
  process.exit(1);
}

// Parse --chapters N
const chaptersIdx = args.indexOf("--chapters");
const numChapters = chaptersIdx >= 0 ? Math.max(1, Math.min(parseInt(args[chaptersIdx + 1]) || 1, 8)) : 1;

const watcher = new Watcher({
  repoUrl: repoUrl!,
  githubToken: process.env.GITHUB_TOKEN,
  worldlabsApiKey: worldlabsKey,
  model: (args.includes("--plus") ? "Marble 0.1-plus" : "Marble 0.1-mini"),
});

watcher.onEvent((event) => {
  if (event.type === "story_bible") {
    console.log("\n━━━ Story Bible ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(JSON.stringify(event.data, null, 2));
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  }
  if (event.type === "chapter_ready") {
    const d = event.data as Record<string, unknown>;
    console.log(`\n  ✓ Chapter ready: ${(d.card as Record<string, unknown>)?.episode_title}`);
    console.log(`    Marble: ${d.marble_url}\n`);
  }
});

async function run() {
  console.log("\n  Narrative Engine v2.0\n");

  await watcher.initialize();

  if (command === "generate") {
    await watcher.buildChapters(numChapters);
    console.log(`\n  ${numChapters} chapter(s) complete.\n`);
  } else if (command === "watch") {
    await watcher.buildChapters(numChapters);
    await watcher.startWatching();
  } else {
    console.log("Commands: generate, watch");
  }
}

run().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
