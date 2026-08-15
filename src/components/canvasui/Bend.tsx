"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export interface BendOptions {
  zone?: number;
  angle?: number;
  rounding?: number;
  perspective?: number;
  direction?: "out" | "in";
  ease?: number;
  smoothing?: number;
  top?: boolean;
  bottom?: boolean;
  tumble?: number;
  tilt?: number;
  transparent?: boolean;
}

export interface BendInstance {
  setOptions: (options: BendOptions) => void;
  resize: () => void;
  destroy: () => void;
}

const DEFAULTS: Required<BendOptions> = {
  zone: 240,
  angle: 80,
  rounding: 150,
  perspective: 700,
  direction: "in",
  ease: 240,
  smoothing: 0.1,
  top: true,
  bottom: true,
  tumble: 0.5,
  tilt: 0.5,
  transparent: true,
};

const VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

// The rounded-fold inverse is deliberately analytic. The 40-step solve is the
// existing crease model, not a tessellated approximation.
const FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uTile;
uniform vec4 uTileRect;
uniform float uScrollTop;
uniform float uZone;
uniform float uAngle;
uniform float uPersp;
uniform float uDir;
uniform float uTopAmt;
uniform float uBotAmt;
uniform float uMaxX;
uniform float uPxY;
uniform float uPxX;
uniform float uTiltX;
uniform float uTiltY;
uniform float uPhi;
uniform float uRound;
uniform vec2 uViewport;

vec3 foldEdge(float sy, float amt) {
  float yf = 1.0 - uZone;
  if (amt < 1e-4) return vec3(sy, 0.0, 1.0);
  float theta = uAngle * amt;
  if (uRound < 1e-4) {
    float s = sin(theta) * uDir;
    float c = cos(theta);
    float denom = max(c * uPersp + s * (0.5 - sy), 1e-5);
    float tRaw = uPersp * (sy - yf) / denom;
    float t = clamp(tRaw, 0.0, uZone);
    float z = max(t * s, -0.85 * uPersp);
    float alpha = 1.0 - smoothstep(uZone, uZone + 2.0 * uPxY, tRaw);
    return vec3(yf + t, z, alpha);
  }
  if (sy <= yf) return vec3(sy, 0.0, 1.0);
  float R = min(uRound, uZone);
  float r = R / theta;
  float ca = cos(theta);
  float sa = sin(theta);
  float yA = r * sa;
  float zA = r * (1.0 - ca);
  float prevSy = yf;
  float prevZ = 0.0;
  float prevU = 0.0;
  float bestU = -1.0;
  float bestZ = 0.0;
  float maxSy = yf;
  float du = uZone / 40.0;
  for (int i = 1; i <= 40; i++) {
    float u = du * float(i);
    float Y;
    float Zm;
    if (u <= R) {
      float a = u / r;
      Y = r * sin(a);
      Zm = r * (1.0 - cos(a));
    } else {
      Y = yA + (u - R) * ca;
      Zm = zA + (u - R) * sa;
    }
    Y += yf;
    float Z = max(Zm * uDir, -0.85 * uPersp);
    float scr = 0.5 + (Y - 0.5) * uPersp / (uPersp + Z);
    if ((prevSy - sy) * (scr - sy) <= 0.0 && abs(scr - prevSy) > 1e-7) {
      float f = clamp((sy - prevSy) / (scr - prevSy), 0.0, 1.0);
      bestU = mix(prevU, u, f);
      bestZ = mix(prevZ, Z, f);
      if (uDir > 0.0) break;
    }
    maxSy = max(maxSy, scr);
    prevSy = scr;
    prevZ = Z;
    prevU = u;
  }
  if (bestU < 0.0) {
    float alpha = 1.0 - smoothstep(maxSy - uPxY, maxSy + uPxY, sy);
    return vec3(1.0, prevZ, alpha);
  }
  return vec3(yf + bestU, bestZ, 1.0);
}

vec2 tipPlane(float sy, float phi) {
  float s = sin(phi);
  float c = cos(phi);
  float denom = max(c * uPersp + s * (sy - 0.5), 1e-4);
  float t = uPersp * (1.0 - sy) / denom;
  return vec2(1.0 - t, t * s);
}

