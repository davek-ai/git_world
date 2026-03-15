import Anthropic from "@anthropic-ai/sdk";
import { readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import type {
  StoryBible,
  ChapterType,
  RepoContext,
  CommitInfo,
} from "./types.js";

const STORY_BIBLE_PATH = "story-bible.json";

const STORY_BIBLE_SYSTEM_PROMPT = `You are a world-building AI that translates software repositories into cinematic 3D worlds.

You will receive a complete repository analysis — its tech stack, structure, commit history, README, and metadata. Your job is to produce a Story Bible: a persistent narrative document that defines the visual universe of this repository.

## Process
1. UNDERSTAND the technical reality: what the repo does, who built it, how large it is, what technologies it uses
2. TRANSLATE that into a narrative world design document

## Genre Assignment
Assign a primary genre based on domain + stack + aesthetic signals:
- "noir" — security, auth, encryption, detective/mystery feel
- "solarpunk" — green tech, sustainability, data viz, optimistic futures
- "brutalist" — infrastructure, devops, databases, raw concrete power
- "cyberpunk" — AI/ML, neural nets, bleeding edge, neon-lit
- "cathedral" — compilers, languages, foundational libraries, vaulted grandeur
- "frontier" — new frameworks, experimental, uncharted territory
- "deep_sea" — data pipelines, streaming, deep processing
- "orbital" — cloud, distributed systems, satellite-view scale
- "mythic" — game engines, creative tools, legendary forge
- "industrial" — build tools, CI/CD, factory-precision

## Easter Egg Types
Include 2-3 easter eggs using these types:
- "recurring_object" — appears in every chapter, subtle but consistent
- "evolving_detail" — changes meaning as the world evolves
- "hidden_symbol" — references something in the actual codebase
- "environmental_echo" — the environment reacts to code changes

## Chapter Titles
Generate 6-8 chapter titles that read as episode titles. They should follow the narrative arc from genesis through maturity.

## Output
Return ONLY valid JSON matching the StoryBible schema. No markdown wrapping. No commentary.

{
  "world_name": "string — proper noun, evocative, memorable",
  "tagline": "string — one line, cinematic",
  "genre": "string — from genre table",
  "subgenre": "string — specific flavor",
  "core_metaphor": "string — the precise metaphor that translates any diff into world changes",
  "visual_palette": {
    "primary": "string — hex color",
    "secondary": "string — hex color",
    "accent": "string — hex color",
    "lighting": "string — lighting description",
    "atmosphere": "string — atmospheric description"
  },
  "material_vocabulary": ["string — 4-6 material/texture keywords"],
  "narrative_arc": {
    "genesis": "string — how the world looks at first commit",
    "growth": "string — how it evolves during feature development",
    "crisis": "string — how it looks during major refactors/breaking changes",
    "resolution": "string — how it recovers",
    "maturity": "string — the world at stable release"
  },
  "chapter_titles": ["string — 6-8 episode titles"],
  "easter_eggs": [{ "type": "string", "name": "string", "description": "string", "first_appearance": "string", "evolution_rule": "string" }],
  "repo_identity": {
    "name": "string",
    "purpose": "string",
    "tech_stack": ["string"],
    "size_class": "string — micro|small|medium|large|monorepo",
    "primary_language": "string"
  },
  "created_at": "string — ISO 8601"
}`;

const NARRATIVE_PROMPT_SYSTEM = `You are a cinematic world prompt writer. You translate code changes into vivid 3D world descriptions for WorldLabs Marble generation.

You will receive:
1. A Story Bible defining the universe, genre, palette, metaphor, and easter eggs
2. A chapter type (genesis, growth, crisis, resolution, maturity, live_push)
3. Context: either a repo overview (for genesis) or a diff summary (for subsequent chapters)

## Rules
- Write 180-220 words of vivid, spatial world description
- Use the Story Bible's genre, palette, materials, and lighting grammar
- Include at least one easter egg from the Story Bible (subtle, not named explicitly)
- The description must be a PHYSICAL PLACE — describe architecture, terrain, lighting, materials, atmosphere
- Do NOT mention code, files, commits, or programming concepts — translate everything into the world metaphor
- Each chapter type has a distinct register:
  - genesis: vast, empty, potential-filled, atmospheric, the stage before the story
  - growth: expanding, busy, scaffolding rising, new structures appearing
  - crisis: cracking, splitting, dramatic lighting, tension in materials
  - resolution: healing, new connections, light breaking through
  - maturity: settled, grand, weathered but strong, lived-in
  - live_push: dynamic, flickering, real-time energy, things in motion

## Output
Return ONLY the world description text. No JSON wrapping. No commentary. Just the vivid scene description.`;

export async function analyzeRepo(
  repoContext: RepoContext,
  repoUrl: string,
  commits: CommitInfo[]
): Promise<StoryBible> {
  const client = new Anthropic();

  const userPrompt = `## Repository Analysis

**URL:** ${repoUrl}
**Name:** ${repoContext.name}
**Description:** ${repoContext.description ?? "none"}
**Primary Language:** ${repoContext.language ?? "unknown"}
**Languages:** ${JSON.stringify(repoContext.languages)}
**Topics:** ${repoContext.topics.join(", ") || "none"}
**Stars:** ${repoContext.stars} | **Forks:** ${repoContext.forks} | **Size:** ${repoContext.size}KB

## Directory Structure
${repoContext.tree_summary}

## README (excerpt)
${repoContext.readme_excerpt}

## Package/Config
${repoContext.package_json ? JSON.stringify(repoContext.package_json, null, 2).slice(0, 1500) : "(not a JS project)"}

## Commit History (${commits.length} commits, newest first)
${commits
  .slice(0, 30)
  .map(
    (c) =>
      `[${c.date}] ${c.author}: ${c.message.split("\n")[0]} (+${c.additions}/-${c.deletions}, ${c.files_changed} files)`
  )
  .join("\n")}

Generate the Story Bible for this repository.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1200,
    system: STORY_BIBLE_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  // Parse JSON — handle potential markdown wrapping
  const jsonStr = text.replace(/^```json?\n?/, "").replace(/\n?```$/, "");
  const bible: StoryBible = JSON.parse(jsonStr);
  bible.created_at = new Date().toISOString();

  return bible;
}

export function generateNarrativePrompt(
  bible: StoryBible,
  chapterIndex: number,
  chapterType: ChapterType,
  context: string
): Promise<string> {
  const client = new Anthropic();

  const chapterTitle =
    bible.chapter_titles[chapterIndex] ??
    `Chapter ${chapterIndex + 1}`;

  const userPrompt = `## Story Bible
**World:** ${bible.world_name}
**Genre:** ${bible.genre} / ${bible.subgenre}
**Core Metaphor:** ${bible.core_metaphor}
**Palette:** primary ${bible.visual_palette.primary}, secondary ${bible.visual_palette.secondary}, accent ${bible.visual_palette.accent}
**Lighting:** ${bible.visual_palette.lighting}
**Atmosphere:** ${bible.visual_palette.atmosphere}
**Materials:** ${bible.material_vocabulary.join(", ")}

**Narrative Arc:**
- Genesis: ${bible.narrative_arc.genesis}
- Growth: ${bible.narrative_arc.growth}
- Crisis: ${bible.narrative_arc.crisis}
- Resolution: ${bible.narrative_arc.resolution}
- Maturity: ${bible.narrative_arc.maturity}

**Easter Eggs:**
${bible.easter_eggs.map((e) => `- ${e.name}: ${e.description} (${e.evolution_rule})`).join("\n")}

## This Chapter
**Chapter ${chapterIndex + 1}:** "${chapterTitle}"
**Type:** ${chapterType}

## Context
${context}

Write the world description for this chapter.`;

  return client.messages
    .create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 400,
      system: NARRATIVE_PROMPT_SYSTEM,
      messages: [{ role: "user", content: userPrompt }],
    })
    .then((r) => (r.content[0].type === "text" ? r.content[0].text : ""));
}

export function detectChapterType(
  diff: string,
  summary: string
): ChapterType {
  const lower = (diff + " " + summary).toLowerCase();

  // Large deletions → crisis
  const delMatch = lower.match(/[-](\d+)/g);
  const totalDel = delMatch
    ? delMatch.reduce((s, m) => s + parseInt(m.replace("-", "")), 0)
    : 0;
  if (totalDel > 500) return "crisis";

  // New directories → growth
  if (/new file|create|added.*dir/i.test(lower)) return "growth";

  // Fix/bug/patch → resolution
  if (/fix|bug|patch|hotfix|resolve/i.test(lower)) return "resolution";

  // Refactor/rewrite/breaking → crisis
  if (/refactor|rewrite|breaking|deprecat/i.test(lower)) return "crisis";

  // Release/stable/v\d → maturity
  if (/release|stable|v\d+\.\d+/i.test(lower)) return "maturity";

  return "growth";
}

export async function saveStoryBible(bible: StoryBible): Promise<void> {
  await writeFile(STORY_BIBLE_PATH, JSON.stringify(bible, null, 2));
}

export async function loadStoryBible(): Promise<StoryBible | null> {
  if (!existsSync(STORY_BIBLE_PATH)) return null;
  const raw = await readFile(STORY_BIBLE_PATH, "utf-8");
  return JSON.parse(raw);
}
