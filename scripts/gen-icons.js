const fs = require('fs');
const path = require('path');

// Minimal PNG generator that creates a teal-colored square with "O" in the middle
// (drawn using simple pixel-by-pixel — good enough for icon)
function createPNG(size, filename) {
  // For brevity, generate a minimal valid PNG using a small pre-encoded pattern.
  // We'll generate a simple solid teal PNG using zlib.
  const zlib = require('zlib');

  const width = size, height = size;
  const bg = [13, 148, 136]; // teal
  const fg = [255, 255, 255]; // white "O"

  // Raw pixel data (each row starts with filter byte 0)
  const rows = [];
  const cx = width / 2;
  const cy = height / 2;
  const outerR = width * 0.38;
  const innerR = width * 0.22;
  for (let y = 0; y < height; y++) {
    const row = [0];
    for (let x = 0; x < width; x++) {
      const dx = x - cx + 0.5;
      const dy = y - cy + 0.5;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist <= outerR && dist >= innerR) {
        row.push(...fg, 255);
      } else {
        row.push(...bg, 255);
      }
    }
    rows.push(Buffer.from(row));
  }
  const raw = Buffer.concat(rows);
  const compressed = zlib.deflateSync(raw);

  // PNG signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  function crc32(buf) {
    let c = ~0;
    for (let i = 0; i < buf.length; i++) {
      c ^= buf[i];
      for (let j = 0; j < 8; j++) {
        c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
      }
    }
    return ~c >>> 0;
  }

  function chunk(type, data) {
    const typeBuf = Buffer.from(type, 'ascii');
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const png = Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  fs.writeFileSync(filename, png);
}

createPNG(192, path.join('/home/z/my-project/public', 'icon-192.png'));
createPNG(512, path.join('/home/z/my-project/public', 'icon-512.png'));
console.log('icons generated');
