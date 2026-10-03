import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const settingsDir = path.resolve(__dirname, '../public/Settings');

if (!fs.existsSync(settingsDir)) {
  fs.mkdirSync(settingsDir, { recursive: true });
}

// Minimal pure-JS baseline JPEG encoder
function encodeJPEG(width, height, rgbBuffer, quality = 80) {
  // Clamp quality
  const q = Math.max(1, Math.min(100, quality));
  const scale = q < 50 ? Math.floor(5000 / q) : Math.floor(200 - q * 2);

  const stdLuminanceQuant = [
    16, 11, 10, 16, 24, 40, 51, 61,
    12, 12, 14, 19, 26, 58, 60, 55,
    14, 13, 16, 24, 40, 57, 69, 56,
    14, 17, 22, 29, 51, 87, 80, 62,
    18, 22, 37, 56, 68, 109, 103, 77,
    24, 35, 55, 64, 81, 104, 113, 92,
    49, 64, 78, 87, 103, 121, 120, 101,
    72, 92, 95, 98, 112, 100, 103, 99
  ];

  const stdChrominanceQuant = [
    17, 18, 24, 47, 99, 99, 99, 99,
    18, 21, 26, 66, 99, 99, 99, 99,
    24, 26, 56, 99, 99, 99, 99, 99,
    47, 66, 99, 99, 99, 99, 99, 99,
    99, 99, 99, 99, 99, 99, 99, 99,
    99, 99, 99, 99, 99, 99, 99, 99,
    99, 99, 99, 99, 99, 99, 99, 99,
    99, 99, 99, 99, 99, 99, 99, 99
  ];

  const lQuant = new Uint8Array(64);
  const cQuant = new Uint8Array(64);
  for (let i = 0; i < 64; i++) {
    lQuant[i] = Math.max(1, Math.min(255, Math.floor((stdLuminanceQuant[i] * scale + 50) / 100)));
    cQuant[i] = Math.max(1, Math.min(255, Math.floor((stdChrominanceQuant[i] * scale + 50) / 100)));
  }

  const zigzag = [
    0, 1, 5, 6, 14, 15, 27, 28,
    2, 4, 7, 13, 16, 26, 29, 42,
    3, 8, 12, 17, 25, 30, 41, 43,
    9, 11, 18, 24, 31, 40, 44, 53,
    10, 19, 23, 32, 39, 45, 52, 54,
    20, 22, 33, 38, 46, 51, 55, 60,
    21, 34, 37, 47, 50, 56, 59, 61,
    35, 36, 48, 49, 57, 58, 62, 63
  ];

  // Standard Huffman Tables
  const stdDcLumNR = [0, 1, 5, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0];
  const stdDcLumValues = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const stdDcChromNR = [0, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0];
  const stdDcChromValues = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

  const stdAcLumNR = [0, 2, 1, 3, 3, 2, 4, 3, 5, 5, 4, 4, 0, 0, 1, 0x7d];
  const stdAcLumValues = [
    0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12,
    0x21, 0x31, 0x41, 0x06, 0x13, 0x51, 0x61, 0x07,
    0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xa1, 0x08,
    0x23, 0x42, 0xb1, 0xc1, 0x15, 0x52, 0xd1, 0xf0,
    0x24, 0x33, 0x62, 0x72, 0x82, 0x09, 0x0a, 0x16,
    0x17, 0x18, 0x19, 0x1a, 0x25, 0x26, 0x27, 0x28,
    0x29, 0x2a, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39,
    0x3a, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49,
    0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59,
    0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69,
    0x6a, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79,
    0x7a, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89,
    0x8a, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98,
    0x99, 0x9a, 0xa2, 0xa3, 0xa4, 0xa5, 0xa6, 0xa7,
    0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6,
    0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3, 0xc4, 0xc5,
    0xc6, 0xc7, 0xc8, 0xc9, 0xca, 0xd2, 0xd3, 0xd4,
    0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xe1, 0xe2,
    0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea,
    0xf1, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8,
    0xf9, 0xfa
  ];

  const stdAcChromNR = [0, 2, 1, 2, 4, 4, 3, 4, 7, 5, 4, 4, 0, 1, 2, 0x77];
  const stdAcChromValues = [
    0x00, 0x01, 0x02, 0x03, 0x11, 0x04, 0x05, 0x21,
    0x31, 0x06, 0x12, 0x41, 0x51, 0x07, 0x61, 0x71,
    0x13, 0x22, 0x32, 0x81, 0x08, 0x14, 0x42, 0x91,
    0xa1, 0xb1, 0xc1, 0x09, 0x23, 0x33, 0x52, 0xf0,
    0x15, 0x62, 0x72, 0xd1, 0x0a, 0x16, 0x24, 0x34,
    0xe1, 0x25, 0xf1, 0x17, 0x18, 0x19, 0x1a, 0x26,
    0x27, 0x28, 0x29, 0x2a, 0x35, 0x36, 0x37, 0x38,
    0x39, 0x3a, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48,
    0x49, 0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58,
    0x59, 0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68,
    0x69, 0x6a, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78,
    0x79, 0x7a, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87,
    0x88, 0x89, 0x8a, 0x92, 0x93, 0x94, 0x95, 0x96,
    0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3, 0xa4, 0xa5,
    0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4,
    0xb5, 0xb6, 0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3,
    0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9, 0xca, 0xd2,
    0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda,
    0xe2, 0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9,
    0xea, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8,
    0xf9, 0xfa
  ];

  function computeHuffmanTbl(nrcodes, values) {
    let code = 0;
    const htbl = [];
    let p = 0;
    for (let i = 1; i <= 16; i++) {
      for (let j = 1; j <= nrcodes[i - 1]; j++) {
        htbl[values[p]] = { len: i, val: code };
        p++;
        code++;
      }
      code <<= 1;
    }
    return htbl;
  }

  const dcLumHtbl = computeHuffmanTbl(stdDcLumNR, stdDcLumValues);
  const dcChromHtbl = computeHuffmanTbl(stdDcChromNR, stdDcChromValues);
  const acLumHtbl = computeHuffmanTbl(stdAcLumNR, stdAcLumValues);
  const acChromHtbl = computeHuffmanTbl(stdAcChromNR, stdAcChromValues);

  // Bitstream writer
  const byteArr = [];
  let bitBuf = 0;
  let bitCnt = 0;

  function writeBits(bits, len) {
    bitBuf = (bitBuf << len) | bits;
    bitCnt += len;
    while (bitCnt >= 8) {
      const b = (bitBuf >> (bitCnt - 8)) & 0xff;
      byteArr.push(b);
      if (b === 0xff) byteArr.push(0x00);
      bitCnt -= 8;
    }
  }

  function flushBits() {
    if (bitCnt > 0) {
      const b = (bitBuf << (8 - bitCnt)) & 0xff;
      byteArr.push(b);
      if (b === 0xff) byteArr.push(0x00);
      bitBuf = 0;
      bitCnt = 0;
    }
  }

  function writeByte(b) {
    byteArr.push(b & 0xff);
  }

  function writeWord(w) {
    byteArr.push((w >> 8) & 0xff);
    byteArr.push(w & 0xff);
  }

  // Write JPEG Header
  writeWord(0xffd8); // SOI

  // APP0 (JFIF)
  writeWord(0xffe0);
  writeWord(16);
  writeByte(0x4a); writeByte(0x46); writeByte(0x49); writeByte(0x46); writeByte(0x00); // "JFIF\0"
  writeByte(1); writeByte(1); // v1.1
  writeByte(0); // units
  writeWord(1); writeWord(1); // density
  writeByte(0); writeByte(0); // thumbnail

  // DQT - Luminance
  writeWord(0xffdb);
  writeWord(67);
  writeByte(0);
  for (let i = 0; i < 64; i++) writeByte(lQuant[zigzag[i]]);

  // DQT - Chrominance
  writeWord(0xffdb);
  writeWord(67);
  writeByte(1);
  for (let i = 0; i < 64; i++) writeByte(cQuant[zigzag[i]]);

  // SOF0 (Baseline DCT)
  writeWord(0xffc0);
  writeWord(17);
  writeByte(8); // 8-bit precision
  writeWord(height);
  writeWord(width);
  writeByte(3); // 3 components (Y, Cb, Cr)
  writeByte(1); writeByte(0x11); writeByte(0); // Y: 1x1, Quant table 0
  writeByte(2); writeByte(0x11); writeByte(1); // Cb: 1x1, Quant table 1
  writeByte(3); writeByte(0x11); writeByte(1); // Cr: 1x1, Quant table 1

  // DHT Tables
  function writeDHT(tableId, nrcodes, values) {
    writeWord(0xffc4);
    let len = 3 + 16 + values.length;
    writeWord(len);
    writeByte(tableId);
    for (let i = 0; i < 16; i++) writeByte(nrcodes[i]);
    for (let i = 0; i < values.length; i++) writeByte(values[i]);
  }

  writeDHT(0x00, stdDcLumNR, stdDcLumValues);
  writeDHT(0x10, stdAcLumNR, stdAcLumValues);
  writeDHT(0x01, stdDcChromNR, stdDcChromValues);
  writeDHT(0x11, stdAcChromNR, stdAcChromValues);

  // SOS (Start of Scan)
  writeWord(0xffda);
  writeWord(12);
  writeByte(3);
  writeByte(1); writeByte(0x00);
  writeByte(2); writeByte(0x11);
  writeByte(3); writeByte(0x11);
  writeByte(0); writeByte(63); writeByte(0);

  // DCT transform matrices
  const fDCT = [];
  for (let u = 0; u < 8; u++) {
    for (let x = 0; x < 8; x++) {
      const alpha = u === 0 ? 1 / Math.sqrt(2) : 1;
      fDCT[u * 8 + x] = 0.5 * alpha * Math.cos(((2 * x + 1) * u * Math.PI) / 16);
    }
  }

  function forwardDCT(block) {
    const temp = new Float64Array(64);
    const out = new Int32Array(64);
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        let sum = 0;
        for (let k = 0; k < 8; k++) {
          sum += block[i * 8 + k] * fDCT[j * 8 + k];
        }
        temp[i * 8 + j] = sum;
      }
    }
    for (let j = 0; j < 8; j++) {
      for (let i = 0; i < 8; i++) {
        let sum = 0;
        for (let k = 0; k < 8; k++) {
          sum += temp[k * 8 + j] * fDCT[i * 8 + k];
        }
        out[i * 8 + j] = Math.round(sum);
      }
    }
    return out;
  }

  function processBlock(block, quantTbl, dcHtbl, acHtbl, prevDC) {
    const dct = forwardDCT(block);
    const qBlock = new Int32Array(64);
    for (let i = 0; i < 64; i++) {
      qBlock[i] = Math.round(dct[i] / quantTbl[i]);
    }

    // Encode DC
    const diff = qBlock[0] - prevDC;
    let nbits = 0;
    let temp = Math.abs(diff);
    while (temp > 0) {
      nbits++;
      temp >>= 1;
    }
    const dcEntry = dcHtbl[nbits];
    if (dcEntry) {
      writeBits(dcEntry.val, dcEntry.len);
      if (nbits > 0) {
        let val = diff < 0 ? diff + (1 << nbits) - 1 : diff;
        writeBits(val, nbits);
      }
    }

    // Encode AC
    let r = 0;
    for (let k = 1; k < 64; k++) {
      const val = qBlock[zigzag[k]];
      if (val === 0) {
        r++;
      } else {
        while (r > 15) {
          const zEntry = acHtbl[0xf0];
          writeBits(zEntry.val, zEntry.len);
          r -= 16;
        }
        let nbits = 0;
        let temp = Math.abs(val);
        while (temp > 0) {
          nbits++;
          temp >>= 1;
        }
        const acEntry = acHtbl[(r << 4) | nbits];
        if (acEntry) {
          writeBits(acEntry.val, acEntry.len);
          let bval = val < 0 ? val + (1 << nbits) - 1 : val;
          writeBits(bval, nbits);
        }
        r = 0;
      }
    }
    if (r > 0) {
      const eob = acHtbl[0x00];
      writeBits(eob.val, eob.len);
    }
    return qBlock[0];
  }

  let prevDCY = 0;
  let prevDCCb = 0;
  let prevDCCr = 0;

  const yBlock = new Float64Array(64);
  const cbBlock = new Float64Array(64);
  const crBlock = new Float64Array(64);

  for (let y = 0; y < height; y += 8) {
    for (let x = 0; x < width; x += 8) {
      for (let by = 0; by < 8; by++) {
        for (let bx = 0; bx < 8; bx++) {
          const px = Math.min(width - 1, x + bx);
          const py = Math.min(height - 1, y + by);
          const idx = (py * width + px) * 3;
          const r = rgbBuffer[idx];
          const g = rgbBuffer[idx + 1];
          const b = rgbBuffer[idx + 2];

          // RGB to YCbCr conversion
          const Y = 0.299 * r + 0.587 * g + 0.114 * b - 128;
          const Cb = -0.168736 * r - 0.331264 * g + 0.5 * b;
          const Cr = 0.5 * r - 0.418688 * g - 0.081312 * b;

          const bIdx = by * 8 + bx;
          yBlock[bIdx] = Y;
          cbBlock[bIdx] = Cb;
          crBlock[bIdx] = Cr;
        }
      }

      prevDCY = processBlock(yBlock, lQuant, dcLumHtbl, acLumHtbl, prevDCY);
      prevDCCb = processBlock(cbBlock, cQuant, dcChromHtbl, acChromHtbl, prevDCCb);
      prevDCCr = processBlock(crBlock, cQuant, dcChromHtbl, acChromHtbl, prevDCCr);
    }
  }

  flushBits();
  writeWord(0xffd9); // EOI

  return Buffer.from(byteArr);
}

