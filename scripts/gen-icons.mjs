#!/usr/bin/env node
/**
 * Generates the PWA icon PNGs referenced by index.html and vite.config.ts.
 *
 *   public/icons/icon-192.png
 *   public/icons/icon-512.png
 *   public/icons/icon-512-maskable.png   (same art, ~10% safe-zone padding)
 *   public/icons/apple-touch-icon.png    (180x180)
 *
 * The hand-written source of truth is public/icons/icon.svg; this script draws
 * the same geometry programmatically (rounded rect + straight-line "A") with
 * 4x4 supersampling for anti-aliasing, then writes PNGs using only Node
 * builtins (node:zlib for DEFLATE + manual chunk/CRC assembly).
 *
 * Run: node scripts/gen-icons.mjs   (or: npm run icons)
 */
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(ROOT, 'public', 'icons')
const PROVENANCE = 'Original Atlas Fit icon rendered programmatically by scripts/gen-icons.mjs from the hand-authored public/icons/icon.svg geometry; matte forest #101916, surface #1B2923, lime #B9E27C. Not AI-generated or externally sourced.'

// ---------------------------------------------------------------------------
// Palette — mirrors src/design/tokens.css
// ---------------------------------------------------------------------------
const BG = [0x10, 0x19, 0x16]
const SURFACE = [0x1b, 0x29, 0x23]
const SURFACE_TOP = SURFACE
const HAIRLINE = [0x35, 0x47, 0x3c]
const BLUE = [0xb9, 0xe2, 0x7c]
const LILAC = BLUE

// ---------------------------------------------------------------------------
// Geometry — identical to public/icons/icon.svg (viewBox 0 0 512 512)
// ---------------------------------------------------------------------------
const TILE = { cx: 256, cy: 256, half: 212, r: 104, border: 1.5 }
const MARK = {
  apex: [256, 140],
  left: [152, 372],
  right: [360, 372],
  width: 44,
  bar: [
    [206, 300],
    [306, 300],
  ],
}
const MARK_GRAD = { from: [140, 380], to: [372, 132] }
const TILE_GRAD = { x0: 44, y0: 44, x1: 468, y1: 468, hold: 0.7 }

// Supersampling grid (SS x SS samples per output pixel)
const SS = 4
const SS_N = SS * SS

// ---------------------------------------------------------------------------
// Small math helpers
// ---------------------------------------------------------------------------
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)
const lerp = (a, b, t) => a + (b - a) * t
const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1)
  return t * t * (3 - 2 * t)
}
const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]

/** Signed distance to a rounded rectangle (negative inside). */
function sdRoundRect(x, y) {
  const qx = Math.abs(x - TILE.cx) - TILE.half + TILE.r
  const qy = Math.abs(y - TILE.cy) - TILE.half + TILE.r
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0))
  const inside = Math.min(Math.max(qx, qy), 0)
  return outside + inside - TILE.r
}

/** Distance from a point to a line segment (endpoints clamped). */
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy), 0, 1)
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

/** Surface sheen across the tile, matching <linearGradient id="atlas-tile">. */
function tileColor(x, y) {
  const t = ((x - TILE_GRAD.x0) + (y - TILE_GRAD.y0)) / (TILE_GRAD.x1 - TILE_GRAD.x0 + (TILE_GRAD.y1 - TILE_GRAD.y0))
  return mix3(SURFACE_TOP, SURFACE, clamp(t / TILE_GRAD.hold, 0, 1))
}

/** Gradient along the mark axis, matching <linearGradient id="atlas-mark">. */
function markColor(x, y) {
  const dx = MARK_GRAD.to[0] - MARK_GRAD.from[0]
  const dy = MARK_GRAD.to[1] - MARK_GRAD.from[1]
  const t = clamp(((x - MARK_GRAD.from[0]) * dx + (y - MARK_GRAD.from[1]) * dy) / (dx * dx + dy * dy), 0, 1)
  return mix3(BLUE, LILAC, t)
}

