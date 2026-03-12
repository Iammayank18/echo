const { nativeImage } = require('electron');
const zlib = require('zlib');

function crc32(buf) {
  let crc = 0xffffffff;
  const table = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuffer = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeBuffer, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcData));
  return Buffer.concat([len, typeBuffer, data, crc]);
}

function createPNG(width, height, pixels) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // standard filter
  ihdr[12] = 0; // no interlace

  const rawData = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    rawData[y * (1 + width * 4)] = 0; // no filter
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      const dstIdx = y * (1 + width * 4) + 1 + x * 4;
      rawData[dstIdx] = pixels[srcIdx];
      rawData[dstIdx + 1] = pixels[srcIdx + 1];
      rawData[dstIdx + 2] = pixels[srcIdx + 2];
      rawData[dstIdx + 3] = pixels[srcIdx + 3];
    }
  }

  const compressed = zlib.deflateSync(rawData);
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function createTrayIcon(isRecording, isTranscribing) {
  const size = 32; // @2x for retina
  const pixels = Buffer.alloc(size * size * 4, 0);

  function setPixel(x, y, alpha) {
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    const idx = (y * size + x) * 4;
    pixels[idx] = 0;
    pixels[idx + 1] = 0;
    pixels[idx + 2] = 0;
    pixels[idx + 3] = alpha;
  }

  function fillRect(x1, y1, x2, y2, alpha = 255) {
    for (let y = y1; y <= y2; y++) {
      for (let x = x1; x <= x2; x++) {
        setPixel(x, y, alpha);
      }
    }
  }

  function fillCircle(cx, cy, r, alpha = 255) {
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) {
          setPixel(x, y, alpha);
        }
      }
    }
  }

  if (isRecording) {
    fillCircle(16, 16, 8);
  } else if (isTranscribing) {
    fillCircle(9, 16, 3);
    fillCircle(16, 16, 3);
    fillCircle(23, 16, 3);
  } else {
    const bars = [
      { x: 6, h: 10 },
      { x: 11, h: 16 },
      { x: 16, h: 22 },
      { x: 21, h: 16 },
      { x: 26, h: 10 },
    ];
    for (const bar of bars) {
      const top = Math.floor((size - bar.h) / 2);
      fillRect(bar.x - 1, top, bar.x, top + bar.h - 1);
    }
  }

  const pngBuffer = createPNG(size, size, pixels);
  const img = nativeImage.createFromBuffer(pngBuffer, {
    width: 16,
    height: 16,
    scaleFactor: 2.0,
  });
  img.setTemplateImage(true);
  return img;
}

module.exports = { createTrayIcon };
