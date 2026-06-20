/**
 * 生成 PWA 图标(纯 Node,无外部依赖)
 * 用最小 PNG 编码器生成 192/512 图标:墨底 + 金色剑形 + 文字
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  // 每行加 filter byte
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

function drawIcon(size) {
  const buf = Buffer.alloc(size * size * 4);
  const set = (x, y, r, g, b, a = 255) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = a;
  };
  // 背景径向渐变(墨色)
  const cx = size / 2, cy = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - cx, y - cy) / (size / 2);
      const t = Math.min(1, d);
      const r = Math.floor(10 + t * 8), g = Math.floor(10 + t * 6), b = Math.floor(18 + t * 10);
      set(x, y, r, g, b);
    }
  }
  // 金色剑(竖向)
  const gold = (a = 255) => set.bind(null);
  const swordW = Math.max(2, Math.floor(size * 0.035));
  const swordH = Math.floor(size * 0.55);
  const sx = Math.floor(cx), sy0 = Math.floor(cy - swordH / 2);
  for (let y = 0; y < swordH; y++) {
    const yy = sy0 + y;
    // 剑身宽度随位置变化(中间宽,两端尖)
    const taper = Math.sin((y / swordH) * Math.PI);
    const w = Math.max(1, Math.floor(swordW * (0.4 + taper * 0.6)));
    for (let dx = -w; dx <= w; dx++) {
      const r = 220 + Math.floor(Math.random() * 35);
      const g = 180 + Math.floor(Math.random() * 40);
      const b = 90 + Math.floor(Math.random() * 40);
      set(sx + dx, yy, r, g, b);
    }
  }
  // 剑格(横条)
  const guardW = Math.floor(size * 0.12);
  const guardY = sy0 + Math.floor(swordH * 0.7);
  for (let dx = -guardW; dx <= guardW; dx++) {
    for (let dy = -Math.floor(swordW * 0.8); dy <= Math.floor(swordW * 0.8); dy++) {
      set(sx + dx, guardY + dy, 200, 165, 80);
    }
  }
  // 剑柄
  const hiltH = Math.floor(size * 0.1);
  for (let y = 0; y < hiltH; y++) {
    for (let dx = -Math.floor(swordW * 0.5); dx <= Math.floor(swordW * 0.5); dx++) {
      set(sx + dx, guardY + swordW + y, 140, 100, 50);
    }
  }
  // 外圈金边
  const ringR = size * 0.46;
  for (let a = 0; a < Math.PI * 2; a += 0.01) {
    const x = Math.floor(cx + Math.cos(a) * ringR);
    const y = Math.floor(cy + Math.sin(a) * ringR);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) set(x + dx, y + dy, 201, 176, 114);
  }
  return encodePNG(size, size, buf);
}

mkdirSync('./public/icons', { recursive: true });
writeFileSync('./public/icons/icon-192.png', drawIcon(192));
writeFileSync('./public/icons/icon-512.png', drawIcon(512));
console.log('icons generated');
