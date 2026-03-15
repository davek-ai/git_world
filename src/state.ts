import { readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import type { WatcherState, WorldEntry, ChapterType } from "./types.js";

const STATE_PATH = "world-state.json";

export function createInitialState(repoUrl: string): WatcherState {
  return {
    repo_url: repoUrl,
    story_bible: null,
    chapters: [],
    current_chapter: -1,
    last_commit_sha: null,
    updated_at: new Date().toISOString(),
  };
}

export function addChapter(
  state: WatcherState,
  entry: Omit<WorldEntry, "chapter_index" | "created_at">
): WatcherState {
  const chapter: WorldEntry = {
    ...entry,
    chapter_index: state.chapters.length,
    created_at: new Date().toISOString(),
  };
  return {
    ...state,
    chapters: [...state.chapters, chapter],
    current_chapter: chapter.chapter_index,
    updated_at: new Date().toISOString(),
  };
}

export function updateChapter(
  state: WatcherState,
  index: number,
  update: Partial<WorldEntry>
): WatcherState {
  const chapters = [...state.chapters];
  chapters[index] = { ...chapters[index], ...update };
  return { ...state, chapters, updated_at: new Date().toISOString() };
}

export async function saveState(state: WatcherState): Promise<void> {
  await writeFile(STATE_PATH, JSON.stringify(state, null, 2));
}

export async function loadState(): Promise<WatcherState | null> {
  if (!existsSync(STATE_PATH)) return null;
  const raw = await readFile(STATE_PATH, "utf-8");
  return JSON.parse(raw);
}
