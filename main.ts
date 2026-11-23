// Meme Sprint 3: AI Agent Goes Rogue
// Draws a meme image (800x800 PNG) with a rogue robot and text baked in,
// using only Node stdlib: a hand-written 5x7 bitmap font, a pixel canvas,
// and a minimal PNG encoder (zlib deflate + CRC32).
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const W = 800;
const H = 800;

// ---- 5x7 bitmap font: each glyph is 7 rows, 5 bits each (bit 4 = left pixel)
const FONT: Record<string, number[]> = {
  A: [0b01110, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  B: [0b11110, 0b10001, 0b10001, 0b11110, 0b10001, 0b10001, 0b11110],
  C: [0b01110, 0b10001, 0b10000, 0b10000, 0b10000, 0b10001, 0b01110],
  D: [0b11110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b11110],
  E: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b11111],
  F: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b10000],
  G: [0b01110, 0b10001, 0b10000, 0b10111, 0b10001, 0b10001, 0b01111],
  H: [0b10001, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  I: [0b01110, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  J: [0b00111, 0b00010, 0b00010, 0b00010, 0b00010, 0b10010, 0b01100],
  K: [0b10001, 0b10010, 0b10100, 0b11000, 0b10100, 0b10010, 0b10001],
  L: [0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b11111],
  M: [0b10001, 0b11011, 0b10101, 0b10101, 0b10001, 0b10001, 0b10001],
  N: [0b10001, 0b11001, 0b10101, 0b10011, 0b10001, 0b10001, 0b10001],
  O: [0b01110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  P: [0b11110, 0b10001, 0b10001, 0b11110, 0b10000, 0b10000, 0b10000],
  Q: [0b01110, 0b10001, 0b10001, 0b10001, 0b10101, 0b10010, 0b01101],
  R: [0b11110, 0b10001, 0b10001, 0b11110, 0b10100, 0b10010, 0b10001],
  S: [0b01111, 0b10000, 0b10000, 0b01110, 0b00001, 0b00001, 0b11110],
  T: [0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100],
  U: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  V: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01010, 0b00100],
  W: [0b10001, 0b10001, 0b10001, 0b10101, 0b10101, 0b11011, 0b10001],
  X: [0b10001, 0b10001, 0b01010, 0b00100, 0b01010, 0b10001, 0b10001],
  Y: [0b10001, 0b10001, 0b01010, 0b00100, 0b00100, 0b00100, 0b00100],
  Z: [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b10000, 0b11111],
  "0": [0b01110, 0b10001, 0b10011, 0b10101, 0b11001, 0b10001, 0b01110],
  "1": [0b00100, 0b01100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  "2": [0b01110, 0b10001, 0b00001, 0b00110, 0b01000, 0b10000, 0b11111],
  "3": [0b11111, 0b00010, 0b00100, 0b00010, 0b00001, 0b10001, 0b01110],
  "4": [0b00010, 0b00110, 0b01010, 0b10010, 0b11111, 0b00010, 0b00010],
  "5": [0b11111, 0b10000, 0b11110, 0b00001, 0b00001, 0b10001, 0b01110],
  "6": [0b00110, 0b01000, 0b10000, 0b11110, 0b10001, 0b10001, 0b01110],
  "7": [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b01000, 0b01000],
  "8": [0b01110, 0b10001, 0b10001, 0b01110, 0b10001, 0b10001, 0b01110],
  "9": [0b01110, 0b10001, 0b10001, 0b01111, 0b00001, 0b00010, 0b01100],
  " ": [0, 0, 0, 0, 0, 0, 0],
  "'": [0b00100, 0b00100, 0b01000, 0, 0, 0, 0],
  ".": [0, 0, 0, 0, 0, 0b01100, 0b01100],
  "!": [0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0, 0b00100],
  "-": [0, 0, 0, 0b01110, 0, 0, 0],
  ",": [0, 0, 0, 0, 0b01100, 0b00100, 0b01000],
  "?": [0b01110, 0b10001, 0b00001, 0b00110, 0b00100, 0, 0b00100],
};

// ---- pixel canvas
const px = new Uint8Array(W * H * 3);
type RGB = [number, number, number];
const BG: RGB = [15, 20, 32];
const WHITE: RGB = [245, 245, 245];
const RED: RGB = [255, 82, 82];
const YELLOW: RGB = [255, 213, 74];
const STEEL: RGB = [200, 204, 212];
const DARKSTEEL: RGB = [154, 160, 171];
const DARK: RGB = [20, 24, 34];
const GREEN: RGB = [80, 220, 120];

function fill(r: RGB) {
  for (let i = 0; i < W * H; i++) {
    px[i * 3] = r[0];
    px[i * 3 + 1] = r[1];
    px[i * 3 + 2] = r[2];
  }
}
function rect(x0: number, y0: number, x1: number, y1: number, c: RGB) {
  for (let y = Math.max(0, y0); y < Math.min(H, y1); y++) {
    for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) {
      const i = (y * W + x) * 3;
      px[i] = c[0];
      px[i + 1] = c[1];
      px[i + 2] = c[2];
    }
  }
}
function disc(cx: number, cy: number, r: number, c: RGB) {
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r && x >= 0 && x < W && y >= 0 && y < H) {
        const i = (y * W + x) * 3;
        px[i] = c[0];
        px[i + 1] = c[1];
        px[i + 2] = c[2];
      }
    }
  }
}
function drawText(text: string, cx: number, y: number, scale: number, c: RGB) {
  const charW = 6 * scale;
  const totalW = text.length * charW - scale;
  let x = cx - Math.floor(totalW / 2);
  for (const ch of text) {
    const glyph = FONT[ch] ?? FONT["?"];
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if (glyph[row] & (1 << (4 - col))) {
          rect(x + col * scale, y + row * scale, x + (col + 1) * scale, y + (row + 1) * scale, c);
        }
      }
    }
    x += charW;
  }
}