// Draw room scenes into RGB buffers
const W = 960;
const H = 540;

function createBuffer(w, h, fillRGB = [30, 35, 45]) {
  const buf = new Uint8Array(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    buf[i * 3] = fillRGB[0];
    buf[i * 3 + 1] = fillRGB[1];
    buf[i * 3 + 2] = fillRGB[2];
  }
  return buf;
}

function fillRect(buf, w, h, rx, ry, rw, rh, rgb) {
  const x0 = Math.max(0, Math.floor(rx));
  const y0 = Math.max(0, Math.floor(ry));
  const x1 = Math.min(w, Math.floor(rx + rw));
  const y1 = Math.min(h, Math.floor(ry + rh));
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const idx = (y * w + x) * 3;
      buf[idx] = rgb[0];
      buf[idx + 1] = rgb[1];
      buf[idx + 2] = rgb[2];
    }
  }
}

function fillGradientV(buf, w, h, rx, ry, rw, rh, topRGB, bottomRGB) {
  const x0 = Math.max(0, Math.floor(rx));
  const y0 = Math.max(0, Math.floor(ry));
  const x1 = Math.min(w, Math.floor(rx + rw));
  const y1 = Math.min(h, Math.floor(ry + rh));
  const span = Math.max(1, y1 - y0);
  for (let y = y0; y < y1; y++) {
    const t = (y - y0) / span;
    const r = Math.round(topRGB[0] * (1 - t) + bottomRGB[0] * t);
    const g = Math.round(topRGB[1] * (1 - t) + bottomRGB[1] * t);
    const b = Math.round(topRGB[2] * (1 - t) + bottomRGB[2] * t);
    for (let x = x0; x < x1; x++) {
      const idx = (y * w + x) * 3;
      buf[idx] = r;
      buf[idx + 1] = g;
      buf[idx + 2] = b;
    }
  }
}

