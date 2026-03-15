# git_world

**Every repository gets its own cinematic 3D world.**

git_world reads your codebase — the tech stack, the commit history, the actual source code — and translates it into a living, navigable 3D world with its own genre, narrative, soundtrack, and visual identity.

A payment protocol becomes a neon bazaar. A compiler becomes a gothic cathedral. An async framework becomes a clockwork citadel. No two repos look alike.

---

## Worlds Gallery

| World | Genre | Repo | Explore |
|---|---|---|---|
| **Abliterion Sanctum** | cathedral | [p-e-w/heretic](https://github.com/p-e-w/heretic) | [Marble 3D](https://marble.worldlabs.ai/world/2a078719-83c7-45ba-b157-7643d4df6145) |
| **The Codex Sanctum** | cathedral | [cursor/cursor](https://github.com/cursor/cursor) | [Marble 3D](https://marble.worldlabs.ai/world/a3e1c349-07aa-4f7a-97cc-9efe47e8266d) |
| **Permit402** | neon_bazaar | [coinbase/x402](https://github.com/coinbase/x402) | [Marble 3D](https://marble.worldlabs.ai/world/4868091d-f70c-4bdb-a441-6288663b1de5) |
| **Vaultheim Concierge** | art_deco | [ifoundaim/routeforge](https://github.com/ifoundaim/routeforge) | [Marble 3D](https://marble.worldlabs.ai/world/98cc268e-8021-4f60-a626-9962017c0780) |
| **The Conditional Foundry** | crystalline | [gnosis/conditional-tokens](https://github.com/gnosis/conditional-tokens-contracts) | [Marble 3D](https://marble.worldlabs.ai/world/0973bc57-fb94-45d1-8d13-04a6ac4a4951) |
| **Laterfall** | zen_garden | [facebookincubator/later](https://github.com/facebookincubator/later) | [Marble 3D](https://marble.worldlabs.ai/world/b13a74b0-5f46-4abc-8d11-0421f3c51cb3) |
| **Demurrage Gardens** | solarpunk | [aboutcircles/circles-sdk](https://github.com/aboutcircles/circles-sdk) | [Marble 3D](https://marble.worldlabs.ai/world/2423a3c3-7588-4715-bbc2-a04cb1323dd4) |
| **Amethyst Terminal** | crystalline | [omnilib/aiosqlite](https://github.com/omnilib/aiosqlite) | [Marble 3D](https://marble.worldlabs.ai/world/e7eeebb1-e58b-4e79-9fc7-29239850048d) |
| **Stacks Forge** | steampunk | [human058382928/stacks-go](https://github.com/human058382928/stacks-go) | [Marble 3D](https://marble.worldlabs.ai/world/fbf75516-c4ff-4c02-a9ab-6c60e6258f96) |
| **The Omen Archipelago** | floating_islands | [gnosis/prediction-market-agent](https://github.com/gnosis/prediction-market-agent) | [Marble 3D](https://marble.worldlabs.ai/world/686b3455-e6bb-47dd-bc85-69864b3ad0eb) |

Click any **Marble 3D** link to walk through the world in your browser.

---

## How It Works

```
GitHub Repo ──> Claude (Story Bible) ──> WorldLabs Marble (3D World) ──> Three.js Viewer
```

1. **Analyze** — Reads the repo: source code, file tree, README, commit history, tech stack
2. **Narrate** — Claude writes a Story Bible: genre, world name, visual palette, metaphor, easter eggs, chapter titles
3. **Generate** — WorldLabs Marble API creates a 3D Gaussian splat world from the narrative prompt
4. **View** — Three.js panorama viewer with WASD movement, fly camera, ambient soundtrack, chapter playback

### The Story Bible

Claude doesn't just pick a random theme. It reads your actual code — function names, variable names, comments, domain terminology — and finds the genre that fits the *soul* of the repo:

| Code Domain | Genre | Look & Feel |
|---|---|---|
| Security, auth, encryption | **noir** | Shadowy alleyways, fog, venetian blinds |
| AI/ML, neural nets | **cyberpunk** | Neon megastructures, holographic rain |
| Compilers, languages | **cathedral** | Gothic vaults, stained glass, reverent silence |
| Green tech, sustainability | **solarpunk** | Living architecture, moss-covered tech |
| Data pipelines, streaming | **deep_sea** | Bioluminescent abyss, submarine corridors |
| Build tools, CI/CD | **industrial** | Massive factories, conveyor belts, steam |
| Schedulers, state machines | **clockwork** | Brass mechanisms, gear-driven cities |
| Math, crypto, type systems | **crystalline** | Geometric crystal formations, prismatic light |
| Modular, serverless | **floating_islands** | Sky archipelago, cloud infrastructure |
| Design systems, UI | **art_deco** | Gold leaf, marble lobbies, geometric elegance |
| IoT, embedded, protocols | **steampunk** | Brass and copper, airships, mechanical computers |
| Clean architecture, minimal | **zen_garden** | Raked sand, balanced stones, bamboo |
| Marketplaces, commerce | **neon_bazaar** | Crowded night markets, holographic signs |
| Legacy code, migrations | **ancient_ruins** | Overgrown temples, hieroglyphic APIs |
| + 12 more genres | | |

### Multi-Chapter Worlds

Each repo can have multiple chapters that follow a narrative arc:

- **Genesis** — the empty stage, full of potential
- **Growth** — scaffolding rising, new structures appearing
- **Crisis** — cracks, dramatic lighting, tension in materials
- **Resolution** — healing, light breaking through
- **Maturity** — settled, grand, weathered but strong

---

## Quick Start

```bash
# Clone
git clone https://github.com/davek-ai/git_world.git
cd git_world
npm install

# Configure
cp .env.example .env
# Edit .env with your keys:
#   ANTHROPIC_API_KEY=sk-ant-...
#   WORLDLABS_API_KEY=wlt-...
#   GITHUB_TOKEN=ghp_...        (optional, for private repos / higher rate limits)

# Generate a world
npm run generate -- https://github.com/owner/repo

# Generate with multiple chapters
npm run generate -- https://github.com/owner/repo --chapters 4

# Start the viewer + server
npm start
# Open http://localhost:3000
```

## Viewer Features

### Navigation
- **W/A/S/D** — walk through the world
- **Q/E** — move up/down
- **Mouse drag** — look around
- **Scroll** — zoom
- **F** — cinematic fly camera (random path through the world)
- **M** — toggle ambient soundtrack
- **Space** — play all chapters
- **Arrow keys** — previous/next chapter

### Interface
- **+ New Repo** — paste any GitHub URL to generate a new world
  - Single repo: `github.com/owner/repo`
  - User/org constellation: `github.com/owner` (generates worlds for top repos)
- **Worlds** — gallery of all previously generated worlds
- **Contributors** — explore the people behind a repo, generate worlds from their top projects
- **Chapters** — timeline drawer with chapter types and navigation
- **Marble 3D** — open the full interactive 3D world on WorldLabs
- **Enter VR** — WebXR support for Pico/Quest headsets

### Ambient Soundtrack
Each genre has its own generative music — Web Audio API synthesizers matched to the world:
- Clockwork worlds get ticking square waves
- Cathedral worlds get reverberant sine pads
- Cyberpunk worlds get aggressive sawtooth arpeggios
- Zen garden worlds get sparse pentatonic plucks

### Contributor Avatars
GitHub avatars float with the particles during generation, then fly into position above the menu when the world loads. Click any avatar to visit their GitHub profile.

---

## Architecture

```
src/
  narrative.ts    — Story Bible generation via Claude API
  evolve.ts       — World prompt generation (thin wrapper over narrative)
  worldlabs.ts    — WorldLabs Marble API client (SPZ splats, pano, colliders)
  github.ts       — GitHub repo analysis, code sampling, contributor discovery
  state.ts        — Persistent world-state.json
  manifest.ts     — Manifest builder + episode cards
  history.ts      — World history across repos
  watcher.ts      — Main orchestrator (init, build, poll, batch)
  server.ts       — Express SSE server + REST API
  cli.ts          — CLI interface
  types.ts        — All TypeScript types
  viewer/
    index.html    — Self-contained Three.js viewer (inline JS, no build step)
```

### API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/events` | SSE stream (story_bible, chapter_start, chapter_ready, chapter_failed) |
| POST | `/api/watch` | Start watching a repo `{ repo_url, chapter_count?, model? }` |
| POST | `/api/explore` | List repos for user/org `{ owner }` |
| POST | `/api/contributors` | Get contributors + their top repos `{ repo_url, count? }` |
| POST | `/api/batch` | Generate worlds for multiple repos `{ repo_urls[], model? }` |
| GET | `/api/state` | Current watcher state + Story Bible |
| GET | `/api/manifest` | World manifest (all chapters) |
| GET | `/api/history` | All previously generated worlds |

---

## Stack

- **Claude API** (claude-sonnet-4-20250514) — Story Bible + world prompt generation
- **WorldLabs Marble API** — 3D Gaussian splat world generation
- **Three.js** — Panorama viewer, particles, orbit controls, WebXR
- **SparkJS** — Gaussian splat rendering (SPZ format)
- **Express** — SSE server, REST API
- **Octokit** — GitHub repo analysis
- **TypeScript** — Everything

---

## Keys You Need

| Key | Where | Required |
|---|---|---|
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) | Yes |
| `WORLDLABS_API_KEY` | [platform.worldlabs.ai](https://platform.worldlabs.ai) | Yes |
| `GITHUB_TOKEN` | [github.com/settings/tokens](https://github.com/settings/tokens) (`public_repo` scope) | Recommended |

---

## Models

WorldLabs offers two models:

| Model | Speed | Quality | Cost |
|---|---|---|---|
| **Marble 0.1-mini** (default) | ~30-45s | Good | Lower |
| **Marble 0.1-plus** | ~5min | Best | Higher |

---

*Built by [davek-ai](https://github.com/davek-ai) 
