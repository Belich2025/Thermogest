// Generates public/icon-192.png and public/icon-512.png
// Blue #1d4ed8 background with white "TG" block letters
const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

const T_GLYPH = [
  [1,1,1,1,1,1],
  [0,0,1,1,0,0],
  [0,0,1,1,0,0],
  [0,0,1,1,0,0],
  [0,0,1,1,0,0],
  [0,0,1,1,0,0],
  [0,0,1,1,0,0],
];

const G_GLYPH = [
  [0,1,1,1,1,0],
  [1,0,0,0,0,0],
  [1,0,0,0,0,0],
  [1,0,1,1,1,1],
  [1,0,0,0,0,1],
  [1,0,0,0,0,1],
  [0,1,1,1,1,0],
];

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) crc = (crc & 1) ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const t   = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crcBuf]);
}

function createPNG(size) {
  const pixels = Buffer.alloc(size * size * 3);
  for (let i = 0; i < size * size; i++) {
    pixels[i * 3] = 29; pixels[i * 3 + 1] = 78; pixels[i * 3 + 2] = 216;
  }

  const rows = 7, cols = 6;
  const glyphH = Math.floor(size * 0.50);
  const glyphW = Math.floor(glyphH * cols / rows);
  const gap    = Math.floor(size * 0.06);
  const startX = Math.floor((size - glyphW * 2 - gap) / 2);
  const startY = Math.floor((size - glyphH) / 2);

  function draw(glyph, offX) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!glyph[r][c]) continue;
        const x0 = offX + Math.floor(c * glyphW / cols);
        const y0 = startY + Math.floor(r * glyphH / rows);
        const x1 = offX + Math.floor((c + 1) * glyphW / cols);
        const y1 = startY + Math.floor((r + 1) * glyphH / rows);
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
          if (x >= 0 && x < size && y >= 0 && y < size) {
            const idx = (y * size + x) * 3;
            pixels[idx] = 255; pixels[idx + 1] = 255; pixels[idx + 2] = 255;
          }
        }
      }
    }
  }

  draw(T_GLYPH, startX);
  draw(G_GLYPH, startX + glyphW + gap);

  const scanlines = Buffer.alloc(size * (1 + size * 3));
  for (let y = 0; y < size; y++) {
    scanlines[y * (1 + size * 3)] = 0;
    pixels.copy(scanlines, y * (1 + size * 3) + 1, y * size * 3, (y + 1) * size * 3);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', zlib.deflateSync(scanlines)),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

fs.writeFileSync(path.join(__dirname, 'public', 'icon-192.png'), createPNG(192));
fs.writeFileSync(path.join(__dirname, 'public', 'icon-512.png'), createPNG(512));
console.log('icon-192.png y icon-512.png creados en public/');