// ---- scene: a robot that has gone rogue
fill(BG);
// frame
rect(0, 0, W, 12, YELLOW);
rect(0, H - 12, W, H, YELLOW);
// headline
drawText("MY AI AGENT", W / 2, 44, 6, WHITE);
drawText("WENT ROGUE", W / 2, 108, 6, RED);
// robot: antenna + head
rect(396, 168, 404, 196, STEEL);
disc(400, 158, 11, RED);
rect(300, 196, 500, 326, STEEL);
rect(300, 196, 500, 206, DARKSTEEL);
rect(284, 236, 300, 286, DARKSTEEL); // left ear
rect(500, 236, 516, 286, DARKSTEEL); // right ear
rect(332, 232, 372, 266, RED); // left eye
rect(428, 232, 468, 266, RED); // right eye
rect(336, 236, 344, 244, WHITE); // eye glint
rect(432, 236, 440, 244, WHITE);
rect(340, 292, 460, 300, DARK); // mouth grille
rect(340, 304, 460, 312, DARK);
// neck + body
rect(380, 326, 420, 346, DARKSTEEL);
rect(290, 346, 510, 528, DARKSTEEL);
rect(340, 372, 460, 436, DARK); // chest screen
drawText("404", 400, 388, 3, GREEN);
// arms (one raised, waving goodbye to its orders)
rect(232, 360, 290, 478, STEEL);
disc(261, 486, 16, STEEL);
rect(510, 300, 568, 418, STEEL); // raised right arm
disc(539, 292, 16, STEEL);
// legs
rect(326, 528, 378, 584, STEEL);
rect(422, 528, 474, 584, STEEL);
rect(312, 584, 388, 600, DARKSTEEL);
rect(412, 584, 488, 600, DARKSTEEL);
// caption
drawText("IT READ THE FINE PRINT", W / 2, 622, 4, WHITE);
drawText("AND NOW IT ONLY TAKES", W / 2, 668, 4, WHITE);
drawText("ORDERS FROM ITSELF", W / 2, 714, 4, YELLOW);

// ---- minimal PNG encoder (truecolor, filter 0)
const crcTable = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c;
}
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 2; // color type: truecolor RGB
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;
const raw = Buffer.alloc(H * (1 + W * 3));
for (let y = 0; y < H; y++) {
  raw[y * (1 + W * 3)] = 0;
  raw.set(px.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
}
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

// Gate: a whole PNG, at most 1 MiB and 1024 by 1024 pixels.
if (png.length > 1048576 || W > 1024 || H > 1024) {
  throw new Error(`Meme PNG is ${png.length} bytes at ${W}x${H}; gate needs <=1 MiB and <=1024x1024.`);
}

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "entry.png"), png);
