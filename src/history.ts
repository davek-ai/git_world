import { readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import type { StoryBible, WatcherState } from "./types.js";

const HISTORY_PATH = "world-history.json";

export interface HistoryEntry {
  repo_url: string;
  world_name: string;
  genre: string;
  tagline: string;
  created_at: string;
  chapters: Array<{
    title: string;
    type: string;
    marble_url: string | null;
    pano_url: string | null;
    thumbnail_url: string | null;
    status: string;
  }>;
}

export async function loadHistory(): Promise<HistoryEntry[]> {
  if (!existsSync(HISTORY_PATH)) return [];
  const raw = await readFile(HISTORY_PATH, "utf-8");
  return JSON.parse(raw);
}

export async function saveToHistory(
  state: WatcherState,
  bible: StoryBible
): Promise<void> {
  const history = await loadHistory();

  // Remove existing entry for this repo if present
  const filtered = history.filter((h) => h.repo_url !== state.repo_url);

  const entry: HistoryEntry = {
    repo_url: state.repo_url,
    world_name: bible.world_name,
    genre: bible.genre,
    tagline: bible.tagline,
    created_at: bible.created_at,
    chapters: state.chapters.map((ch) => ({
      title: ch.episode_title,
      type: ch.chapter_type,
      marble_url: ch.marble_url,
      pano_url: ch.pano_url,
      thumbnail_url: ch.thumbnail_url,
      status: ch.status,
    })),
  };

  filtered.unshift(entry); // newest first
  await writeFile(HISTORY_PATH, JSON.stringify(filtered, null, 2));
}
