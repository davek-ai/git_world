import * as THREE from "three";
import { initSplatViewer, loadSplat, disposeSplat } from "./splatViewer.js";
import { initOverlay, showChapterTitle, fadeOverlay, setParticleColor } from "./overlay.js";
import type { StoryBible, EpisodeCard, ManifestChapter } from "../types.js";

// ─── State ────────────────────────────────────────────────────
let bible: StoryBible | null = null;
let chapters: ManifestChapter[] = [];
let currentChapter = -1;

// ─── DOM ──────────────────────────────────────────────────────
const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const introOverlay = document.getElementById("intro-overlay")!;
const introTitle = document.getElementById("intro-title")!;
const introSub = document.getElementById("intro-sub")!;
const hudName = document.getElementById("hud-name")!;
const hudTagline = document.getElementById("hud-tagline")!;
const hudChapter = document.getElementById("hud-chapter")!;
const hudGenre = document.getElementById("hud-genre")!;
const hudStatus = document.getElementById("hud-status")!;
const chapterNav = document.getElementById("chapter-nav")!;

// ─── Init Three.js + SparkJS viewer ──────────────────────────
const { renderer, scene, camera } = initSplatViewer(canvas);
initOverlay(scene);

// ─── SSE Connection ───────────────────────────────────────────
const apiBase = window.location.origin;
const evtSource = new EventSource(`${apiBase}/api/events`);

evtSource.addEventListener("connected", () => {
  introSub.textContent = "waiting for repo...";
  // Try loading existing state
  fetchState();
});

evtSource.addEventListener("story_bible", (e) => {
  bible = JSON.parse(e.data) as StoryBible;
  onBibleReady();
});

evtSource.addEventListener("chapter_start", (e) => {
  const data = JSON.parse(e.data) as {
    index: number;
    title: string;
    type: string;
  };
  hudStatus.textContent = `generating "${data.title}"...`;
  hudStatus.className = "status generating";
});

evtSource.addEventListener("chapter_ready", (e) => {
  const data = JSON.parse(e.data) as {
    index: number;
    world_id: string;
    marble_url: string;
    card: EpisodeCard;
  };
  hudStatus.textContent = "ready";
  hudStatus.className = "status ready";

  // Refresh state to get SPZ URLs
  fetchState().then(() => {
    navigateToChapter(data.index);
  });
});

evtSource.addEventListener("chapter_failed", (e) => {
  const data = JSON.parse(e.data) as { error: string; index?: number };
  hudStatus.textContent = `failed: ${data.error}`;
  hudStatus.className = "status failed";
});

// ─── Fetch existing state ─────────────────────────────────────
async function fetchState() {
  try {
    const res = await fetch(`${apiBase}/api/state`);
    if (!res.ok) return;
    const { state, bible: b } = await res.json();
    if (b && !bible) {
      bible = b;
      onBibleReady();
    }
    if (state?.chapters) {
      chapters = state.chapters;
      buildChapterNav();
      if (currentChapter < 0 && chapters.length > 0) {
        const lastReady = chapters.findLastIndex(
          (c: ManifestChapter) => c.status === "ready"
        );
        if (lastReady >= 0) navigateToChapter(lastReady);
      }
    }
  } catch {
    // Server not running yet
  }
}

// ─── Bible loaded ─────────────────────────────────────────────
function onBibleReady() {
  if (!bible) return;

  introTitle.textContent = bible.world_name.toUpperCase();
  introSub.textContent = bible.tagline;
  introSub.className = "";

  hudName.textContent = bible.world_name;
  hudTagline.textContent = bible.tagline;
  hudGenre.textContent = `${bible.genre} / ${bible.subgenre}`;

  // Apply palette to scene background
  const bg = parseInt(bible.visual_palette.primary.replace("#", ""), 16);
  scene.background = new THREE.Color(bg).multiplyScalar(0.15);

  // Update particle color to match palette
  setParticleColor(bible.visual_palette.accent);

  // Fade intro after 3s
  setTimeout(() => {
    introOverlay.classList.add("fade-out");
    setTimeout(() => {
      introOverlay.style.display = "none";
    }, 1500);
  }, 3000);
}

// ─── Chapter navigation ───────────────────────────────────────
function buildChapterNav() {
  chapterNav.innerHTML = "";
  for (const ch of chapters) {
    const btn = document.createElement("button");
    btn.textContent = `${ch.index + 1}`;
    btn.title = ch.title;
    if (ch.index === currentChapter) btn.classList.add("active");
    if (ch.status !== "ready") btn.style.opacity = "0.3";
    btn.addEventListener("click", () => {
      if (ch.status === "ready") navigateToChapter(ch.index);
    });
    chapterNav.appendChild(btn);
  }
}

async function navigateToChapter(index: number) {
  const ch = chapters[index];
  if (!ch || !ch.spz_url) return;

  currentChapter = index;
  hudChapter.textContent = `Chapter ${index + 1}: ${ch.title}`;

  // Dispose old splat, load new one
  disposeSplat();
  await loadSplat(ch.spz_url, ch.collider_url ?? undefined);

  // Show chapter title overlay
  showChapterTitle(ch.title, ch.type);

  // Update nav
  buildChapterNav();
}

// ─── Render loop ──────────────────────────────────────────────
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();

// ─── Resize ───────────────────────────────────────────────────
window.addEventListener("resize", () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
});