// 1. Washing Machine Room (Laundry Utility Suite)
// Keep existing media_1791049898243.jpg or generate clean laundry scene if missing
const userUploadImg = 'C:/Users/karti/.gemini/antigravity-ide/brain/f22b9b17-81f4-4a32-9f34-1ebb7d7a0c12/.user_uploaded/media_1791049898243.jpg';
if (fs.existsSync(userUploadImg)) {
  fs.copyFileSync(userUploadImg, path.join(settingsDir, 'washing_machine.jpg'));
} else {
  const wmBuf = createBuffer(W, H);
  fillGradientV(wmBuf, W, H, 0, 0, W, H * 0.7, [55, 65, 80], [80, 95, 115]); // Wall
  fillGradientV(wmBuf, W, H, 0, H * 0.7, W, H * 0.3, [110, 100, 90], [70, 60, 50]); // Floor
  fillRect(wmBuf, W, H, W * 0.75, H * 0.5, W * 0.2, H * 0.42, [235, 240, 245]); // Washing machine body
  fillRect(wmBuf, W, H, W * 0.78, H * 0.58, W * 0.14, H * 0.26, [45, 55, 68]); // Drum door
  fs.writeFileSync(path.join(settingsDir, 'washing_machine.jpg'), encodeJPEG(W, H, wmBuf));
}

