import { GitHubAnalyzer } from "./github.js";
import { WorldLabsClient } from "./worldlabs.js";
import {
  analyzeRepo,
  saveStoryBible,
  loadStoryBible,
} from "./narrative.js";
import { generateInitialPrompt, evolveFromChapter, evolveLivePush } from "./evolve.js";
import { generateNarrativePrompt } from "./narrative.js";
import {
  createInitialState,
  addChapter,
  updateChapter,
  saveState,
  loadState,
} from "./state.js";
import { buildManifest, saveManifest, generateEpisodeCard } from "./manifest.js";
import { saveToHistory } from "./history.js";
import type {
  WatcherState,
  StoryBible,
  WorldEntry,
  SSEEvent,
} from "./types.js";

export type EventCallback = (event: SSEEvent) => void;

export class Watcher {
  private github: GitHubAnalyzer;
  private worldlabs: WorldLabsClient;
  private repoUrl: string;
  private state: WatcherState;
  private bible: StoryBible | null = null;
  private listeners: EventCallback[] = [];
  private polling = false;
  private pollIntervalMs: number;
  private model: "Marble 0.1-plus" | "Marble 0.1-mini";

  constructor(opts: {
    repoUrl: string;
    githubToken?: string;
    worldlabsApiKey: string;
    pollIntervalMs?: number;
    model?: "Marble 0.1-plus" | "Marble 0.1-mini";
  }) {
    this.repoUrl = opts.repoUrl;
    this.github = new GitHubAnalyzer(opts.githubToken);
    this.worldlabs = new WorldLabsClient(opts.worldlabsApiKey);
    this.state = createInitialState(opts.repoUrl);
    this.pollIntervalMs = opts.pollIntervalMs ?? 60_000;
    this.model = opts.model ?? "Marble 0.1-mini";
  }

