// ─── Genre System ─────────────────────────────────────────────
export type Genre =
  | "noir"
  | "solarpunk"
  | "brutalist"
  | "cyberpunk"
  | "cathedral"
  | "frontier"
  | "deep_sea"
  | "orbital"
  | "mythic"
  | "industrial";

// ─── Chapter Types ────────────────────────────────────────────
export type ChapterType =
  | "genesis"
  | "growth"
  | "crisis"
  | "resolution"
  | "maturity"
  | "live_push";

// ─── Easter Egg Types ─────────────────────────────────────────
export type EasterEggType =
  | "recurring_object"
  | "evolving_detail"
  | "hidden_symbol"
  | "environmental_echo";

export interface EasterEgg {
  type: EasterEggType;
  name: string;
  description: string;
  first_appearance: string;
  evolution_rule: string;
}

// ─── Story Bible ──────────────────────────────────────────────
export interface StoryBible {
  world_name: string;
  tagline: string;
  genre: Genre;
  subgenre: string;
  core_metaphor: string;
  visual_palette: {
    primary: string;
    secondary: string;
    accent: string;
    lighting: string;
    atmosphere: string;
  };
  material_vocabulary: string[];
  narrative_arc: {
    genesis: string;
    growth: string;
    crisis: string;
    resolution: string;
    maturity: string;
  };
  chapter_titles: string[];
  easter_eggs: EasterEgg[];
  repo_identity: {
    name: string;
    purpose: string;
    tech_stack: string[];
    size_class: "micro" | "small" | "medium" | "large" | "monorepo";
    primary_language: string;
  };
  created_at: string;
}

// ─── World State ──────────────────────────────────────────────
export interface WorldEntry {
  chapter_index: number;
  chapter_type: ChapterType;
  episode_title: string;
  prompt: string;
  world_id: string | null;
  spz_url: string | null;
  pano_url: string | null;
  collider_url: string | null;
  thumbnail_url: string | null;
  marble_url: string | null;
  operation_id: string | null;
  status: "pending" | "generating" | "ready" | "failed";
  commit_sha: string | null;
  diff_summary: string | null;
  created_at: string;
}

export interface WatcherState {
  repo_url: string;
  story_bible: StoryBible | null;
  chapters: WorldEntry[];
  current_chapter: number;
  last_commit_sha: string | null;
  updated_at: string;
}

// ─── Manifest ─────────────────────────────────────────────────
export interface Manifest {
  repo_url: string;
  world_name: string;
  genre: Genre;
  tagline: string;
  total_chapters: number;
  chapters: ManifestChapter[];
  created_at: string;
  updated_at: string;
}

export interface ManifestChapter {
  index: number;
  title: string;
  type: ChapterType;
  spz_url: string | null;
  pano_url: string | null;
  collider_url: string | null;
  marble_url: string | null;
  thumbnail_url: string | null;
  status: WorldEntry["status"];
}

export interface EpisodeCard {
  world_name: string;
  episode_title: string;
  chapter_number: number;
  chapter_type: ChapterType;
  genre: Genre;
  thumbnail_url: string | null;
  marble_url: string | null;
  tagline: string;
  prompt_excerpt: string;
}

// ─── WorldLabs API ────────────────────────────────────────────
export interface WorldLabsGenerateRequest {
  display_name: string;
  world_prompt: {
    type: "text" | "image";
    text_prompt?: string;
    image_prompt?: {
      source: "uri" | "media_asset";
      uri?: string;
      media_asset_id?: string;
      is_pano?: boolean;
    };
  };
  model?: "Marble 0.1-plus" | "Marble 0.1-mini";
}

export interface WorldLabsOperation {
  operation_id: string;
  created_at: string;
  updated_at: string;
  expires_at: string;
  done: boolean;
  error: { code: string; message: string } | null;
  metadata?: {
    progress: {
      status: "IN_PROGRESS" | "SUCCEEDED" | "FAILED";
      description: string;
    };
    world_id?: string;
  };
  response?: WorldLabsWorld;
}

export interface WorldLabsWorld {
  id: string;
  display_name: string;
  tags: string[] | null;
  world_marble_url: string;
  assets: {
    caption: string;
    thumbnail_url: string;
    splats: {
      spz_urls: {
        "100k": string;
        "500k": string;
        full_res: string;
      };
    };
    mesh: {
      collider_mesh_url: string;
    };
    imagery: {
      pano_url: string;
    };
  };
  created_at: string;
  updated_at: string;
  world_prompt: unknown;
  model: string;
}

// ─── SSE Events ───────────────────────────────────────────────
export type SSEEventType =
  | "story_bible"
  | "chapter_start"
  | "chapter_progress"
  | "chapter_ready"
  | "chapter_failed"
  | "world_update";

export interface SSEEvent {
  type: SSEEventType;
  data: unknown;
}

// ─── GitHub Context ───────────────────────────────────────────
export interface RepoContext {
  name: string;
  description: string | null;
  language: string | null;
  languages: Record<string, number>;
  topics: string[];
  stars: number;
  forks: number;
  size: number;
  default_branch: string;
  tree_summary: string;
  readme_excerpt: string;
  package_json: Record<string, unknown> | null;
}

export interface CommitInfo {
  sha: string;
  message: string;
  author: string;
  date: string;
  files_changed: number;
  additions: number;
  deletions: number;
}
