// addin/scripts/make-icons.mjs
// Renders the Daybreak brand mark - a white "split & aligned disc" (the day-BREAK
// put back together) on a solid sunrise-coral tile - as RGBA PNG icons. Zero
// dependencies (Node zlib + manual CRC). 4x supersampled for smooth edges;
// transparent outside the rounded tile. Matches the website logo (docs/index.html).
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

// Brand: sunrise coral - chosen to stand out against Outlook's blue chrome.
const CORAL = [255, 106, 61];
// Lower half-disc is white at 70% over the coral tile -> precompute the solid blend.
const HALF = CORAL.map((c) => Math.round(255 * 0.7 + c * 0.3)); // ~[255, 210, 197]

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

// Split-disc glyph + rounded full-bleed tile, in supersampled space of side S.
// Two half-discs: a bright upper half and a slightly offset, dimmer lower half,
// with a thin coral "break" band between them.
function makeShape(S) {
  const radius = S * 0.22;                    // tile corner radius
  const r = S * 0.206, r2 = r * r;            // half-disc radius
  const topCx = S * 0.490, topCy = S * 0.500; // upper half centre; flat side at y=topCy
  const botCx = S * 0.549, botCy = S * 0.559; // lower half centre, offset; flat at y=botCy

  const inTile = (x, y) => {
    const minx = radius, maxx = S - 1 - radius, miny = radius, maxy = S - 1 - radius;
    let dx = 0, dy = 0;
    if (x < minx) dx = minx - x; else if (x > maxx) dx = x - maxx;
    if (y < miny) dy = miny - y; else if (y > maxy) dy = y - maxy;
    return dx * dx + dy * dy <= radius * radius;
  };
  // Foreground colour for a glyph pixel, or null where the coral tile shows.
  const glyphAt = (x, y) => {
    const tdx = x - topCx, tdy = y - topCy;
    if (y <= topCy && tdx * tdx + tdy * tdy <= r2) return [255, 255, 255]; // upper half
    const bdx = x - botCx, bdy = y - botCy;
    if (y >= botCy && bdx * bdx + bdy * bdy <= r2) return HALF;            // lower half
    return null;
  };
  return { inTile, glyphAt };
}

function renderIcon(size) {
  const SS = 4, S = size * SS;
  const { inTile, glyphAt } = makeShape(S);
  const out = Buffer.alloc(size * size * 4);
  const total = SS * SS;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let sr = 0, sg = 0, sb = 0, cnt = 0;
      for (let oy = 0; oy < SS; oy++) {
        for (let ox = 0; ox < SS; ox++) {
          const sx = px * SS + ox, sy = py * SS + oy;
          if (!inTile(sx, sy)) continue;
          const [r, g, b] = glyphAt(sx, sy) || CORAL;
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

// Filenames are size-suffixed and reused; bump the manifest <Version> on redeploy so
// Office/Outlook (which cache add-in icons by URL) fetch the refreshed images.
// 16/32/80 = ribbon button sizes; 64 = IconUrl; 128 = HighResolutionIconUrl.
mkdirSync('addin/assets', { recursive: true });
for (const size of [16, 32, 64, 80, 128]) {
  writeFileSync(`addin/assets/mark-${size}.png`, encodePng(size, renderIcon(size)));
}
console.log('Daybreak add-in: wrote coral split-disc mark-16/32/64/80/128.png');
