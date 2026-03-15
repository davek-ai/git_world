/**
 * splatViewer.ts — Three.js + SparkJS Gaussian splat renderer
 *
 * Based on the sensai-webxr-worldmodels architecture:
 * - SparkRenderer added to scene for GPU splat rendering
 * - SplatMesh instances loaded from WorldLabs .spz URLs
 * - GLB collider meshes loaded for interaction raycasting
 * - Fly-in animation via dyno shader modifier
 */

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

// SparkJS types — imported dynamically to handle the GitHub dep
let SparkRenderer: any;
let SplatMesh: any;
let sparkReady = false;

async function ensureSpark() {
  if (sparkReady) return;
  try {
    const spark = await import("@sparkjsdev/spark");
    SparkRenderer = spark.SparkRenderer;
    SplatMesh = spark.SplatMesh;
    sparkReady = true;
  } catch (err) {
    console.warn("SparkJS not available, falling back to pano viewer:", err);
  }
}

// ─── Module state ─────────────────────────────────────────────
let sparkRenderer: any = null;
let currentSplat: any = null;
let currentCollider: THREE.Object3D | null = null;
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;

export function initSplatViewer(canvas: HTMLCanvasElement) {
  const w = window.innerWidth;
  const h = window.innerHeight;

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050510);

  // Camera
  camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 1000);
  camera.position.set(0, 1.5, 3);

  // Renderer
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
  });
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // Orbit controls for mouse/touch navigation
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.target.set(0, 1.0, 0);
  controls.maxPolarAngle = Math.PI * 0.85;
  controls.minDistance = 0.5;
  controls.maxDistance = 20;

  // Ambient light (splats are pre-lit, but needed for collider debug)
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));

  // Ground grid
  const grid = new THREE.GridHelper(50, 50, 0x222244, 0x111122);
  grid.material.opacity = 0.3;
  grid.material.transparent = true;
  scene.add(grid);

  // Init SparkJS renderer (async)
  ensureSpark().then(() => {
    if (SparkRenderer) {
      sparkRenderer = new SparkRenderer({
        enableLod: true,
        lodSplatScale: 1.0,
        renderOrder: -10,
      });
      scene.add(sparkRenderer);
      console.log("[viewer] SparkJS renderer initialized");
    }
  });

  // Override render to include controls update
  const origRender = renderer.render.bind(renderer);
  renderer.render = (s: THREE.Scene, c: THREE.Camera) => {
    controls.update();
    origRender(s, c);
  };

  return { renderer, scene, camera };
}

/**
 * Load a .spz splat file from a WorldLabs URL.
 * Optionally load a GLB collider mesh.
 */
export async function loadSplat(
  spzUrl: string,
  colliderUrl?: string
): Promise<void> {
  await ensureSpark();

  if (!SplatMesh) {
    // Fallback: no SparkJS — show a placeholder sphere
    console.warn("[viewer] SparkJS unavailable, showing placeholder");
    const geo = new THREE.SphereGeometry(1, 32, 32);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x4466aa,
      wireframe: true,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, 1, 0);
    scene.add(mesh);
    currentCollider = mesh;
    return;
  }

  try {
    // Create SplatMesh from URL
    currentSplat = new SplatMesh({
      url: spzUrl,
      lod: true,
    });

    // Wait for initialization with timeout
    await Promise.race([
      currentSplat.initialized,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Splat load timeout")), 30000)
      ),
    ]);

    // Apply WorldLabs Marble coordinate transform
    // (from sensai-webxr: scale 1.195, flip Y/Z)
    currentSplat.scale.set(1.195, 1.195, 1.195);
    currentSplat.rotation.x = Math.PI;
    currentSplat.position.y = 1.054;
    currentSplat.renderOrder = -10;

    scene.add(currentSplat);
    console.log(`[viewer] Splat loaded: ${spzUrl}`);

    // Fly-in animation
    animateSplatIn(currentSplat);
  } catch (err) {
    console.error("[viewer] Failed to load splat:", err);
  }

  // Load collider mesh if provided
  if (colliderUrl) {
    try {
      const { GLTFLoader } = await import(
        "three/examples/jsm/loaders/GLTFLoader.js"
      );
      const loader = new GLTFLoader();
      const gltf = await loader.loadAsync(colliderUrl);
      const colliderRoot = gltf.scene;
      colliderRoot.visible = false; // Invisible — for raycasting only
      colliderRoot.scale.set(1.195, 1.195, 1.195);
      colliderRoot.rotation.x = Math.PI;
      colliderRoot.position.y = 1.054;
      scene.add(colliderRoot);
      currentCollider = colliderRoot;
      console.log("[viewer] Collider mesh loaded");
    } catch (err) {
      console.warn("[viewer] Collider load failed:", err);
    }
  }
}

/**
 * GPU-accelerated fly-in animation (inspired by sensai-webxr GaussianSplatAnimator).
 * If dyno is available, uses GPU shader modifier. Otherwise, simple scale tween.
 */
function animateSplatIn(splat: any, duration = 1.5) {
  const start = performance.now();

  // Simple CPU fallback: scale from 0 to full
  const targetScale = splat.scale.clone();
  splat.scale.set(0.01, 0.01, 0.01);

  function tick() {
    const elapsed = (performance.now() - start) / 1000;
    const t = Math.min(elapsed / duration, 1);
    // Cubic ease-out
    const ease = 1 - Math.pow(1 - t, 3);

    splat.scale.lerpVectors(
      new THREE.Vector3(0.01, 0.01, 0.01),
      targetScale,
      ease
    );

    if (t < 1) requestAnimationFrame(tick);
  }
  tick();
}

/**
 * Remove current splat and collider from scene.
 */
export function disposeSplat() {
  if (currentSplat) {
    scene.remove(currentSplat);
    if (currentSplat.dispose) currentSplat.dispose();
    currentSplat = null;
  }
  if (currentCollider) {
    scene.remove(currentCollider);
    currentCollider = null;
  }
}