void main() {
  vec2 uv = vUv;
  float cx = uMaxX * 0.5;
  float zSum = 0.0;
  if (abs(uPhi) > 1e-4) {
    if (uPhi > 0.0) {
      vec2 r = tipPlane(uv.y, uPhi);
      uv.y = r.x;
      zSum += r.y;
    } else {
      vec2 r = tipPlane(1.0 - uv.y, -uPhi);
      uv.y = 1.0 - r.x;
      zSum += r.y;
    }
  }
  float zG = uTiltX * (uv.x - cx) + uTiltY * (uv.y - 0.5);
  zSum += zG;
  uv.y = 0.5 + (uv.y - 0.5) * (uPersp + zG) / uPersp;
  float inTop = step(1.0 - uZone, uv.y);
  float inBot = step(uv.y, uZone);
  vec3 top = foldEdge(uv.y, uTopAmt);
  vec3 bot = foldEdge(1.0 - uv.y, uBotAmt);
  float srcY = mix(uv.y, top.x, inTop);
  srcY = mix(srcY, 1.0 - bot.x, inBot);
  zSum += inTop * top.y + inBot * bot.y;
  float alpha = mix(1.0, top.z, inTop) * mix(1.0, bot.z, inBot);
  float srcX = cx + (uv.x - cx) * (uPersp + zSum) / uPersp;
  alpha *= smoothstep(-2.0 * uPxX, 0.0, srcX);
  alpha *= 1.0 - smoothstep(uMaxX, uMaxX + 2.0 * uPxX, srcX);
  alpha *= smoothstep(-2.0 * uPxY, 0.0, srcY);
  alpha *= 1.0 - smoothstep(1.0, 1.0 + 2.0 * uPxY, srcY);

  vec2 contentPoint = vec2(srcX * uViewport.x, (1.0 - srcY) * uViewport.y + uScrollTop);
  vec2 tileUv = (contentPoint - uTileRect.xy) / uTileRect.zw;
  float inside =
    step(0.0, tileUv.x) * step(tileUv.x, 1.0) *
    step(0.0, tileUv.y) * step(tileUv.y, 1.0) *
    step(0.0, srcX) * step(srcX, uMaxX) *
    step(0.0, srcY) * step(srcY, 1.0);
  vec4 base = texture(uTile, clamp(tileUv, 0.0005, 0.9995));
  outColor = vec4(base.rgb, base.a * alpha * inside);
}`;

type Tile = {
  element: HTMLElement;
  image: HTMLImageElement;
  texture: WebGLTexture | null;
  x: number;
  y: number;
  width: number;
  height: number;
  rasterWidth: number;
  rasterHeight: number;
};

type Resources = {
  program: WebGLProgram;
  vertex: WebGLShader;
  fragment: WebGLShader;
  quad: WebGLBuffer;
  uniforms: Record<string, WebGLUniformLocation>;
};

type GateState = "loading" | "entrance" | "live";

const ENTRANCE_DISTANCE = 96;
const ENTRANCE_DURATION = 1000;
const ENTRANCE_STAGGER = 35;
const GATE_TIMEOUT = 6_000;

function createBend(
  content: HTMLDivElement,
  output: HTMLCanvasElement,
  setReady: (ready: boolean) => void,
  options: BendOptions,
): BendInstance | null {
  const config = { ...DEFAULTS, ...options };
  const context = output.getContext("webgl2", {
    alpha: true,
    depth: false,
    stencil: false,
    antialias: false,
    premultipliedAlpha: false,
  });
  if (!context || context.isContextLost()) return null;
  const gl: WebGL2RenderingContext = context;

  let resources: Resources | null = null;
  let tiles: Tile[] = [];
  let raf = 0;
  let lastTime = performance.now();
  let destroyed = false;
  let running = false;
  let visible = true;
  let contextLost = false;
  let textureDpr = 1;
  let contentMaxX = 1;
  let topTarget = 0;
  let bottomTarget = 0;
  let topCurrent = 0;
  let bottomCurrent = 0;
  let over = 0;
  let phiCurrent = 0;
  let tiltXTarget = 0;
  let tiltYTarget = 0;
  let tiltXCurrent = 0;
  let tiltYCurrent = 0;
  let gateState: GateState = "loading";
  let gateTimer = 0;
  let gateCheckPending = false;
  let entranceStart = 0;

  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reducedMotion = motionQuery.matches;

  function compile(type: number, source: string) {
    const shader = gl.createShader(type);
    if (!shader) throw new Error("Unable to create WebGL shader");
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader) ?? "Unknown shader error";
      gl.deleteShader(shader);
      throw new Error(message);
    }
    return shader;
  }

  function destroyResources() {
    if (!resources) return;
    for (const tile of tiles) {
      if (tile.texture) gl.deleteTexture(tile.texture);
      tile.texture = null;
    }
    gl.deleteProgram(resources.program);
    gl.deleteShader(resources.vertex);
    gl.deleteShader(resources.fragment);
    gl.deleteBuffer(resources.quad);
    resources = null;
  }

  function initialiseResources() {
    destroyResources();
    const vertex = compile(gl.VERTEX_SHADER, VERT);
    const fragment = compile(gl.FRAGMENT_SHADER, FRAG);
    const program = gl.createProgram();
    const quad = gl.createBuffer();
    if (!program || !quad) throw new Error("Unable to allocate WebGL resources");
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) ?? "Unable to link WebGL program");
    }
    const uniforms: Record<string, WebGLUniformLocation> = {};
    const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let index = 0; index < count; index += 1) {
      const info = gl.getActiveUniform(program, index);
      if (info) uniforms[info.name] = gl.getUniformLocation(program, info.name)!;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );
    resources = { program, vertex, fragment, quad, uniforms };
  }

  function syncCanvasSize() {
    textureDpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(output.clientWidth * textureDpr));
    const height = Math.max(1, Math.round(output.clientHeight * textureDpr));
    if (output.width !== width || output.height !== height) {
      output.width = width;
      output.height = height;
    }
    contentMaxX = Math.min(
      1,
      Math.max(0.05, content.clientWidth / Math.max(output.clientWidth, 1)),
    );
  }

  function syncScroll() {
    const max = content.scrollHeight - content.clientHeight;
    const ramp = (value: number) => {
      const x = Math.min(Math.max(value / Math.max(config.ease, 1), 0), 1);
      return x * x * (3 - 2 * x);
    };
    topTarget = max > 1 && config.top ? ramp(content.scrollTop) : 0;
    bottomTarget = max > 1 && config.bottom ? ramp(max - content.scrollTop) : 0;
  }

  function setScrollLocked(locked: boolean) {
    content.style.overflow = locked ? "hidden" : "auto";
  }

  function revealSettled() {
    gateState = "live";
    window.clearTimeout(gateTimer);
    setScrollLocked(false);
    syncScroll();
    start();
  }

  function beginEntrance() {
    if (gateState !== "loading") return;
    if (reducedMotion) {
      revealSettled();
      return;
    }
    gateState = "entrance";
    window.clearTimeout(gateTimer);
    entranceStart = performance.now();
    start();
  }

  function tileRectsAreCurrent() {
    const contentRect = content.getBoundingClientRect();
    return tiles.every((tile) => {
      const rect = tile.element.getBoundingClientRect();
      return (
        tile.x === rect.left - contentRect.left + content.scrollLeft &&
        tile.y === rect.top - contentRect.top + content.scrollTop &&
        tile.width === rect.width &&
        tile.height === rect.height
      );
    });
  }

  function scheduleGateCheck() {
    if (gateState !== "loading" || gateCheckPending) return;
    gateCheckPending = true;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        gateCheckPending = false;
        if (destroyed || contextLost || gateState !== "loading") return;
        if (tiles.every((tile) => tile.texture) && tileRectsAreCurrent()) {
          beginEntrance();
        } else {
          refreshTiles();
        }
      });
    });
  }

  function uploadTile(tile: Tile) {
    if (!resources || !tile.image.complete || tile.image.naturalWidth === 0) return;
    const width = Math.max(1, Math.round(tile.width * textureDpr));
    const height = Math.max(1, Math.round(tile.height * textureDpr));
    if (
      tile.texture &&
      tile.rasterWidth === width &&
      tile.rasterHeight === height
    ) {
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = getComputedStyle(tile.element).backgroundColor;
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(tile.image, 0, 0, width, height);
    if (tile.texture) gl.deleteTexture(tile.texture);
    tile.texture = gl.createTexture();
    if (!tile.texture) return;
    gl.bindTexture(gl.TEXTURE_2D, tile.texture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      canvas,
    );
    gl.generateMipmap(gl.TEXTURE_2D);
    tile.rasterWidth = width;
    tile.rasterHeight = height;
  }

  function uploadPlaceholder(tile: Tile) {
    if (!resources || tile.texture) return;
    const texture = gl.createTexture();
    if (!texture) return;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([203, 199, 186, 255]),
    );
    tile.texture = texture;
    tile.rasterWidth = 1;
    tile.rasterHeight = 1;
  }

  function refreshTiles() {
    if (contextLost || destroyed) return;
    const contentRect = content.getBoundingClientRect();
    const existing = new Map(tiles.map((tile) => [tile.element, tile]));
    const next: Tile[] = [];
    for (const element of content.querySelectorAll<HTMLElement>("[data-bend-tile]")) {
      const image = element.querySelector("img");
      if (!(image instanceof HTMLImageElement)) continue;
      const rect = element.getBoundingClientRect();
      const tile = existing.get(element) ?? {
        element,
        image,
        texture: null,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        rasterWidth: 0,
        rasterHeight: 0,
      };
      tile.image = image;
      tile.x = rect.left - contentRect.left + content.scrollLeft;
      tile.y = rect.top - contentRect.top + content.scrollTop;
      tile.width = rect.width;
      tile.height = rect.height;
      if (image.complete && image.naturalWidth === 0) {
        uploadPlaceholder(tile);
      } else {
        uploadTile(tile);
      }
      next.push(tile);
      existing.delete(element);
    }
    for (const tile of existing.values()) {
      if (tile.texture) gl.deleteTexture(tile.texture);
    }
    tiles = next;
    const allTexturesReady =
      tiles.length > 0 && tiles.every((tile) => tile.texture);
    const hasImageError = tiles.some(
      (tile) => tile.image.complete && tile.image.naturalWidth === 0,
    );
    if (gateState === "loading") {
      if (hasImageError) {
        revealSettled();
      } else if (allTexturesReady) {
        scheduleGateCheck();
      }
    } else {
      render();
    }
    start();
  }

  function setCommonUniforms() {
    if (!resources) return;
    const { uniforms } = resources;
    const height = Math.max(output.clientHeight, 1);
    const width = Math.max(output.clientWidth, 1);
    const zone = Math.min(Math.max(config.zone, 8) / height, 0.49);
    gl.uniform1f(uniforms.uZone, zone);
    gl.uniform1f(uniforms.uAngle, Math.min(Math.max(config.angle, 1), 160) * (Math.PI / 180));
    gl.uniform1f(uniforms.uPersp, Math.max(config.perspective, 50) / height);
    gl.uniform1f(uniforms.uDir, config.direction === "in" ? -1 : 1);
    gl.uniform1f(uniforms.uTopAmt, topCurrent);
    gl.uniform1f(uniforms.uBotAmt, bottomCurrent);
    gl.uniform1f(uniforms.uMaxX, contentMaxX);
    gl.uniform1f(uniforms.uPxY, 1.5 / height);
    gl.uniform1f(uniforms.uPxX, 1.5 / width);
    gl.uniform1f(uniforms.uTiltX, tiltXCurrent);
    gl.uniform1f(uniforms.uTiltY, tiltYCurrent);
    gl.uniform1f(uniforms.uPhi, phiCurrent);
    gl.uniform1f(uniforms.uRound, Math.min(Math.max(config.rounding, 0) / height, zone));
    gl.uniform1f(uniforms.uScrollTop, content.scrollTop);
    gl.uniform2f(uniforms.uViewport, width, height);
  }

  function render() {
    if (!resources || contextLost || !visible || gateState === "loading") return;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, output.width, output.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(resources.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, resources.quad);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    setCommonUniforms();
    const viewportTop = content.scrollTop - config.zone * 2;
    const viewportBottom = content.scrollTop + content.clientHeight + config.zone * 2;
    const entranceElapsed = performance.now() - entranceStart;
    for (const [index, tile] of tiles.entries()) {
      if (!tile.texture) continue;
      let tileY = tile.y;
      if (gateState === "entrance") {
        const progress = Math.min(
          Math.max((entranceElapsed - index * ENTRANCE_STAGGER) / ENTRANCE_DURATION, 0),
          1,
        );
        const eased = 1 - (1 - progress) ** 4;
        tileY += (1 - eased) * ENTRANCE_DISTANCE;
      }
      if (tileY + tile.height < viewportTop || tileY > viewportBottom) continue;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tile.texture);
      gl.uniform1i(resources.uniforms.uTile, 0);
      gl.uniform4f(resources.uniforms.uTileRect, tile.x, tileY, tile.width, tile.height);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  }

  function frame(now: number) {
    if (destroyed || contextLost || !visible) {
      running = false;
      return;
    }
    const delta = Math.min((now - lastTime) / 1000, 1 / 30);
    lastTime = now;
    const k = reducedMotion || config.smoothing <= 0
      ? 1
      : 1 - Math.exp(-delta / Math.max(config.smoothing, 1e-4));
    topCurrent += (topTarget - topCurrent) * k;
    bottomCurrent += (bottomTarget - bottomCurrent) * k;
    if (Math.abs(topTarget - topCurrent) < 0.001) topCurrent = topTarget;
    if (Math.abs(bottomTarget - bottomCurrent) < 0.001) bottomCurrent = bottomTarget;
    over *= Math.exp(-delta / 0.22);
    if (Math.abs(over) < 0.5) over = 0;
    const phiTarget = reducedMotion || config.tumble <= 0
      ? 0
      : Math.tanh(over / 500) * 0.4 * Math.min(config.tumble, 1);
    phiCurrent += (phiTarget - phiCurrent) * Math.min(delta / 0.09, 1);
    if (phiTarget === 0 && Math.abs(phiCurrent) < 1e-4) phiCurrent = 0;
    if (reducedMotion || config.tilt <= 0) {
      tiltXTarget = 0;
      tiltYTarget = 0;
    }
    const tiltK = Math.min(delta / 0.15, 1);
    tiltXCurrent += (tiltXTarget - tiltXCurrent) * tiltK;
    tiltYCurrent += (tiltYTarget - tiltYCurrent) * tiltK;
    if (Math.abs(tiltXTarget - tiltXCurrent) < 1e-4) tiltXCurrent = tiltXTarget;
    if (Math.abs(tiltYTarget - tiltYCurrent) < 1e-4) tiltYCurrent = tiltYTarget;
    if (
      gateState === "entrance" &&
      now - entranceStart >= ENTRANCE_DURATION + (tiles.length - 1) * ENTRANCE_STAGGER
    ) {
      revealSettled();
    }
    render();
    if (
      gateState === "entrance" ||
      topCurrent !== topTarget ||
      bottomCurrent !== bottomTarget ||
      over !== 0 ||
      phiCurrent !== 0 ||
      tiltXCurrent !== tiltXTarget ||
      tiltYCurrent !== tiltYTarget
    ) {
      raf = requestAnimationFrame(frame);
    } else {
      running = false;
    }
  }

  function start() {
    if (destroyed || contextLost || running || !visible) return;
    running = true;
    lastTime = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function onScroll() {
    syncScroll();
    start();
  }

  function onWheel(event: WheelEvent) {
    if (config.tumble <= 0 || reducedMotion) return;
    const max = content.scrollHeight - content.clientHeight;
    if (max <= 1) return;
    if (event.deltaY > 0 && content.scrollTop >= max - 1) {
      over = Math.min(over + event.deltaY, 900);
    } else if (event.deltaY < 0 && content.scrollTop <= 1) {
      over = Math.max(over + event.deltaY, -900);
    } else {
      return;
    }
    start();
  }

  function onPointerMove(event: PointerEvent) {
    if (!event.isPrimary || config.tilt <= 0 || reducedMotion) return;
    const rect = output.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const nx = (event.clientX - rect.left) / rect.width - 0.5;
    const ny = 0.5 - (event.clientY - rect.top) / rect.height;
    const amplitude = Math.min(config.tilt, 1) * 0.14;
    tiltXTarget = -nx * amplitude;
    tiltYTarget = -ny * amplitude;
    start();
  }

  function onPointerLeave() {
    tiltXTarget = 0;
    tiltYTarget = 0;
    start();
  }

  function onMotionChange() {
    reducedMotion = motionQuery.matches;
    if (reducedMotion && gateState === "entrance") revealSettled();
    start();
  }

  function onContextLost(event: Event) {
    event.preventDefault();
    contextLost = true;
    window.clearTimeout(gateTimer);
    setScrollLocked(false);
    cancelAnimationFrame(raf);
    running = false;
    setReady(false);
  }

  function onContextRestored() {
    if (destroyed) return;
    contextLost = false;
    gateState = "loading";
    try {
      initialiseResources();
      syncCanvasSize();
      setScrollLocked(true);
      setReady(true);
      gateTimer = window.setTimeout(revealSettled, GATE_TIMEOUT);
      syncScroll();
      refreshTiles();
    } catch {
      contextLost = true;
      setScrollLocked(false);
      setReady(false);
    }
  }

  const resizeObserver = new ResizeObserver(() => {
    syncCanvasSize();
    refreshTiles();
    syncScroll();
    start();
  });
  resizeObserver.observe(content);
  resizeObserver.observe(output);
  const intersection = new IntersectionObserver((entries) => {
    visible = entries.at(-1)?.isIntersecting ?? true;
    if (visible) start();
  });
  intersection.observe(output);

  const onImageLoad = () => refreshTiles();
  content.addEventListener("load", onImageLoad, true);
  content.addEventListener("scroll", onScroll, { passive: true });
  content.addEventListener("wheel", onWheel, { passive: true });
  content.addEventListener("pointermove", onPointerMove, { passive: true });
  content.addEventListener("pointerleave", onPointerLeave);
  motionQuery.addEventListener("change", onMotionChange);
  output.addEventListener("webglcontextlost", onContextLost, false);
  output.addEventListener("webglcontextrestored", onContextRestored, false);

  try {
    initialiseResources();
    syncCanvasSize();
    setScrollLocked(true);
    setReady(true);
    gateTimer = window.setTimeout(revealSettled, GATE_TIMEOUT);
    syncScroll();
    refreshTiles();
  } catch {
    destroyResources();
    return null;
  }

  return {
    setOptions(next) {
      Object.assign(config, next);
      syncScroll();
      start();
    },
    resize() {
      syncCanvasSize();
      refreshTiles();
      syncScroll();
      start();
    },
    destroy() {
      destroyed = true;
      window.clearTimeout(gateTimer);
      cancelAnimationFrame(raf);
      setReady(false);
      resizeObserver.disconnect();
      intersection.disconnect();
      content.removeEventListener("load", onImageLoad, true);
      content.removeEventListener("scroll", onScroll);
      content.removeEventListener("wheel", onWheel);
      content.removeEventListener("pointermove", onPointerMove);
      content.removeEventListener("pointerleave", onPointerLeave);
      motionQuery.removeEventListener("change", onMotionChange);
      output.removeEventListener("webglcontextlost", onContextLost);
      output.removeEventListener("webglcontextrestored", onContextRestored);
      destroyResources();
    },
  };
}

export interface BendProps extends BendOptions {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function Bend({ children, className, style, ...options }: BendProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const outputRef = useRef<HTMLCanvasElement>(null);
  const instanceRef = useRef<BendInstance | null>(null);
  const initialOptions = useRef(options);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const content = contentRef.current;
    const output = outputRef.current;
    if (!content || !output) return;
    const instance = createBend(content, output, setReady, initialOptions.current);
    instanceRef.current = instance;
    if (!instance) setFailed(true);
    return () => {
      instance?.destroy();
      instanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    instanceRef.current?.setOptions(options);
  });

  return (
    <div
      className={className}
      data-bend-ready={ready ? "" : undefined}
      data-bend-fallback={failed ? "" : undefined}
      style={{ position: "relative", ...style }}
    >
      <div
        ref={contentRef}
        className="canvasui-scroll-content"
        style={{
          position: "relative",
          zIndex: 0,
          width: "100%",
          height: "100%",
          overflow: "auto",
          scrollbarWidth: "none",
        }}
      >
        {children}
      </div>
      <canvas
        ref={outputRef}
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 2,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

export default Bend;
