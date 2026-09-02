/**
 * The living sky. Imperative Three.js scene behind Sky.tsx, loaded on demand so the form app's
 * main chunk stays lean. World units are CSS pixels at z = 0; the camera sits D px away so star
 * sizes, halo sizes and parallax are all reasoned about in pixels.
 *
 * Depth: place stars sit in a band around the z = 0 plane; the camera orbits a pivot behind that
 * plane, so near stars swing further than far ones and the dust field behind the pivot counter-moves.
 */
import * as THREE from 'three';
import { rng, type PlacedStar, type SkyMode, type StarTier } from './skyLayout';

// Exact hex in, exact hex out: no sRGB/linear conversion for a 2D sky. Must run before any Color is built.
THREE.ColorManagement.enabled = false;

const D = 2000;
/** The camera orbits this depth. Behind the star band, so every place star moves the same way, just at different speeds. */
const PIVOT_Z = -270;
const HALO_PX = 64;
const HALO_PEAK = 0.75;
const HALO_BREATH = 0.08;
const HALO_BREATH_S = 4;
const IGNITE_MS = 600;
const EDGE_DELAY_MS = 250;
const EDGE_MS = 400;
const ORBIT_PERIOD_S = 70;
/** Yaw / pitch amplitude of the slow orbit, degrees, per mode. */
const ORBIT_DEG: Record<SkyMode, [number, number]> = { hero: [3.5, 1.5], band: [1.5, 0.65] };
/** Pointer parallax as camera swing, degrees at full pointer deflection: ~22 px near stars, ~6 px far stars. */
const PARALLAX_DEG = 1.45;
/** Extra world offset on the dust field per pointer unit, so the background reads as further back than any star. */
const DUST_SHIFT = 14;
const DUST_COUNT = 1200;
const DUST_Z = [-600, -200];
const GLOW_ALPHA = 0.06;
const GLOW_Z = -260;
const PICK_PX = 16;
const DEG = Math.PI / 180;

const SKY_TOP = new THREE.Color(0x070912);
const SKY_HORIZON = new THREE.Color(0x0e1326);
const FOG = new THREE.Color(0x0b1020);
const COLD = new THREE.Color(0xdbe3f8);
const GOLD = new THREE.Color(0xffd166);
const DUST = new THREE.Color(0xc9d6ff);
const GLOW_COLD = new THREE.Color(0xc7d3f2);
const GLOW_GOLD = new THREE.Color(0xffd166);

