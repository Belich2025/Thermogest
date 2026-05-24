'use strict';
const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

const BG = [0x1d, 0x4e, 0xd8]; // #1d4ed8 blue
const FG = [0xff, 0xff, 0xff]; // white

// 5×7 pixel glyphs for B L C H
const GLYPHS = {
  B: [
    [1,1,1,1,0],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,1,1,1,0],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,1,1,1,0],
  ],
  L: [
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,1,1,1,1],
  ],
  C: [
    [0,1,1,1,1],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [0,1,1,1,1],
  ],
  H: [
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,1,1,1,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,0,0,0,1],
  ],
};

// Precompute CRC32 table (PNG requires it)
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xFF];
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  const t   = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crcVal = Buffer.alloc(4);
  crcVal.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crcVal]);
}

function makePixels(size) {
  const GLYPH_W = 5, GLYPH_H = 7;
  const text = ['B', 'L', 'C', 'H'];
  const n = text.length;

  // scale so text fills ~72% of width; gap = 1 glyph-pixel between chars
  const targetW = Math.floor(size * 0.72);
  const scale   = Math.max(1, Math.floor(targetW / (n * GLYPH_W + (n - 1))));
  const gap     = scale;

  const totalW = n * GLYPH_W * scale + (n - 1) * gap;
  const totalH = GLYPH_H * scale;
  const startX = Math.floor((size - totalW) / 2);
  const startY = Math.floor((size - totalH) / 2);

  // RGBA buffer filled with background
  const buf = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    buf[i*4] = BG[0]; buf[i*4+1] = BG[1]; buf[i*4+2] = BG[2]; buf[i*4+3] = 255;
  }

  // Draw each glyph
  text.forEach((ch, ci) => {
    const glyph = GLYPHS[ch];
    const charX = startX + ci * (GLYPH_W * scale + gap);
    glyph.forEach((row, gy) => {
      row.forEach((on, gx) => {
        if (!on) return;
        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            const x = charX + gx * scale + dx;
            const y = startY + gy * scale + dy;
            if (x >= 0 && x < size && y >= 0 && y < size) {
              const idx = (y * size + x) * 4;
              buf[idx] = FG[0]; buf[idx+1] = FG[1]; buf[idx+2] = FG[2]; buf[idx+3] = 255;
            }
          }
        }
      });
    });
  });

  return buf;
}

function writePNG(filePath, size) {
  const pixels = makePixels(size);

  // Scanlines: filter byte 0 (None) + RGBA per pixel
  const stride = 1 + size * 4;
  const raw = Buffer.alloc(size * stride);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0; // filter None
    for (let x = 0; x < size; x++) {
      const src = (y * size + x) * 4;
      const dst = y * stride + 1 + x * 4;
      raw[dst] = pixels[src]; raw[dst+1] = pixels[src+1];
      raw[dst+2] = pixels[src+2]; raw[dst+3] = pixels[src+3];
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit depth, RGBA

  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);

  fs.writeFileSync(filePath, png);
  console.log(`✓ ${path.basename(filePath)} generado (${size}×${size})`);
}

writePNG(path.join(__dirname, 'public', 'icon-192.png'), 192);
writePNG(path.join(__dirname, 'public', 'icon-512.png'), 512);
