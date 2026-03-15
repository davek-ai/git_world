import { writeFile } from "fs/promises";
import type {
  WatcherState,
  StoryBible,
  Manifest,
  ManifestChapter,
  EpisodeCard,
  WorldEntry,
} from "./types.js";

const MANIFEST_PATH = "manifest.json";

export function buildManifest(
  state: WatcherState,
  bible: StoryBible
): Manifest {
  const chapters: ManifestChapter[] = state.chapters.map((ch) => ({
    index: ch.chapter_index,
    title: ch.episode_title,
    type: ch.chapter_type,
    spz_url: ch.spz_url,
    pano_url: ch.pano_url,
    collider_url: ch.collider_url,
    marble_url: ch.marble_url,
    thumbnail_url: ch.thumbnail_url,
    status: ch.status,
  }));

  return {
    repo_url: state.repo_url,
    world_name: bible.world_name,
    genre: bible.genre,
    tagline: bible.tagline,
    total_chapters: chapters.length,
    chapters,
    created_at: bible.created_at,
    updated_at: new Date().toISOString(),
  };
}

export async function saveManifest(manifest: Manifest): Promise<void> {
  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

export function generateEpisodeCard(
  entry: WorldEntry,
  bible: StoryBible
): EpisodeCard {
  return {
    world_name: bible.world_name,
    episode_title: entry.episode_title,
    chapter_number: entry.chapter_index + 1,
    chapter_type: entry.chapter_type,
    genre: bible.genre,
    thumbnail_url: entry.thumbnail_url,
    marble_url: entry.marble_url,
    tagline: bible.tagline,
    prompt_excerpt:
      entry.prompt.length > 200
        ? entry.prompt.slice(0, 197) + "..."
        : entry.prompt,
  };
}
