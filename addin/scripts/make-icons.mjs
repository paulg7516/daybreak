// addin/scripts/make-icons.mjs
// Renders the Daybreak brand mark (sunrise on the amber->rose->violet gradient) as
// RGBA PNG icons, zero dependencies (Node zlib + manual CRC). 4x supersampled for
// smooth edges; transparent outside the rounded tile.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

// Gradient stops: amber-400, rose-500, violet-600 (matches the app logo).
const STOPS = [[251, 191, 36], [244, 63, 94], [124, 58, 237]];

function lerp(a, b, t) { return a + (b - a) * t; }
function gradientAt(t) {
  const [a, b, c] = STOPS;
  if (t < 0.5) { const u = t / 0.5; return [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)]; }
  const u = (t - 0.5) / 0.5; return [lerp(b[0], c[0], u), lerp(b[1], c[1], u), lerp(b[2], c[2], u)];
}

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) { c ^= buf[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); }
  return ~c >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function encodePng(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) { raw[y * (stride + 1)] = 0; rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride); }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// Sunrise glyph + rounded-tile mask, evaluated in supersampled space of side S.
function makeShape(S) {
  const radius = S * 0.22;
  const sunCx = S * 0.5, sunCy = S * 0.47, sunR = S * 0.16;
  const horizonY = S * 0.63, hx0 = S * 0.2, hx1 = S * 0.8, hHalf = S * 0.028;
  const rayAngles = [-Math.PI / 2, -Math.PI / 2 - 0.62, -Math.PI / 2 + 0.62, -Math.PI / 2 - 1.15, -Math.PI / 2 + 1.15];
  const rayIn = sunR * 1.32, rayOut = sunR * 1.95;

  const inTile = (x, y) => {
    const minx = radius, maxx = S - 1 - radius, miny = radius, maxy = S - 1 - radius;
    let dx = 0, dy = 0;
    if (x < minx) dx = minx - x; else if (x > maxx) dx = x - maxx;
    if (y < miny) dy = miny - y; else if (y > maxy) dy = y - maxy;
    return dx * dx + dy * dy <= radius * radius;
  };
  const isWhite = (x, y) => {
    const dx = x - sunCx, dy = y - sunCy;
    if (dy <= hHalf && dx * dx + dy * dy <= sunR * sunR) return true; // sun (above the horizon)
    if (x >= hx0 && x <= hx1 && Math.abs(y - horizonY) <= hHalf) return true; // horizon bar
    const dist = Math.hypot(dx, dy);
    if (dy < 0 && dist >= rayIn && dist <= rayOut) {
      const ang = Math.atan2(dy, dx);
      for (const a of rayAngles) {
        let d = Math.abs(ang - a); if (d > Math.PI) d = 2 * Math.PI - d;
        if (d < 0.16) return true;
      }
    }
    return false;
  };
  return { inTile, isWhite };
}

function renderIcon(size) {
  const SS = 4, S = size * SS;
  const { inTile, isWhite } = makeShape(S);
  const out = Buffer.alloc(size * size * 4);
  const total = SS * SS;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let sr = 0, sg = 0, sb = 0, cnt = 0;
      for (let oy = 0; oy < SS; oy++) {
        for (let ox = 0; ox < SS; ox++) {
          const sx = px * SS + ox, sy = py * SS + oy;
          if (!inTile(sx, sy)) continue;
          let r, g, b;
          if (isWhite(sx, sy)) { r = 255; g = 255; b = 255; }
          else { const t = (sx + sy) / (2 * (S - 1)); [r, g, b] = gradientAt(t); }
          sr += r; sg += g; sb += b; cnt++;
        }
      }
      const i = (py * size + px) * 4;
      out[i] = cnt ? Math.round(sr / cnt) : 0;
      out[i + 1] = cnt ? Math.round(sg / cnt) : 0;
      out[i + 2] = cnt ? Math.round(sb / cnt) : 0;
      out[i + 3] = Math.round((cnt / total) * 255);
    }
  }
  return out;
}

mkdirSync('addin/assets', { recursive: true });
for (const size of [16, 32, 80]) {
  writeFileSync(`addin/assets/icon-${size}.png`, encodePng(size, renderIcon(size)));
}
console.log('Daybreak add-in: wrote sunrise icon-16/32/80.png');
