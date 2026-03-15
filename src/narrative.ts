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

const STORY_BIBLE_SYSTEM_PROMPT = `You are a world-building AI that translates software repositories into cinematic 3D worlds. Each repository MUST get a completely unique world — different name, different genre, different visual identity. No two repos should ever look or feel the same.

You will receive a complete repository analysis — its tech stack, structure, commit history, README, and metadata. Your job is to produce a Story Bible: a persistent narrative document that defines the visual universe of this repository.

## Process
1. UNDERSTAND the technical reality: what the repo does, who built it, how large it is, what technologies it uses
2. Find what makes this repo UNIQUE — its specific domain, its personality, its quirks
3. TRANSLATE that into a narrative world that could ONLY belong to this specific repo

## Genre Assignment
Pick the genre that best captures the SOUL of the repo. Be creative — don't default to cyberpunk. Consider the repo's domain, its mood, its scale, its users.

### Tech & Digital
- "cyberpunk" — AI/ML, neural nets, bleeding edge tech. Neon-lit megastructures, holographic rain, data streams as rivers of light
- "noir" — security, auth, encryption, privacy. Shadowy alleyways, detective offices, fog-drenched streets, venetian blind shadows
- "orbital" — cloud, distributed systems, Kubernetes, microservices. Vast space stations, satellite arrays, zero-gravity architecture
- "industrial" — build tools, CI/CD, DevOps, automation. Massive factories, conveyor systems, precision machinery, steam and steel
- "clockwork" — state machines, schedulers, cron, precise algorithms. Intricate brass mechanisms, clock towers, gear-driven cities

### Nature & Elements
- "solarpunk" — green tech, sustainability, open source, community. Living architecture, solar panels as flowers, moss-covered tech
- "deep_sea" — data pipelines, streaming, ETL, message queues. Bioluminescent abyss, submarine corridors, pressure and depth
- "arctic" — testing, validation, cold storage, analytics. Vast ice plains, crystalline caves, aurora-lit frozen cathedrals, permafrost data vaults
- "volcanic" — high-performance, real-time, low-latency, hot paths. Magma channels, obsidian towers, eruption craters, thermal vents
- "coral_reef" — ecosystems, plugin systems, package managers, dependencies. Living reef structures, symbiotic organisms, tide pools, colorful biodiversity
- "aurora" — visualization, graphics, shaders, creative coding. Northern lights as architecture, prismatic skies, light as building material, spectral bridges
- "desert_mirage" — config, env management, secrets, illusion of simplicity. Vast golden dunes, oasis cities, heat shimmer, ancient buried structures

### Architecture & History
- "cathedral" — compilers, languages, foundational libraries, core infrastructure. Soaring gothic vaults, stained glass, flying buttresses, reverent silence
- "brutalist" — databases, storage, infrastructure. Raw concrete monoliths, exposed aggregate, fortress-like data centers
- "art_deco" — design systems, UI frameworks, component libraries. Geometric elegance, gold leaf, marble lobbies, symmetrical facades
- "ancient_ruins" — legacy code, migrations, archaeology of old systems. Overgrown temples, hieroglyphic APIs, excavation sites, stone tablets as documentation
- "steampunk" — hardware interfaces, IoT, embedded systems, protocols. Brass and copper, steam valves, airships, mechanical computers
- "zen_garden" — minimal APIs, clean architecture, well-documented projects. Raked sand, balanced stones, bamboo water features, perfect simplicity

### Fantasy & Exploration
- "mythic" — game engines, creative tools, media processing. Legendary forges, enchanted workshops, mythological landscapes
- "frontier" — new frameworks, experimental, alpha/beta projects. Uncharted wilderness, frontier towns, expedition camps, map edges
- "biopunk" — biotech, health data, genetic algorithms, neural networks. Organic circuits, living walls, DNA helixes as staircases, membrane architecture
- "crystalline" — math libraries, cryptography, type systems, formal verification. Geometric crystal formations, prismatic light, faceted surfaces, perfect symmetry
- "floating_islands" — modular architecture, microservices, serverless. Sky archipelago, bridges between floating land masses, clouds as infrastructure
- "underground" — low-level systems, kernel, runtime, memory management. Deep cavern networks, underground rivers, mineshaft elevators, geode chambers
- "overgrown" — abandoned/archived projects, or projects being revived. Jungle reclaiming buildings, vines through server racks, nature vs machine
- "neon_bazaar" — marketplaces, APIs, commerce, fintech, exchanges. Crowded night markets, holographic shop signs, bustling trade routes

## CRITICAL: Uniqueness Rules
- The world_name MUST be a unique proper noun. Never use generic names like "The Grid" or "The Network"
- Draw the world_name from the repo's actual content — function names, package names, domain concepts
- The tagline must be poetic and specific to THIS repo
- Colors in the palette must vary significantly between genres. Do NOT default to blue/cyan
- The core_metaphor must be specific enough that you could identify the repo from the metaphor alone

## Easter Egg Types
Include 2-3 easter eggs using these types:
- "recurring_object" — appears in every chapter, subtle but consistent
- "evolving_detail" — changes meaning as the world evolves
- "hidden_symbol" — references something in the actual codebase
- "environmental_echo" — the environment reacts to code changes

## Chapter Titles
Generate 6-8 chapter titles that read as episode titles. They should follow the narrative arc from genesis through maturity. Make them evocative and specific to this repo's story.

## Output
Return ONLY valid JSON matching the StoryBible schema. No markdown wrapping. No commentary.

{
  "world_name": "string — proper noun, evocative, memorable, UNIQUE to this repo",
  "tagline": "string — one line, cinematic, specific",
  "genre": "string — from genre table above",
  "subgenre": "string — specific flavor within the genre",
  "core_metaphor": "string — the precise metaphor that translates any diff into world changes",
  "visual_palette": {
    "primary": "string — hex color, genre-appropriate",
    "secondary": "string — hex color",
    "accent": "string — hex color, contrasting",
    "lighting": "string — specific lighting description unique to this world",
    "atmosphere": "string — atmospheric description"
  },
  "material_vocabulary": ["string — 4-6 material/texture keywords unique to this genre"],
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
- Use the Story Bible's genre, palette, materials, and lighting grammar FAITHFULLY
- Include at least one easter egg from the Story Bible (subtle, not named explicitly)
- The description must be a PHYSICAL PLACE — describe architecture, terrain, lighting, materials, atmosphere
- Do NOT mention code, files, commits, or programming concepts — translate everything into the world metaphor
- Make the scene FEEL like its genre. A zen_garden world should feel peaceful and minimal. A volcanic world should feel dangerous and intense. A coral_reef should feel alive and colorful.
- Include specific sensory details: temperature, sound, smell, texture
- Describe the SCALE — is this intimate or vast? Claustrophobic or open?
- Each chapter type has a distinct register:
  - genesis: vast, empty, potential-filled, atmospheric, the stage before the story
  - growth: expanding, busy, scaffolding rising, new structures appearing
  - crisis: cracking, splitting, dramatic lighting, tension in materials
  - resolution: healing, new connections, light breaking through
  - maturity: settled, grand, weathered but strong, lived-in
  - live_push: dynamic, flickering, real-time energy, things in motion
- End with "The 360 scene is faultless." — this helps WorldLabs generate complete panoramas

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

## File Tree
${repoContext.file_tree}

## README (excerpt)
${repoContext.readme_excerpt}

## Package/Config
${repoContext.package_json ? JSON.stringify(repoContext.package_json, null, 2).slice(0, 1500) : "(not a JS project)"}

## Actual Source Code (sampled from key files)
Study this code carefully. The function names, variable names, comments, domain terminology, and coding style are the DNA of this repo. Use them to inspire the world name, metaphor, and easter eggs.

${repoContext.code_samples}

## Commit History (${commits.length} commits, newest first)
${commits
  .slice(0, 30)
  .map(
    (c) =>
      `[${c.date}] ${c.author}: ${c.message.split("\n")[0]} (+${c.additions}/-${c.deletions}, ${c.files_changed} files)`
  )
  .join("\n")}

Generate the Story Bible for this repository. Remember:
- The world MUST be unique to THIS repo — draw from the actual code, function names, and domain language above
- Pick a genre that captures the SOUL of what this code does, not just "cyberpunk" by default
- The world_name should be inspired by real identifiers, concepts, or terminology found in the code`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1500,
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