  onEvent(cb: EventCallback) {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  private emit(event: SSEEvent) {
    for (const cb of this.listeners) cb(event);
  }

  /**
   * Initialize: load or create Story Bible, then generate genesis world.
   */
  async initialize(): Promise<StoryBible> {
    // Try loading existing state
    const existingState = await loadState();
    if (existingState && existingState.repo_url === this.repoUrl) {
      this.state = existingState;
    }

    // Try loading existing bible
    this.bible = await loadStoryBible();
    if (this.bible) {
      this.state = { ...this.state, story_bible: this.bible };
      console.log(`\n  Story Bible loaded: "${this.bible.world_name}"\n`);
      this.emit({ type: "story_bible", data: this.bible });
      return this.bible;
    }

    // Generate new Story Bible
    console.log("\n  Analyzing repository...\n");
    const [context, commits] = await Promise.all([
      this.github.analyzeRepo(this.repoUrl),
      this.github.getCommits(this.repoUrl),
    ]);

    console.log("  Generating Story Bible...\n");
    this.bible = await analyzeRepo(context, this.repoUrl, commits);
    await saveStoryBible(this.bible);

    this.state = { ...this.state, story_bible: this.bible };
    await saveState(this.state);

    console.log(`  World: "${this.bible.world_name}"`);
    console.log(`  Genre: ${this.bible.genre} / ${this.bible.subgenre}`);
    console.log(`  Metaphor: ${this.bible.core_metaphor}`);
    console.log(`  Chapters: ${this.bible.chapter_titles.join(" → ")}\n`);

    this.emit({ type: "story_bible", data: this.bible });
    return this.bible;
  }

  /**
   * Build the genesis (intro) world.
   */
  async buildGenesis(): Promise<WorldEntry> {
    if (!this.bible) throw new Error("Story Bible not initialized");

    const repoDesc = `${this.bible.repo_identity.name}: ${this.bible.repo_identity.purpose}. Tech: ${this.bible.repo_identity.tech_stack.join(", ")}. ${this.bible.repo_identity.size_class} project.`;

    console.log("  Generating genesis world prompt...\n");
    const prompt = await generateInitialPrompt(this.bible, repoDesc);
    console.log(`  Prompt: ${prompt.slice(0, 120)}...\n`);

    const episodeTitle = this.bible.chapter_titles[0] ?? "Genesis";

    this.state = addChapter(this.state, {
      chapter_type: "genesis",
      episode_title: episodeTitle,
      prompt,
      world_id: null,
      spz_url: null,
      pano_url: null,
      collider_url: null,
      thumbnail_url: null,
      marble_url: null,
      operation_id: null,
      status: "pending",
      commit_sha: await this.github.getLatestSha(this.repoUrl),
      diff_summary: null,
    });
    await saveState(this.state);

    const chapterIdx = this.state.chapters.length - 1;
    this.emit({
      type: "chapter_start",
      data: { index: chapterIdx, title: episodeTitle, type: "genesis" },
    });

    return this.buildWorld(chapterIdx);
  }

  /**
   * Build multiple chapters sequentially.
   * Chapter 1 = genesis, chapters 2+ use the Story Bible narrative arc.
   */
  async buildChapters(count: number): Promise<void> {
    if (!this.bible) throw new Error("Story Bible not initialized");

    // Chapter 1: genesis
    await this.buildGenesis();

    // Chapters 2+: map to narrative arc phases
    const arcTypes: Array<import("./types.js").ChapterType> = [
      "growth", "growth", "crisis", "resolution", "maturity", "maturity", "maturity",
    ];

    for (let i = 1; i < count; i++) {
      const chapterType = arcTypes[Math.min(i - 1, arcTypes.length - 1)];
      const episodeTitle = this.bible.chapter_titles[i] ?? `Chapter ${i + 1}`;
      const arcKey = chapterType as keyof typeof this.bible.narrative_arc;
      const arcDesc = this.bible.narrative_arc[arcKey] ?? "";

      console.log(`\n  Generating Chapter ${i + 1}: "${episodeTitle}" (${chapterType})...\n`);
      const prompt = await generateNarrativePrompt(
        this.bible,
        i,
        chapterType,
        `Narrative arc phase: ${chapterType}. ${arcDesc}. This is chapter ${i + 1} of ${count} in the story of ${this.bible.world_name}.`
      );
      console.log(`  Prompt: ${prompt.slice(0, 120)}...\n`);

      this.state = addChapter(this.state, {
        chapter_type: chapterType,
        episode_title: episodeTitle,
        prompt,
        world_id: null,
        spz_url: null,
        pano_url: null,
        collider_url: null,
        thumbnail_url: null,
        marble_url: null,
        operation_id: null,
        status: "pending",
        commit_sha: this.state.last_commit_sha,
        diff_summary: `${chapterType} phase — ${arcDesc.slice(0, 200)}`,
      });
      await saveState(this.state);

      const chapterIdx = this.state.chapters.length - 1;
      this.emit({
        type: "chapter_start",
        data: { index: chapterIdx, title: episodeTitle, type: chapterType },
      });

      await this.buildWorld(chapterIdx);
    }

    console.log(`\n  All ${count} chapters complete.\n`);
  }

  /**
   * Build a world for a specific chapter.
   */
  async buildWorld(chapterIndex: number): Promise<WorldEntry> {
    if (!this.bible) throw new Error("Story Bible not initialized");
    const chapter = this.state.chapters[chapterIndex];
    if (!chapter) throw new Error(`No chapter at index ${chapterIndex}`);

    // Update status
    this.state = updateChapter(this.state, chapterIndex, {
      status: "generating",
    });
    await saveState(this.state);

    try {
      console.log(
        `  Building world for Chapter ${chapterIndex + 1}: "${chapter.episode_title}"...`
      );

      const displayName = `${this.bible.world_name} — ${chapter.episode_title}`;
      const { world } = await this.worldlabs.generateAndWait(
        displayName,
        chapter.prompt,
        this.model
      );

      // Use world_id (API field) falling back to id
      const worldId = (world as unknown as Record<string, unknown>).world_id as string ?? world.id;

      // Re-fetch world to get canonical/stable asset URLs
      let finalWorld = world;
      try {
        finalWorld = await this.worldlabs.getWorld(worldId);
      } catch {
        // Use the operation response if re-fetch fails
      }

      const assets = finalWorld.assets ?? world.assets;
      const update: Partial<WorldEntry> = {
        status: "ready",
        world_id: worldId,
        spz_url: assets.splats.spz_urls.full_res,
        pano_url: assets.imagery.pano_url,
        collider_url: assets.mesh.collider_mesh_url,
        thumbnail_url: assets.thumbnail_url,
        marble_url: finalWorld.world_marble_url ?? world.world_marble_url,
      };

      this.state = updateChapter(this.state, chapterIndex, update);
      await saveState(this.state);

      // Build and save manifest + history
      const manifest = buildManifest(this.state, this.bible);
      await saveManifest(manifest);
      await saveToHistory(this.state, this.bible);

      const card = generateEpisodeCard(
        this.state.chapters[chapterIndex],
        this.bible
      );

      console.log(`  World ready: ${world.world_marble_url}`);
      console.log(
        `  SPZ: ${world.assets.splats.spz_urls.full_res}\n`
      );

      this.emit({
        type: "chapter_ready",
        data: {
          index: chapterIndex,
          world_id: world.id,
          marble_url: world.world_marble_url,
          card,
        },
      });

      return this.state.chapters[chapterIndex];
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  World generation failed: ${message}\n`);

      this.state = updateChapter(this.state, chapterIndex, {
        status: "failed",
      });
      await saveState(this.state);

      this.emit({
        type: "chapter_failed",
        data: { index: chapterIndex, error: message },
      });

      return this.state.chapters[chapterIndex];
    }
  }

  /**
   * Check for new commits and generate a new chapter if found.
   */
  async checkForUpdates(): Promise<WorldEntry | null> {
    if (!this.bible) return null;

    const latestSha = await this.github.getLatestSha(this.repoUrl);
    if (latestSha === this.state.last_commit_sha) return null;

    console.log(`  New commits detected (${latestSha.slice(0, 7)})...\n`);

    const diff = this.state.last_commit_sha
      ? await this.github.getDiff(
          this.repoUrl,
          this.state.last_commit_sha,
          latestSha
        )
      : "Initial state";

    const chapterIndex = this.state.chapters.length;
    const { prompt, chapterType } = await evolveFromChapter(
      this.bible,
      chapterIndex,
      diff,
      `Latest commit: ${latestSha.slice(0, 7)}`
    );

    const episodeTitle =
      this.bible.chapter_titles[chapterIndex] ??
      `Chapter ${chapterIndex + 1}`;

    this.state = addChapter(this.state, {
      chapter_type: chapterType,
      episode_title: episodeTitle,
      prompt,
      world_id: null,
      spz_url: null,
      pano_url: null,
      collider_url: null,
      thumbnail_url: null,
      marble_url: null,
      operation_id: null,
      status: "pending",
      commit_sha: latestSha,
      diff_summary: diff.slice(0, 500),
    });

    this.state = { ...this.state, last_commit_sha: latestSha };
    await saveState(this.state);

    this.emit({
      type: "chapter_start",
      data: { index: chapterIndex, title: episodeTitle, type: chapterType },
    });

    return this.buildWorld(chapterIndex);
  }

  /**
   * Start polling for changes.
   */
  async startWatching(): Promise<void> {
    this.polling = true;
    console.log(
      `  Watching ${this.repoUrl} (every ${this.pollIntervalMs / 1000}s)...\n`
    );

    while (this.polling) {
      try {
        await this.checkForUpdates();
      } catch (err) {
        console.error(
          "  Poll error:",
          err instanceof Error ? err.message : err
        );
      }
      await new Promise((r) => setTimeout(r, this.pollIntervalMs));
    }
  }

  stopWatching() {
    this.polling = false;
  }

  getState(): WatcherState {
    return this.state;
  }

  getBible(): StoryBible | null {
    return this.bible;
  }
}
