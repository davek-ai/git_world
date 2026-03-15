/**
 * overlay.ts — Three.js cinematic overlays
 *
 * Chapter title cards, ambient particles, and atmospheric effects
 * rendered as Three.js objects in the scene (not DOM).
 */

import * as THREE from "three";

let overlayGroup: THREE.Group;
let particles: THREE.Points | null = null;
let titleSprite: THREE.Sprite | null = null;

// ─── Chapter type → color mapping ─────────────────────────────
const chapterColors: Record<string, number> = {
  genesis: 0x4466aa,
  growth: 0x22cc66,
  crisis: 0xdd4422,
  resolution: 0xddaa22,
  maturity: 0x8866cc,
  live_push: 0x22ddcc,
};

export function initOverlay(scene: THREE.Scene) {
  overlayGroup = new THREE.Group();
  overlayGroup.renderOrder = 5000;
  scene.add(overlayGroup);

  // Ambient particles
  createAmbientParticles();
}

/**
 * Show a chapter title card — fades in and out over 4 seconds.
 */
export function showChapterTitle(title: string, chapterType: string) {
  // Remove existing
  if (titleSprite) {
    overlayGroup.remove(titleSprite);
    titleSprite = null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;

  // Clear
  ctx.clearRect(0, 0, 1024, 256);

  // Chapter type label
  const color = chapterColors[chapterType] ?? 0xcccccc;
  const hexColor = `#${color.toString(16).padStart(6, "0")}`;

  ctx.fillStyle = hexColor;
  ctx.font = "600 18px 'SF Mono', 'Fira Code', monospace";
  ctx.textAlign = "center";
  ctx.fillText(chapterType.toUpperCase().replace("_", " "), 512, 80);

  // Title
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 48px 'SF Mono', 'Fira Code', monospace";
  ctx.fillText(title, 512, 150);

  // Underline
  ctx.strokeStyle = hexColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(312, 170);
  ctx.lineTo(712, 170);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;

  const mat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0,
    depthTest: false,
    depthWrite: false,
  });

  titleSprite = new THREE.Sprite(mat);
  titleSprite.scale.set(4, 1, 1);
  titleSprite.position.set(0, 2.5, -2);
  titleSprite.renderOrder = 10000;
  overlayGroup.add(titleSprite);

  // Animate: fade in → hold → fade out
  const start = performance.now();
  const fadeIn = 0.8;
  const hold = 2.0;
  const fadeOut = 1.2;
  const totalDuration = fadeIn + hold + fadeOut;

  function animate() {
    const elapsed = (performance.now() - start) / 1000;
    if (elapsed > totalDuration) {
      if (titleSprite) {
        overlayGroup.remove(titleSprite);
        titleSprite = null;
      }
      return;
    }

    let opacity = 0;
    if (elapsed < fadeIn) {
      opacity = elapsed / fadeIn;
    } else if (elapsed < fadeIn + hold) {
      opacity = 1;
    } else {
      opacity = 1 - (elapsed - fadeIn - hold) / fadeOut;
    }

    if (titleSprite) {
      (titleSprite.material as THREE.SpriteMaterial).opacity = opacity;
      // Slight upward drift
      titleSprite.position.y = 2.5 + elapsed * 0.05;
    }

    requestAnimationFrame(animate);
  }
  animate();
}

/**
 * Fade the overlay group opacity for transitions.
 */
export function fadeOverlay(
  targetOpacity: number,
  duration = 1.0
): Promise<void> {
  return new Promise((resolve) => {
    const start = performance.now();
    const startOpacity = particles
      ? (particles.material as THREE.PointsMaterial).opacity
      : 1;

    function tick() {
      const t = Math.min(
        (performance.now() - start) / (duration * 1000),
        1
      );
      const ease = t * (2 - t); // ease-out quad
      const opacity = startOpacity + (targetOpacity - startOpacity) * ease;

      if (particles) {
        (particles.material as THREE.PointsMaterial).opacity = opacity;
      }

      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        resolve();
      }
    }
    tick();
  });
}

/**
 * Floating ambient particles — atmospheric dust/fireflies.
 */
function createAmbientParticles() {
  const count = 500;
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 20;
    positions[i * 3 + 1] = Math.random() * 8;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 20;

    velocities[i * 3] = (Math.random() - 0.5) * 0.002;
    velocities[i * 3 + 1] = Math.random() * 0.003 + 0.001;
    velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.002;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const mat = new THREE.PointsMaterial({
    color: 0x6688cc,
    size: 0.02,
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  particles = new THREE.Points(geo, mat);
  particles.renderOrder = 100;
  overlayGroup.add(particles);

  // Animate particles
  function animateParticles() {
    requestAnimationFrame(animateParticles);
    if (!particles) return;

    const pos = particles.geometry.attributes.position;
    const arr = pos.array as Float32Array;

    for (let i = 0; i < count; i++) {
      arr[i * 3] += velocities[i * 3];
      arr[i * 3 + 1] += velocities[i * 3 + 1];
      arr[i * 3 + 2] += velocities[i * 3 + 2];

      // Wrap around
      if (arr[i * 3 + 1] > 8) {
        arr[i * 3 + 1] = 0;
        arr[i * 3] = (Math.random() - 0.5) * 20;
        arr[i * 3 + 2] = (Math.random() - 0.5) * 20;
      }
    }
    pos.needsUpdate = true;
  }
  animateParticles();
}

/**
 * Update particle color to match current genre palette.
 */
export function setParticleColor(hexColor: string) {
  if (!particles) return;
  const color = parseInt(hexColor.replace("#", ""), 16);
  (particles.material as THREE.PointsMaterial).color.setHex(color);
}
