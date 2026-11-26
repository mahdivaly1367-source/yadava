#!/usr/bin/env node
/**
 * Generates Navanegar's custom Iranian turquoise-gold Adaptive Launcher Icons
 * and Splash Screens across all Android DPI buckets (zero external deps).
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const RES_DIR = path.resolve(process.cwd(), 'android/app/src/main/res');

// CRC32 table for valid PNG chunks
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodePngRgba(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter None
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const compressed = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function blendPixel(buf, idx, r, g, b, a) {
  const alpha = Math.max(0, Math.min(1, a));
  if (alpha <= 0) return;
  const inv = 1 - alpha;
  const dstA = buf[idx + 3] / 255;
  const outA = alpha + dstA * inv;
  if (outA <= 0) return;
  buf[idx] = Math.round((r * alpha + buf[idx] * dstA * inv) / outA);
  buf[idx + 1] = Math.round((g * alpha + buf[idx + 1] * dstA * inv) / outA);
  buf[idx + 2] = Math.round((b * alpha + buf[idx + 2] * dstA * inv) / outA);
  buf[idx + 3] = Math.round(outA * 255);
}

/**
 * Signed distance for an 8-point Persian Shamseh star (two overlapping squares at 0° and 45°).
 */
function shamsehDistance(nx, ny, radius) {
  const s1 = Math.max(Math.abs(nx), Math.abs(ny)) - radius;
  const c = Math.SQRT1_2;
  const rx = (nx - ny) * c;
  const ry = (nx + ny) * c;
  const s2 = Math.max(Math.abs(rx), Math.abs(ry)) - radius;
  return Math.min(s1, s2);
}

function segDist(px, py, ax, ay, bx, by) {
  const pax = px - ax;
  const pay = py - ay;
  const bax = bx - ax;
  const bay = by - ay;
  const h = Math.max(0, Math.min(1, (pax * bax + pay * bay) / (bax * bax + bay * bay)));
  return Math.hypot(pax - bax * h, pay - bay * h);
}

/**
 * Renders the Navanegar Persian Shamseh + Golden Koron emblem into an RGBA buffer.
 */
function renderNavanegarEmblem(width, height, { roundMask = false, transparentBg = false, emblemScale = 0.72 } = {}) {
  const rgba = Buffer.alloc(width * height * 4);
  const cx = width / 2;
  const cy = height / 2;
  const minDim = Math.min(width, height);
  const half = minDim / 2;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const dx = (x - cx) / half;
      const dy = (y - cy) / half;
      const dist = Math.hypot(dx, dy);

      if (roundMask && dist > 0.98) {
        continue;
      }

      // 1. Rich Persian Midnight Indigo + Turquoise radial glaze background
      if (!transparentBg) {
        const t = Math.min(1, dist * 0.85);
        const bgR = Math.round(13 * (1 - t) + 8 * t);
        const bgG = Math.round(48 * (1 - t) + 18 * t);
        const bgB = Math.round(64 * (1 - t) + 34 * t);
        rgba[idx] = bgR;
        rgba[idx + 1] = bgG;
        rgba[idx + 2] = bgB;
        rgba[idx + 3] = roundMask && dist > 0.94 ? Math.round(((0.98 - dist) / 0.04) * 255) : 255;

        // Subtle Persian geometric tile lattice lines on splash/full backgrounds
        const gx = Math.abs(((x - cx) / (minDim * 0.12)) % 1);
        const gy = Math.abs(((y - cy) / (minDim * 0.12)) % 1);
        if (Math.min(gx, 1 - gx) < 0.025 || Math.min(gy, 1 - gy) < 0.025) {
          blendPixel(rgba, idx, 45, 212, 191, 0.06);
        }
      }

      // Emblem normalized coords
      const ex = dx / emblemScale;
      const ey = dy / emblemScale;
      const eDist = Math.hypot(ex, ey);

      // 2. Outer Turquoise Persian Shamseh (8-point star)
      const starOuter = shamsehDistance(ex, ey, 0.68);
      if (starOuter <= 0.03) {
        const edgeA = starOuter < 0 ? 1 : (0.03 - starOuter) / 0.03;
        blendPixel(rgba, idx, 13, 148, 136, edgeA * 0.95); // Persian turquoise #0d9488
      }

      // 3. Antique Gold geometric rim on the Shamseh star
      if (Math.abs(starOuter + 0.045) < 0.032) {
        const rimA = 1 - Math.abs(starOuter + 0.045) / 0.032;
        blendPixel(rgba, idx, 245, 185, 56, rimA * 0.95);
      }

      // 4. Inner deep lapis medallion circle
      if (eDist < 0.56) {
        const medA = eDist < 0.52 ? 1 : (0.56 - eDist) / 0.04;
        blendPixel(rgba, idx, 12, 26, 48, medA * 0.96);
      }

      // 5. Fine gold inner ring
      if (Math.abs(eDist - 0.50) < 0.028) {
        const ringA = 1 - Math.abs(eDist - 0.50) / 0.028;
        blendPixel(rgba, idx, 251, 191, 36, ringA * 0.92);
      }

      // 6. Iconic Silky Anti-Aliased Golden Persian Koron (𝄳) via Rounded Line-Segment SDF
      const dStem = segDist(ex, ey, -0.10, -0.31, -0.10, 0.31);
      const dUpper = segDist(ex, ey, -0.10, -0.02, 0.22, 0.09);
      const dLower = segDist(ex, ey, 0.22, 0.09, -0.10, 0.26);
      const dKoron = Math.min(dStem, dUpper, dLower);
      const strokeHalf = 0.042;
      const aa = 0.022;
      if (dKoron < strokeHalf + aa) {
        const kA = dKoron <= strokeHalf ? 1 : (strokeHalf + aa - dKoron) / aa;
        blendPixel(rgba, idx, 253, 211, 77, kA);
      }

      // Resonant Persian turquoise acoustic dot accent above right
      const dotDist = Math.hypot(ex - 0.16, ey + 0.19);
      if (dotDist < 0.068) {
        const dA = dotDist < 0.048 ? 1 : (0.068 - dotDist) / 0.02;
        blendPixel(rgba, idx, 45, 212, 191, dA);
      }
    }
  }

  return encodePngRgba(width, height, rgba);
}