export interface SkyHandle {
  setLayout(stars: PlacedStar[], edges: [number, number][], w: number, h: number, mode: SkyMode): void;
  /** Star tiers by quest id: 1 approved (outlined ring), 2 landed (filled + halo). Absent = available.
   *  `animate` runs the ignition for a star whose tier increases since the previous call. */
  setLit(tiers: Map<string, StarTier>, animate: boolean): void;
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

function radialTexture(stops: [number, number][]) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  for (const [at, a] of stops) grad.addColorStop(at, `rgba(255,255,255,${a})`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}
const haloTexture = () => radialTexture([[0, 1], [0.18, 0.62], [0.5, 0.14], [1, 0]]);
const glowTexture = () => radialTexture([[0, 1], [0.3, 0.45], [0.6, 0.12], [1, 0]]);

const STAR_VERT = /* glsl */ `
attribute float aSize; attribute float aSeed; attribute float aTier; attribute float aPop;
uniform float uScale;
varying float vSeed; varying float vTier; varying float vDepth;
void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  float grown = clamp(aTier, 0.0, 1.0);
  gl_PointSize = aSize * (1.0 + aPop) * (1.0 + 0.34 * grown) * uScale / -mvPosition.z;
  gl_Position = projectionMatrix * mvPosition;
  vSeed = aSeed; vTier = aTier; vDepth = -mvPosition.z;
}`;

// aTier is continuous 0..2 so an ignition crossfades between looks rather than snapping:
// tier 0 a small twinkling cold dot, tier 1 a gold outlined ring (approved, no fill, no halo),
// tier 2 a solid gold dot (landed; the halo sprite carries its glow, drawn separately).
const STAR_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uCold; uniform vec3 uGold; uniform float uTime; uniform float uFogNear; uniform float uFogFar;
varying float vSeed; varying float vTier; varying float vDepth;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c) * 2.0;
  float twinkle = 0.74 + 0.26 * sin(uTime * (0.7 + vSeed * 1.5) + vSeed * 37.0);
  float core0 = (1.0 - smoothstep(0.55, 0.66, d)) * 0.9 * twinkle;
  float ring1 = smoothstep(0.32, 0.42, d) * (1.0 - smoothstep(0.56, 0.66, d));
  float core2 = 1.0 - smoothstep(0.55, 0.66, d);
  float w1 = clamp(vTier, 0.0, 1.0);
  float w2 = clamp(vTier - 1.0, 0.0, 1.0);
  float alpha = mix(mix(core0, ring1, w1), core2, w2);
  vec3 color = mix(uCold, uGold, w1);
  float fog = smoothstep(uFogNear, uFogFar, vDepth);
  alpha *= 1.0 - 0.3 * fog * (1.0 - w1);
  gl_FragColor = vec4(color, alpha);
}`;

// Dust: constant screen size, never perspective-scaled, so it stays a texture and never reads as a place.
const DUST_VERT = /* glsl */ `
attribute float aSize; attribute float aAlpha; attribute float aSeed;
uniform float uPx; uniform float uTime;
varying float vAlpha;
void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uPx;
  gl_Position = projectionMatrix * mvPosition;
  vAlpha = aAlpha * (0.9 + 0.1 * sin(uTime * (0.25 + aSeed * 0.5) + aSeed * 61.0));
}`;

const DUST_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uColor;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c) * 2.0;
  gl_FragColor = vec4(uColor, (1.0 - smoothstep(0.4, 1.0, d)) * vAlpha);
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
  const pivot = new THREE.Vector3(0, 0, PIVOT_Z);
  const orbitR = D - PIVOT_Z;

  // Background gradient, drawn in clip space behind everything.
  const bgMat = new THREE.ShaderMaterial({
    uniforms: { uTop: { value: SKY_TOP }, uHorizon: { value: SKY_HORIZON } },
    vertexShader: BG_VERT, fragmentShader: BG_FRAG, depthTest: false, depthWrite: false,
  });
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat);
  bg.frustumCulled = false;
  bg.renderOrder = -10;
  scene.add(bg);

  // Air: one big soft additive glow behind each campaign's centroid.
  const glowTex = glowTexture();
  const glows: THREE.Sprite[] = [];

  // Dust: a wide, deep field of tiny points. Not places, never picked, never counted.
  const dustGeo = new THREE.BufferGeometry();
  const dustMat = new THREE.ShaderMaterial({
    uniforms: { uPx: { value: 1 }, uTime: { value: 0 }, uColor: { value: DUST } },
    vertexShader: DUST_VERT, fragmentShader: DUST_FRAG, transparent: true, depthWrite: false, depthTest: false,
  });
  const dust = new THREE.Points(dustGeo, dustMat);
  dust.frustumCulled = false;
  dust.renderOrder = -5;
  scene.add(dust);
  const dustUnit = new Float32Array(DUST_COUNT * 3); // x,y in -1..1 of the view at that depth; z in world px
  const dustPos = new Float32Array(DUST_COUNT * 3);
  {
    const r = rng('sky-dust');
    const size = new Float32Array(DUST_COUNT), alpha = new Float32Array(DUST_COUNT), seed = new Float32Array(DUST_COUNT);
    for (let i = 0; i < DUST_COUNT; i++) {
      dustUnit[i * 3] = r() * 2 - 1;
      dustUnit[i * 3 + 1] = r() * 2 - 1;
      dustUnit[i * 3 + 2] = DUST_Z[0] + r() * (DUST_Z[1] - DUST_Z[0]);
      size[i] = 1 + r() * 0.6;
      alpha[i] = 0.18 + r() * 0.22;
      seed[i] = r();
    }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    dustGeo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    dustGeo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
    dustGeo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  }

  // Stars.
  const starGeo = new THREE.BufferGeometry();
  const starMat = new THREE.ShaderMaterial({
    uniforms: {
      uScale: { value: D }, uTime: { value: 0 }, uCold: { value: COLD }, uGold: { value: GOLD },
      uFogNear: { value: D - 140 }, uFogFar: { value: D + 140 },
    },
    vertexShader: STAR_VERT, fragmentShader: STAR_FRAG, transparent: true, depthWrite: false, depthTest: false,
  });
  const points = new THREE.Points(starGeo, starMat);
  points.frustumCulled = false;
  points.renderOrder = 2;
  scene.add(points);

  // Edges: faint tree, and the gold tree that draws in when both ends are lit. Endpoints are the stars' 3D positions.
  const edgeGeo = new THREE.BufferGeometry();
  const edgeMat = new THREE.LineBasicMaterial({ color: 0xeef1f8, transparent: true, opacity: 0.28, depthWrite: false, depthTest: false });
  const edgeLines = new THREE.LineSegments(edgeGeo, edgeMat);
  edgeLines.frustumCulled = false;
  scene.add(edgeLines);
  const litEdgeGeo = new THREE.BufferGeometry();
  const litEdgeMat = new THREE.LineBasicMaterial({ color: GOLD, transparent: true, opacity: 0.9, depthWrite: false, depthTest: false });
  const litEdgeLines = new THREE.LineSegments(litEdgeGeo, litEdgeMat);
  litEdgeLines.frustumCulled = false;
  litEdgeLines.renderOrder = 1;
  scene.add(litEdgeLines);

  // Halos: one additive sprite per star, shown only for a landed (tier 2) star. Approved (tier 1)
  // gets the ring in the fragment shader above and nothing more — DESIGN.md §8 is explicit that
  // approved carries no halo, so a reviewer's approval is never mistaken for the source's write.
  const halo = haloTexture();
  const haloGroup = new THREE.Group();
  scene.add(haloGroup);

  // Per-star state.
  let stars: PlacedStar[] = [];
  let edges: [number, number][] = [];
  let width = 1, height = 1;
  let mode: SkyMode = 'hero';
  let world = new Float32Array(0);        // xyz per star
  let aSize = new Float32Array(0);
  let aTier = new Float32Array(0);        // continuous 0..2, the currently rendered tier
  let aPop = new Float32Array(0);
  let steadyTier = new Float32Array(0);   // 0/1/2, the tier once any animation finishes
  let animFrom = new Float32Array(0);
  let animTo = new Float32Array(0);
  let animStart = new Float64Array(0);    // NaN: no animation in progress; else the clock ms it began
  let edgeStart = new Float64Array(0);    // NaN not lit, -1 steady, else clock ms the draw begins
  let edgePos = new Float32Array(0);
  let sprites: THREE.Sprite[] = [];
  let tiers = new Map<string, StarTier>();
  let animating = false;

  const t0 = performance.now();
  const elapsedMs = () => performance.now() - t0;
  const pointerTarget = new THREE.Vector2(0, 0);
  const pointerNow = new THREE.Vector2(0, 0);
  let paused = false, destroyed = false, frame = 0;

  function rebuildDust() {
    for (let i = 0; i < DUST_COUNT; i++) {
      const z = dustUnit[i * 3 + 2];
      const k = ((D - z) / D) * 1.15; // fill the view at this depth, with margin for the orbit
      dustPos[i * 3] = dustUnit[i * 3] * (width / 2) * k;
      dustPos[i * 3 + 1] = dustUnit[i * 3 + 1] * (height / 2) * k;
      dustPos[i * 3 + 2] = z;
    }
    (dustGeo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  }

  function rebuildGlows() {
    const groups = new Map<string, { x: number; y: number; n: number; placed: boolean; x0: number; x1: number }>();
    for (const s of stars) {
      const g = groups.get(s.campaignId) ?? { x: 0, y: 0, n: 0, placed: true, x0: Infinity, x1: -Infinity };
      g.x += s.x; g.y += s.y; g.n++; g.placed &&= s.placed; g.x0 = Math.min(g.x0, s.x); g.x1 = Math.max(g.x1, s.x);
      groups.set(s.campaignId, g);
    }
    const list = [...groups.values()];
    while (glows.length < list.length) {
      const m = new THREE.SpriteMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, fog: false, opacity: GLOW_ALPHA });
      const sp = new THREE.Sprite(m);
      sp.renderOrder = -6;
      scene.add(sp);
      glows.push(sp);
    }
    while (glows.length > list.length) { const sp = glows.pop()!; scene.remove(sp); sp.material.dispose(); }
    const k = (D - GLOW_Z) / D;
    list.forEach((g, i) => {
      const sp = glows[i];
      const span = Math.max(g.x1 - g.x0, 120);
      const size = Math.min(span * 1.6, Math.max(height * 1.6, 260)) * k;
      sp.position.set((g.x / g.n - width / 2) * k, (height / 2 - g.y / g.n) * k, GLOW_Z);
      sp.scale.set(size, size, 1);
      sp.material.color = g.placed ? GLOW_COLD : GLOW_GOLD;
    });
  }

  function rebuildBuffers() {
    const n = stars.length;
    world = new Float32Array(n * 3);
    aSize = new Float32Array(n);
    const nextTier = new Float32Array(n), nextPop = new Float32Array(n), nextSteady = new Float32Array(n);
    const nextFrom = new Float32Array(n), nextTo = new Float32Array(n), nextStart = new Float64Array(n).fill(NaN);
    for (let i = 0; i < n; i++) {
      const s = stars[i];
      const k = (D - s.z) / D; // so the star projects exactly on its layout pixel at rest
      world[i * 3] = (s.x - width / 2) * k;
      world[i * 3 + 1] = (height / 2 - s.y) * k;
      world[i * 3 + 2] = s.z;
      aSize[i] = (9 + s.seed * 1.4) * (1 + 0.22 * Math.max(-1, Math.min(1, s.z / 140)));
      const t = tiers.get(s.questId) ?? 0;
      nextSteady[i] = t; nextTier[i] = t;
    }
    // Carry over in-flight ignitions across a relayout.
    for (let i = 0; i < Math.min(n, animStart.length); i++) {
      if (!Number.isNaN(animStart[i])) { nextStart[i] = animStart[i]; nextFrom[i] = animFrom[i]; nextTo[i] = animTo[i]; nextTier[i] = aTier[i]; nextPop[i] = aPop[i]; }
    }
    steadyTier = nextSteady; aTier = nextTier; aPop = nextPop; animFrom = nextFrom; animTo = nextTo; animStart = nextStart;

    starGeo.setAttribute('position', new THREE.BufferAttribute(world, 3));
    starGeo.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1));
    starGeo.setAttribute('aSeed', new THREE.BufferAttribute(Float32Array.from(stars.map((s) => s.seed)), 1));
    starGeo.setAttribute('aTier', new THREE.BufferAttribute(aTier, 1));
    starGeo.setAttribute('aPop', new THREE.BufferAttribute(aPop, 1));

    const ep = new Float32Array(edges.length * 6);
    edges.forEach(([a, b], i) => { ep.set(world.subarray(a * 3, a * 3 + 3), i * 6); ep.set(world.subarray(b * 3, b * 3 + 3), i * 6 + 3); });
    edgeGeo.setAttribute('position', new THREE.BufferAttribute(ep, 3));
    edgePos = new Float32Array(edges.length * 6);
    litEdgeGeo.setAttribute('position', new THREE.BufferAttribute(edgePos, 3));
    const nextEdgeStart = new Float64Array(edges.length);
    edges.forEach(([a, b], i) => {
      const la = edgeClock(a), lb = edgeClock(b);
      if (Number.isNaN(la) || Number.isNaN(lb)) nextEdgeStart[i] = NaN;
      else if (la < 0 && lb < 0) nextEdgeStart[i] = -1;
      else nextEdgeStart[i] = Math.max(la, lb) + EDGE_DELAY_MS;
    });
    edgeStart = nextEdgeStart;

    while (sprites.length < n) {
      const m = new THREE.SpriteMaterial({ map: halo, color: GOLD, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, fog: false, opacity: 0 });
      const sp = new THREE.Sprite(m);
      sp.visible = false;
      sp.renderOrder = 3;
      haloGroup.add(sp);
      sprites.push(sp);
    }
    while (sprites.length > n) { const sp = sprites.pop()!; haloGroup.remove(sp); sp.material.dispose(); }
    for (let i = 0; i < n; i++) sprites[i].position.set(world[i * 3], world[i * 3 + 1], world[i * 3 + 2]);
    rebuildDust();
    rebuildGlows();
    animating = true;
    paint(elapsedMs());
  }

  /** NaN: this star is not (about to be) tier ≥1. -1: steady lit. ≥0: clock ms it began lighting.
   *  Feeds the edge-draw scheduling, unchanged from v1's litAt-based version. */
  function edgeClock(i: number): number {
    if (Number.isNaN(animStart[i])) return steadyTier[i] >= 1 ? -1 : NaN;
    return animTo[i] >= 1 ? animStart[i] : NaN;
  }

  /** Writes tier/pop/halo/edge state for the clock time `now` (ms). */
  function paint(now: number) {
    let busy = false;
    const n = stars.length;
    for (let i = 0; i < n; i++) {
      const sp = sprites[i];
      if (Number.isNaN(animStart[i])) {
        aTier[i] = steadyTier[i];
        aPop[i] = 0;
      } else {
        const p = clamp01((now - animStart[i]) / IGNITE_MS);
        if (p >= 1) { steadyTier[i] = animTo[i]; animStart[i] = NaN; aTier[i] = animTo[i]; aPop[i] = 0; }
        else { busy = true; const e = easeOut(p); aTier[i] = animFrom[i] + (animTo[i] - animFrom[i]) * e; aPop[i] = 1.15 * Math.sin(Math.PI * p) * (1 - p * 0.4); }
      }
      const landedAmt = clamp01(aTier[i] - 1);
      sp.visible = landedAmt > 0.001;
      if (sp.visible) {
        const scale = HALO_PX * (0.35 + 0.65 * landedAmt) * (1 + 0.4 * Math.sin(Math.PI * Math.min(1, landedAmt)));
        sp.scale.set(scale, scale, 1);
        sp.material.opacity = HALO_PEAK * landedAmt;
      }
    }
    (starGeo.getAttribute('aTier') as THREE.BufferAttribute).needsUpdate = true;
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

  /** Steady landed (tier 2) halos breathe; ignitions in flight are owned by paint(). */
  function breathe(t: number) {
    const w = (t / HALO_BREATH_S) * Math.PI * 2;
    for (let i = 0; i < stars.length; i++) {
      if (!Number.isNaN(animStart[i]) || steadyTier[i] < 2) continue;
      const b = Math.sin(w + stars[i].seed * Math.PI * 2);
      const scale = HALO_PX * (1 + HALO_BREATH * b);
      sprites[i].scale.set(scale, scale, 1);
      sprites[i].material.opacity = HALO_PEAK * (1 - HALO_BREATH * 0.75 * (1 - b) * 0.5);
    }
  }

  function render() {
    if (destroyed) return;
    frame = requestAnimationFrame(render);
    if (paused) return;
    const now = elapsedMs();
    const t = now / 1000;
    if (animating) paint(now);
    breathe(t);
    starMat.uniforms.uTime.value = t;
    dustMat.uniforms.uTime.value = t;
    pointerNow.lerp(pointerTarget, 0.09);
    // Slow orbit around the pivot plus the pointer swing. Pointer right moves the camera left, so the
    // constellation follows the pointer and the dust behind the pivot counter-moves.
    const w = (t / ORBIT_PERIOD_S) * Math.PI * 2;
    const [yawA, pitchA] = ORBIT_DEG[mode];
    const yaw = (yawA * Math.sin(w) - pointerNow.x * PARALLAX_DEG) * DEG;
    const pitch = (pitchA * Math.sin(2 * w + 0.8) + pointerNow.y * PARALLAX_DEG) * DEG;
    camera.position.set(
      pivot.x + orbitR * Math.sin(yaw) * Math.cos(pitch),
      pivot.y + orbitR * Math.sin(pitch),
      pivot.z + orbitR * Math.cos(yaw) * Math.cos(pitch),
    );
    camera.lookAt(pivot);
    dust.position.set(-pointerNow.x * DUST_SHIFT, pointerNow.y * DUST_SHIFT, 0);
    renderer.render(scene, camera);
  }

  const onLost = (e: Event) => { e.preventDefault(); paused = true; };
  const onRestored = () => { paused = false; };
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);

  frame = requestAnimationFrame(render);

  const v3 = new THREE.Vector3();
  return {
    setLayout(nextStars, nextEdges, w, h, nextMode) {
      stars = nextStars; edges = nextEdges; width = Math.max(1, w); height = Math.max(1, h); mode = nextMode;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.fov = (2 * Math.atan(height / 2 / D) * 180) / Math.PI;
      camera.updateProjectionMatrix();
      starMat.uniforms.uScale.value = D * renderer.getPixelRatio();
      dustMat.uniforms.uPx.value = renderer.getPixelRatio();
      rebuildBuffers();
    },
    setLit(nextTiers, animate) {
      // React can call setLit before the first setLayout (e.g. the ignition effect fires before
      // the ResizeObserver's first measurement). There is no geometry to paint yet; just remember
      // the tiers so the next rebuildBuffers() starts every star at the right one.
      if (!starGeo.getAttribute('aTier')) { tiers = new Map(nextTiers); return; }
      const now = elapsedMs();
      for (let i = 0; i < stars.length; i++) {
        const id = stars[i].questId;
        const was = tiers.get(id) ?? 0;
        const is = nextTiers.get(id) ?? 0;
        if (is === was) continue;
        if (animate) {
          animFrom[i] = Number.isNaN(animStart[i]) ? steadyTier[i] : aTier[i];
          animTo[i] = is;
          animStart[i] = now;
        } else {
          steadyTier[i] = is; aTier[i] = is; animStart[i] = NaN;
        }
      }
      tiers = new Map(nextTiers);
      edges.forEach(([a, b], i) => {
        const la = edgeClock(a), lb = edgeClock(b);
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
        const reach = tiers.has(stars[i].questId) ? bestD * 2 : bestD;
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
      for (const sp of glows) sp.material.dispose();
      halo.dispose(); glowTex.dispose();
      starGeo.dispose(); starMat.dispose();
      dustGeo.dispose(); dustMat.dispose();
      edgeGeo.dispose(); edgeMat.dispose();
      litEdgeGeo.dispose(); litEdgeMat.dispose();
      bg.geometry.dispose(); bgMat.dispose();
      renderer.dispose();
    },
  };
}