// 2. Television Entertainment Room (Modern Lounge)
const tvBuf = createBuffer(W, H);
// Deep navy acoustic wall
fillGradientV(tvBuf, W, H, 0, 0, W, H * 0.72, [22, 28, 45], [38, 46, 68]);
// Dark oak hardwood flooring
fillGradientV(tvBuf, W, H, 0, H * 0.72, W, H * 0.28, [75, 50, 35], [45, 30, 20]);
// Large media wall panel
fillRect(tvBuf, W, H, W * 0.05, H * 0.08, W * 0.9, H * 0.6, [28, 34, 52]);
// Big OLED TV (Left side matching det_tv_01 box: [0.28, 0.03, 0.88, 0.16] / full width screen)
fillRect(tvBuf, W, H, W * 0.03, H * 0.18, W * 0.38, H * 0.46, [12, 14, 20]); // TV frame
fillRect(tvBuf, W, H, W * 0.04, H * 0.20, W * 0.36, H * 0.42, [24, 38, 58]); // Screen glow
// Floating media console
fillRect(tvBuf, W, H, W * 0.02, H * 0.66, W * 0.42, H * 0.08, [120, 85, 55]);
// Modern Sofa on right
fillRect(tvBuf, W, H, W * 0.48, H * 0.52, W * 0.46, H * 0.30, [180, 160, 140]);
fillRect(tvBuf, W, H, W * 0.52, H * 0.44, W * 0.38, H * 0.14, [160, 140, 120]);
fs.writeFileSync(path.join(settingsDir, 'television.jpg'), encodeJPEG(W, H, tvBuf));

