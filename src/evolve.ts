import {
  generateNarrativePrompt,
  detectChapterType,
} from "./narrative.js";
import type { StoryBible, ChapterType } from "./types.js";

/**
 * evolve.ts — thin wrapper over narrative.ts
 *
 * All three legacy functions (generateInitialPrompt, evolvePrompt,
 * evolveFromChapter) are replaced by a single route through the
 * Story Bible narrative system.
 */

/**
 * Generate the intro/genesis world prompt.
 */
export async function generateInitialPrompt(
  bible: StoryBible,
  repoDescription: string
): Promise<string> {
  return generateNarrativePrompt(bible, 0, "genesis", repoDescription);
}

/**
 * Generate a world prompt for a new chapter based on a diff.
 */
export async function evolveFromChapter(
  bible: StoryBible,
  chapterIndex: number,
  diff: string,
  commitSummary: string
): Promise<{ prompt: string; chapterType: ChapterType }> {
  const chapterType = detectChapterType(diff, commitSummary);
  const prompt = await generateNarrativePrompt(
    bible,
    chapterIndex,
    chapterType,
    `Diff summary:\n${diff}\n\nCommit: ${commitSummary}`
  );
  return { prompt, chapterType };
}

/**
 * Generate a live-push prompt for watch mode.
 */
export async function evolveLivePush(
  bible: StoryBible,
  chapterIndex: number,
  pushContext: string
): Promise<string> {
  return generateNarrativePrompt(
    bible,
    chapterIndex,
    "live_push",
    pushContext
  );
}