const MIPMAP_SIZES = [
  { bucket: 'mipmap-mdpi', launcher: 48, foreground: 108 },
  { bucket: 'mipmap-hdpi', launcher: 72, foreground: 162 },
  { bucket: 'mipmap-xhdpi', launcher: 96, foreground: 216 },
  { bucket: 'mipmap-xxhdpi', launcher: 144, foreground: 324 },
  { bucket: 'mipmap-xxxhdpi', launcher: 192, foreground: 432 },
];

for (const { bucket, launcher, foreground } of MIPMAP_SIZES) {
  const dir = path.join(RES_DIR, bucket);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'ic_launcher.png'),
    renderNavanegarEmblem(launcher, launcher, { roundMask: false, transparentBg: false, emblemScale: 0.78 })
  );
  fs.writeFileSync(
    path.join(dir, 'ic_launcher_round.png'),
    renderNavanegarEmblem(launcher, launcher, { roundMask: true, transparentBg: false, emblemScale: 0.78 })
  );
  fs.writeFileSync(
    path.join(dir, 'ic_launcher_foreground.png'),
    renderNavanegarEmblem(foreground, foreground, { roundMask: false, transparentBg: true, emblemScale: 0.56 })
  );
}

// Splash screens (compact crisp branded PNGs across portrait & landscape buckets)
const SPLASH_SPECS = [
  { dir: 'drawable', w: 480, h: 480, scale: 0.58 },
  { dir: 'drawable-port-mdpi', w: 320, h: 480, scale: 0.58 },
  { dir: 'drawable-port-hdpi', w: 480, h: 800, scale: 0.56 },
  { dir: 'drawable-port-xhdpi', w: 640, h: 960, scale: 0.54 },
  { dir: 'drawable-port-xxhdpi', w: 720, h: 1280, scale: 0.52 },
  { dir: 'drawable-port-xxxhdpi', w: 960, h: 1600, scale: 0.5 },
  { dir: 'drawable-land-mdpi', w: 480, h: 320, scale: 0.62 },
  { dir: 'drawable-land-hdpi', w: 800, h: 480, scale: 0.6 },
  { dir: 'drawable-land-xhdpi', w: 960, h: 640, scale: 0.58 },
  { dir: 'drawable-land-xxhdpi', w: 1280, h: 720, scale: 0.56 },
  { dir: 'drawable-land-xxxhdpi', w: 1600, h: 960, scale: 0.54 },
];

for (const s of SPLASH_SPECS) {
  const dir = path.join(RES_DIR, s.dir);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'splash.png'),
    renderNavanegarEmblem(s.w, s.h, { roundMask: false, transparentBg: false, emblemScale: s.scale })
  );
}

console.log(`Generated ${MIPMAP_SIZES.length * 3} custom Navanegar launcher icons and ${SPLASH_SPECS.length} Iranian splash screens.`);