// 3. Refrigerator Kitchen Room (Gourmet Kitchen Suite)
const fridgeBuf = createBuffer(W, H);
// White marble tile wall
fillGradientV(fridgeBuf, W, H, 0, 0, W, H * 0.68, [215, 222, 230], [185, 195, 205]);
// Grey polished porcelain floor
fillGradientV(fridgeBuf, W, H, 0, H * 0.68, W, H * 0.32, [140, 145, 155], [105, 110, 120]);
// Kitchen upper cabinets
fillRect(fridgeBuf, W, H, W * 0.02, H * 0.04, W * 0.96, H * 0.18, [50, 62, 78]);
// Double-door Smart Refrigerator (Left side matching det_refrigerator_01: [0.24, 0.16, 0.69, 0.39])
fillRect(fridgeBuf, W, H, W * 0.15, H * 0.22, W * 0.25, H * 0.50, [195, 200, 210]); // Stainless steel body
fillRect(fridgeBuf, W, H, W * 0.16, H * 0.24, W * 0.11, H * 0.32, [225, 230, 238]); // Left door
fillRect(fridgeBuf, W, H, W * 0.28, H * 0.24, W * 0.11, H * 0.32, [225, 230, 238]); // Right door
fillRect(fridgeBuf, W, H, W * 0.30, H * 0.30, W * 0.07, H * 0.14, [30, 40, 55]); // Smart screen panel
fillRect(fridgeBuf, W, H, W * 0.16, H * 0.58, W * 0.23, H * 0.12, [210, 215, 225]); // Freezer drawer
// Kitchen Island on right
fillRect(fridgeBuf, W, H, W * 0.52, H * 0.48, W * 0.44, H * 0.32, [240, 242, 245]);
fillRect(fridgeBuf, W, H, W * 0.50, H * 0.46, W * 0.48, H * 0.06, [45, 52, 65]);
fs.writeFileSync(path.join(settingsDir, 'refrigerator.jpg'), encodeJPEG(W, H, fridgeBuf));

// 4. Microwave Studio Kitchen Counter
const microBuf = createBuffer(W, H);
// Warm terracotta/sage kitchen wall
fillGradientV(microBuf, W, H, 0, 0, W, H * 0.65, [140, 160, 150], [115, 135, 125]);
// Terracotta tiled floor
fillGradientV(microBuf, W, H, 0, H * 0.65, W, H * 0.35, [160, 95, 75], [125, 70, 55]);
// Quartz countertop
fillRect(microBuf, W, H, W * 0.10, H * 0.48, W * 0.85, H * 0.32, [230, 228, 222]);
fillRect(microBuf, W, H, W * 0.08, H * 0.46, W * 0.89, H * 0.05, [245, 243, 238]);
// Microwave Oven (Center-right matching det_microwave_01: [0.60, 0.26, 0.83, 0.41])
fillRect(microBuf, W, H, W * 0.25, H * 0.26, W * 0.22, H * 0.20, [42, 45, 52]); // Dark stainless housing
fillRect(microBuf, W, H, W * 0.27, H * 0.28, W * 0.14, H * 0.16, [20, 25, 32]); // Window
fillRect(microBuf, W, H, W * 0.42, H * 0.28, W * 0.04, H * 0.16, [65, 70, 80]); // Keypad / dial
fs.writeFileSync(path.join(settingsDir, 'microwave.jpg'), encodeJPEG(W, H, microBuf));

console.log('Distinct room wallpaper JPEGs successfully created in public/Settings/');
