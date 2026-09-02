/**
 * The living sky. Imperative Three.js scene behind Sky.tsx, loaded on demand so the form app's
 * main chunk stays lean. World units are CSS pixels at z = 0; the camera sits D px away so star
 * sizes, halo sizes and parallax are all reasoned about in pixels.
 */
import * as THREE from 'three';
import type { PlacedStar } from './skyLayout';

// Exact hex in, exact hex out: no sRGB/linear conversion for a 2D sky. Must run before any Color is built.
THREE.ColorManagement.enabled = false;

const D = 2000;
const HALO_PX = 64;
const HALO_REST = 0.7;
const IGNITE_MS = 600;
const EDGE_DELAY_MS = 250;
const EDGE_MS = 400;
const DRIFT_PERIOD_S = 61;
const PARALLAX_PX = 4;
const PICK_PX = 16;

const SKY_TOP = new THREE.Color(0x070912);
const SKY_HORIZON = new THREE.Color(0x0e1326);
const FOG = new THREE.Color(0x0b1020);
const COLD = new THREE.Color(0xdbe3f8);
const GOLD = new THREE.Color(0xffd166);

export interface SkyHandle {
  setLayout(stars: PlacedStar[], edges: [number, number][], w: number, h: number): void;
  /** Lit quest ids. `animate` runs the ignition for stars that were unlit a moment ago. */
  setLit(lit: Set<string>, animate: boolean): void;
  /** Pointer in canvas CSS px, or null when it leaves. Drives parallax. */
  pointer(x: number | null, y: number | null): void;
  /** Nearest star within reach of a canvas point, or -1. */
  pick(x: number, y: number): number;
  pause(): void;
  resume(): void;
  destroy(): void;
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

function haloTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.18, 'rgba(255,255,255,.62)');
  grad.addColorStop(0.5, 'rgba(255,255,255,.14)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

const STAR_VERT = /* glsl */ `
attribute float aSize; attribute float aSeed; attribute float aLit; attribute float aPop;
uniform float uScale;
varying float vSeed; varying float vLit; varying float vDepth;
void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * (1.0 + aPop) * uScale / -mvPosition.z;
  gl_Position = projectionMatrix * mvPosition;
  vSeed = aSeed; vLit = aLit; vDepth = -mvPosition.z;
}`;

const STAR_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uCold; uniform vec3 uGold; uniform float uTime; uniform float uFogNear; uniform float uFogFar;
varying float vSeed; varying float vLit; varying float vDepth;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c) * 2.0;
  float core = 1.0 - smoothstep(0.45, 1.0, d);
  float twinkle = 0.74 + 0.26 * sin(uTime * (0.7 + vSeed * 1.5) + vSeed * 37.0);
  float alpha = core * mix(0.72 * twinkle, 1.0, vLit);
  float fog = smoothstep(uFogNear, uFogFar, vDepth);
  alpha *= 1.0 - 0.6 * fog;
  gl_FragColor = vec4(mix(uCold, uGold, vLit), alpha);
}`;

const BG_VERT = /* glsl */ `
varying float vY;
void main() { vY = position.y * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const BG_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uTop; uniform vec3 uHorizon;
varying float vY;
void main() {
  float t = pow(vY, 1.25);
  vec3 col = mix(uHorizon, uTop, t);
  // Sub-LSB dither so the gradient never bands on a dark surface.
  float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
  gl_FragColor = vec4(col + n / 255.0, 1.0);
}`;

export function createSkyScene(canvas: HTMLCanvasElement): SkyHandle | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'low-power' });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(FOG, D - 60, D + 520);
  const camera = new THREE.PerspectiveCamera(30, 1, 200, 4000);
  camera.position.set(0, 0, D);

  // Background gradient, drawn in clip space behind everything.
  const bgMat = new THREE.ShaderMaterial({
    uniforms: { uTop: { value: SKY_TOP }, uHorizon: { value: SKY_HORIZON } },
    vertexShader: BG_VERT, fragmentShader: BG_FRAG, depthTest: false, depthWrite: false,
  });
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat);
  bg.frustumCulled = false;
  bg.renderOrder = -10;
  scene.add(bg);

  // Stars.
  const starGeo = new THREE.BufferGeometry();
  const starMat = new THREE.ShaderMaterial({
    uniforms: {
      uScale: { value: D }, uTime: { value: 0 }, uCold: { value: COLD }, uGold: { value: GOLD },
      uFogNear: { value: D - 140 }, uFogFar: { value: D + 320 },
    },
    vertexShader: STAR_VERT, fragmentShader: STAR_FRAG, transparent: true, depthWrite: false, depthTest: false,
  });
  const points = new THREE.Points(starGeo, starMat);
  points.frustumCulled = false;
  scene.add(points);

  // Edges: faint tree, and the gold tree that draws in when both ends are lit.
  const edgeGeo = new THREE.BufferGeometry();
  const edgeMat = new THREE.LineBasicMaterial({ color: 0xeef1f8, transparent: true, opacity: 0.085, depthWrite: false, depthTest: false });
  const edgeLines = new THREE.LineSegments(edgeGeo, edgeMat);
  edgeLines.frustumCulled = false;
  scene.add(edgeLines);
  const litEdgeGeo = new THREE.BufferGeometry();
  const litEdgeMat = new THREE.LineBasicMaterial({ color: GOLD, transparent: true, opacity: 0.5, depthWrite: false, depthTest: false });
  const litEdgeLines = new THREE.LineSegments(litEdgeGeo, litEdgeMat);
  litEdgeLines.frustumCulled = false;
  scene.add(litEdgeLines);

  // Halos: one additive sprite per star, shown only when lit.
  const halo = haloTexture();
  const haloGroup = new THREE.Group();
  scene.add(haloGroup);

  // Per-star state.
  let stars: PlacedStar[] = [];
  let edges: [number, number][] = [];
  let width = 1, height = 1;
  let world = new Float32Array(0);        // xyz per star
  let aSize = new Float32Array(0);
  let aLit = new Float32Array(0);
  let aPop = new Float32Array(0);
  let litAt = new Float64Array(0);        // NaN unlit, -1 steady lit, else clock ms of ignition
  let edgeStart = new Float64Array(0);    // NaN not lit, -1 steady, else clock ms the draw begins
  let edgePos = new Float32Array(0);
  let sprites: THREE.Sprite[] = [];
  let litIds = new Set<string>();
  let animating = false;

  const t0 = performance.now();
  const elapsedMs = () => performance.now() - t0;
  const pointerTarget = new THREE.Vector2(0, 0);
  const pointerNow = new THREE.Vector2(0, 0);
  let paused = false, destroyed = false, frame = 0;

  function rebuildBuffers() {
    const n = stars.length;
    world = new Float32Array(n * 3);
    aSize = new Float32Array(n);
    const nextLit = new Float32Array(n), nextPop = new Float32Array(n), nextLitAt = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const s = stars[i];
      const k = (D - s.z) / D; // so the star projects exactly on its layout pixel at rest
      world[i * 3] = (s.x - width / 2) * k;
      world[i * 3 + 1] = (height / 2 - s.y) * k;
      world[i * 3 + 2] = s.z;
      aSize[i] = 4.2 + s.seed * 2.2;
      const lit = litIds.has(s.questId);
      nextLit[i] = lit ? 1 : 0;
      nextLitAt[i] = lit ? -1 : NaN;
    }
    // Carry over in-flight ignitions across a relayout.
    for (let i = 0; i < Math.min(n, litAt.length); i++) if (litAt[i] >= 0) { nextLitAt[i] = litAt[i]; nextLit[i] = aLit[i]; nextPop[i] = aPop[i]; }
    aLit = nextLit; aPop = nextPop; litAt = nextLitAt;

    starGeo.setAttribute('position', new THREE.BufferAttribute(world, 3));
    starGeo.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1));
    starGeo.setAttribute('aSeed', new THREE.BufferAttribute(Float32Array.from(stars.map((s) => s.seed)), 1));
    starGeo.setAttribute('aLit', new THREE.BufferAttribute(aLit, 1));
    starGeo.setAttribute('aPop', new THREE.BufferAttribute(aPop, 1));

    const ep = new Float32Array(edges.length * 6);
    edges.forEach(([a, b], i) => { ep.set(world.subarray(a * 3, a * 3 + 3), i * 6); ep.set(world.subarray(b * 3, b * 3 + 3), i * 6 + 3); });
    edgeGeo.setAttribute('position', new THREE.BufferAttribute(ep, 3));
    edgePos = new Float32Array(edges.length * 6);
    litEdgeGeo.setAttribute('position', new THREE.BufferAttribute(edgePos, 3));
    const nextEdgeStart = new Float64Array(edges.length);
    edges.forEach(([a, b], i) => {
      const la = litAt[a], lb = litAt[b];
      if (Number.isNaN(la) || Number.isNaN(lb)) nextEdgeStart[i] = NaN;
      else if (la < 0 && lb < 0) nextEdgeStart[i] = -1;
      else nextEdgeStart[i] = Math.max(la, lb) + EDGE_DELAY_MS;
    });
    edgeStart = nextEdgeStart;

    while (sprites.length < n) {
      const m = new THREE.SpriteMaterial({ map: halo, color: GOLD, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, fog: false, opacity: 0 });
      const sp = new THREE.Sprite(m);
      sp.visible = false;
      haloGroup.add(sp);
      sprites.push(sp);
    }
    while (sprites.length > n) { const sp = sprites.pop()!; haloGroup.remove(sp); sp.material.dispose(); }
    for (let i = 0; i < n; i++) sprites[i].position.set(world[i * 3], world[i * 3 + 1], world[i * 3 + 2]);
    animating = true;
    paint(elapsedMs());
  }

  /** Writes lit/pop/halo/edge state for the clock time `now` (ms). */
  function paint(now: number) {
    let busy = false;
    const n = stars.length;
    for (let i = 0; i < n; i++) {
      const t0 = litAt[i];
      const sp = sprites[i];
      if (Number.isNaN(t0)) { aLit[i] = 0; aPop[i] = 0; sp.visible = false; continue; }
      let p = 1;
      if (t0 >= 0) { p = clamp01((now - t0) / IGNITE_MS); if (p < 1) busy = true; else litAt[i] = -1; }
      const e = easeOut(p);
      aLit[i] = clamp01(p * 2.4);
      aPop[i] = 1.15 * Math.sin(Math.PI * p) * (1 - p * 0.4);
      const scale = HALO_PX * (0.35 + 0.65 * e) * (1 + 0.4 * Math.sin(Math.PI * p));
      sp.visible = true;
      sp.scale.set(scale, scale, 1);
      sp.material.opacity = HALO_REST * e;
    }
    (starGeo.getAttribute('aLit') as THREE.BufferAttribute).needsUpdate = true;
    (starGeo.getAttribute('aPop') as THREE.BufferAttribute).needsUpdate = true;

    for (let i = 0; i < edges.length; i++) {
      const s0 = edgeStart[i];
      const [a, b] = edges[i];
      if (Number.isNaN(s0)) { edgePos.set(world.subarray(a * 3, a * 3 + 3), i * 6); edgePos.set(world.subarray(a * 3, a * 3 + 3), i * 6 + 3); continue; }
      let p = 1;
      if (s0 >= 0) { p = clamp01((now - s0) / EDGE_MS); if (p < 1) busy = true; else edgeStart[i] = -1; }
      const q = easeOut(p);
      edgePos.set(world.subarray(a * 3, a * 3 + 3), i * 6);
      for (let k = 0; k < 3; k++) edgePos[i * 6 + 3 + k] = world[a * 3 + k] + (world[b * 3 + k] - world[a * 3 + k]) * q;
    }
    (litEdgeGeo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    animating = busy;
  }

  function render() {
    if (destroyed) return;
    frame = requestAnimationFrame(render);
    if (paused) return;
    const now = elapsedMs();
    const t = now / 1000;
    if (animating) paint(now);
    starMat.uniforms.uTime.value = t;
    const w = (t / DRIFT_PERIOD_S) * Math.PI * 2;
    pointerNow.lerp(pointerTarget, 0.05);
    camera.position.x = 10 * Math.sin(w) - pointerNow.x * PARALLAX_PX;
    camera.position.y = 6 * Math.cos(w) - pointerNow.y * PARALLAX_PX;
    renderer.render(scene, camera);
  }

  const onLost = (e: Event) => { e.preventDefault(); paused = true; };
  const onRestored = () => { paused = false; };
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);

  frame = requestAnimationFrame(render);

  const v3 = new THREE.Vector3();
  return {
    setLayout(nextStars, nextEdges, w, h) {
      stars = nextStars; edges = nextEdges; width = Math.max(1, w); height = Math.max(1, h);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.fov = (2 * Math.atan(height / 2 / D) * 180) / Math.PI;
      camera.updateProjectionMatrix();
      starMat.uniforms.uScale.value = D * renderer.getPixelRatio();
      rebuildBuffers();
    },
    setLit(lit, animate) {
      const now = elapsedMs();
      for (let i = 0; i < stars.length; i++) {
        const id = stars[i].questId;
        const was = litIds.has(id), is = lit.has(id);
        if (is && !was) litAt[i] = animate ? now : -1;
        else if (!is && was) litAt[i] = NaN;
      }
      litIds = new Set(lit);
      edges.forEach(([a, b], i) => {
        const la = litAt[a], lb = litAt[b];
        if (Number.isNaN(la) || Number.isNaN(lb)) edgeStart[i] = NaN;
        else if (la < 0 && lb < 0) { if (Number.isNaN(edgeStart[i])) edgeStart[i] = -1; }
        else edgeStart[i] = Math.max(la, lb) + EDGE_DELAY_MS;
      });
      animating = true;
      paint(now);
    },
    pointer(x, y) {
      if (x == null || y == null) pointerTarget.set(0, 0);
      else pointerTarget.set((x / width) * 2 - 1, (y / height) * 2 - 1);
    },
    pick(x, y) {
      let best = -1, bestD = PICK_PX * PICK_PX;
      for (let i = 0; i < stars.length; i++) {
        v3.set(world[i * 3], world[i * 3 + 1], world[i * 3 + 2]).project(camera);
        const sx = ((v3.x + 1) / 2) * width, sy = ((1 - v3.y) / 2) * height;
        const d = (sx - x) ** 2 + (sy - y) ** 2;
        const reach = litIds.has(stars[i].questId) ? bestD * 2 : bestD;
        if (d < reach && d < (best === -1 ? Infinity : bestD)) { best = i; bestD = Math.min(bestD, d); }
      }
      return best;
    },
    pause() { paused = true; },
    resume() { paused = false; },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(frame);
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      for (const sp of sprites) sp.material.dispose();
      halo.dispose();
      starGeo.dispose(); starMat.dispose();
      edgeGeo.dispose(); edgeMat.dispose();
      litEdgeGeo.dispose(); litEdgeMat.dispose();
      bg.geometry.dispose(); bgMat.dispose();
      renderer.dispose();
    },
  };
}