/**
 * Colour of the artwork at one point in the 512x512 design space.
 * Layers: background -> rounded tile (+ hairline) -> gradient "A".
 */
function sample(x, y) {
  let r = BG[0]
  let g = BG[1]
  let b = BG[2]

  const d = sdRoundRect(x, y)
  if (d < 0) {
    const edge = smoothstep(-TILE.border, 0, d) // 0 = surface, 1 = hairline
    const c = tileColor(x, y)
    r = lerp(c[0], HAIRLINE[0], edge)
    g = lerp(c[1], HAIRLINE[1], edge)
    b = lerp(c[2], HAIRLINE[2], edge)
  }

  // Only test strokes near the mark's bounding box (generous margin)
  if (x > 118 && x < 394 && y > 106 && y < 406) {
    const hw = MARK.width / 2
    const [ax, ay] = MARK.apex
    const [lx, ly] = MARK.left
    const [rx, ry] = MARK.right
    const [b0x, b0y] = MARK.bar[0]
    const [b1x, b1y] = MARK.bar[1]
    if (
      segDist(x, y, ax, ay, lx, ly) <= hw ||
      segDist(x, y, ax, ay, rx, ry) <= hw ||
      segDist(x, y, b0x, b0y, b1x, b1y) <= hw
    ) {
      const c = markColor(x, y)
      r = c[0]
      g = c[1]
      b = c[2]
    }
  }

  return [r, g, b]
}

// ---------------------------------------------------------------------------
// PNG encoding (signature + IHDR + IDAT + IEND, CRC-32, DEFLATE via node:zlib)
// ---------------------------------------------------------------------------
const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const head = Buffer.alloc(4)
  head.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([head, body, crc])
}

function encodePNG(width, height, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // colour type: RGBA
  ihdr[10] = 0 // compression
  ihdr[11] = 0 // filter
  ihdr[12] = 0 // interlace

  // Filter type 0 (None) on every scanline
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }

  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('tEXt', Buffer.from(`impeccable:prompt\0${PROVENANCE}`, 'utf8')),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

/**
 * @param size   output pixel size
 * @param scale  artwork scale (1 = full 512 art; 0.79 = maskable safe zone)
 * @returns {Buffer} RGBA pixels
 */
function render(size, scale) {
  const offset = (size - 512 * scale) / 2
  const rgba = Buffer.alloc(size * size * 4)
  const inv = 1 / SS
  const n = SS_N

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let sr = 0
      let sg = 0
      let sb = 0
      for (let sy = 0; sy < SS; sy++) {
        const oy = py + (sy + 0.5) * inv
        for (let sx = 0; sx < SS; sx++) {
          const ox = px + (sx + 0.5) * inv
          const c = sample((ox - offset) / scale, (oy - offset) / scale)
          sr += c[0]
          sg += c[1]
          sb += c[2]
        }
      }
      const i = (py * size + px) * 4
      rgba[i] = Math.round(sr / n)
      rgba[i + 1] = Math.round(sg / n)
      rgba[i + 2] = Math.round(sb / n)
      rgba[i + 3] = 255
    }
  }
  return rgba
}

// ---------------------------------------------------------------------------
// Targets
// ---------------------------------------------------------------------------
const TARGETS = [
  { file: 'icon-192.png', size: 192, scale: 1 },
  { file: 'icon-512.png', size: 512, scale: 1 },
  // Maskable: art shrunk to 79% (~10.5% padding each side) so the rounded
  // tile stays inside the 40%-radius circular safe zone on #131019.
  { file: 'icon-512-maskable.png', size: 512, scale: 0.79 },
  { file: 'apple-touch-icon.png', size: 180, scale: 1 },
]

mkdirSync(OUT_DIR, { recursive: true })
for (const target of TARGETS) {
  const started = Date.now()
  const png = encodePNG(target.size, target.size, render(target.size, target.scale))
  const path = join(OUT_DIR, target.file)
  writeFileSync(path, png)
  console.log(`${target.file.padEnd(24)} ${target.size}x${target.size}  ${png.length} bytes  (${Date.now() - started}ms)`)
}
