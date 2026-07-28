/* ============================================================
   qr.js — tiny self-contained QR code generator.

   Byte mode, error-correction level M, versions 1-6 (up to 106
   bytes of data — plenty for a URL), fixed mask pattern 0.
   Exposes window.makeQrSvg(text, sizePx) -> SVG markup string.

   No dependencies; used by index.html to show a scan-to-open QR
   for the site itself.
   ============================================================ */

(function () {
  'use strict';

  // ---- GF(256) arithmetic (polynomial 0x11D) for Reed-Solomon ----
  const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x; LOG[x] = i;
    x <<= 1; if (x & 0x100) x ^= 0x11D;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  const gmul = (a, b) => (a && b) ? EXP[LOG[a] + LOG[b]] : 0;

  // Monic generator polynomial of the given degree, coefficients in
  // descending order of power (index 0 is x^degree).
  function rsGeneratorPoly(degree) {
    let poly = [1];
    for (let i = 0; i < degree; i++) {
      const next = new Array(poly.length + 1).fill(0);
      for (let j = 0; j < poly.length; j++) {
        next[j] ^= poly[j];                    // x * poly
        next[j + 1] ^= gmul(poly[j], EXP[i]);  // α^i * poly
      }
      poly = next;
    }
    return poly;
  }

  // Remainder of data(x)·x^degree divided by the generator poly.
  function rsEncode(data, degree) {
    const gen = rsGeneratorPoly(degree);
    const res = new Uint8Array(degree);
    for (const d of data) {
      const factor = d ^ res[0];
      res.copyWithin(0, 1);
      res[degree - 1] = 0;
      if (factor) for (let i = 0; i < degree; i++) res[i] ^= gmul(gen[i + 1], factor);
    }
    return res;
  }

  // Version -> [total data codewords, ecc codewords per block, block count]
  // for error-correction level M (equal-sized blocks for v1-6).
  const VER_M = {
    1: [16, 10, 1],
    2: [28, 16, 1],
    3: [44, 26, 1],
    4: [64, 18, 2],
    5: [86, 24, 2],
    6: [108, 16, 4],
  };

  function chooseVersion(byteLen) {
    for (let v = 1; v <= 6; v++) {
      // mode (4 bits) + length (8 bits) fits in 2 codewords
      if (VER_M[v][0] - 2 >= byteLen) return v;
    }
    throw new Error('qr: data too long (' + byteLen + ' bytes, max 106)');
  }

  function buildCodewords(bytes, ver) {
    const [dataCw, eccPerBlock, blocks] = VER_M[ver];

    // bit stream: mode 0100, 8-bit length, data, terminator, padding
    const bits = [];
    const push = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    push(4, 4);
    push(bytes.length, 8);
    for (const b of bytes) push(b, 8);
    push(0, Math.min(4, dataCw * 8 - bits.length));
    while (bits.length % 8) bits.push(0);
    const data = [];
    for (let i = 0; i < bits.length; i += 8) {
      let b = 0;
      for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
      data.push(b);
    }
    for (let pad = 0xEC; data.length < dataCw; pad ^= 0xEC ^ 0x11) data.push(pad);

    // split into equal blocks, compute ECC, interleave
    const per = dataCw / blocks;
    const dataBlocks = [], eccBlocks = [];
    for (let b = 0; b < blocks; b++) {
      const chunk = data.slice(b * per, (b + 1) * per);
      dataBlocks.push(chunk);
      eccBlocks.push(rsEncode(chunk, eccPerBlock));
    }
    const out = [];
    for (let i = 0; i < per; i++) for (const bl of dataBlocks) out.push(bl[i]);
    for (let i = 0; i < eccPerBlock; i++) for (const bl of eccBlocks) out.push(bl[i]);
    return out;
  }

  function buildMatrix(codewords, ver) {
    const size = 17 + 4 * ver;
    const mod = [], fun = [];
    for (let i = 0; i < size; i++) { mod.push(new Array(size).fill(false)); fun.push(new Array(size).fill(false)); }
    const set = (c, r, dark) => { mod[r][c] = dark; fun[r][c] = true; };

    // finder patterns + separators (drawn as clipped 9x9)
    for (const [fc, fr] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
      for (let dr = -4; dr <= 4; dr++) for (let dc = -4; dc <= 4; dc++) {
        const c = fc + dc, r = fr + dr;
        if (c < 0 || c >= size || r < 0 || r >= size) continue;
        const dist = Math.max(Math.abs(dc), Math.abs(dr));
        set(c, r, dist !== 2 && dist !== 4);
      }
    }

    // timing patterns
    for (let i = 0; i < size; i++) {
      if (!fun[6][i]) set(i, 6, i % 2 === 0);
      if (!fun[i][6]) set(6, i, i % 2 === 0);
    }

    // single alignment pattern for versions 2-6
    if (ver >= 2) {
      const cc = size - 7;
      for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
        set(cc + dc, cc + dr, Math.max(Math.abs(dc), Math.abs(dr)) !== 1);
      }
    }

    // format info: ECC M (bits 00) + mask 0, BCH(15,5), masked with 0x5412
    const fmtData = 0; // (M=00 << 3) | mask 0
    let rem = fmtData;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const fmt = ((fmtData << 10) | rem) ^ 0x5412;
    const fbit = (i) => ((fmt >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) set(8, i, fbit(i));
    set(8, 7, fbit(6));
    set(8, 8, fbit(7));
    set(7, 8, fbit(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, fbit(i));
    for (let i = 0; i <= 7; i++) set(size - 1 - i, 8, fbit(i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, fbit(i));
    set(8, size - 8, true); // dark module

    // data bits, zigzag from the bottom-right, then mask 0
    const bits = [];
    for (const cw of codewords) for (let i = 7; i >= 0; i--) bits.push((cw >>> i) & 1);
    let bi = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) {
        for (let j = 0; j < 2; j++) {
          const c = right - j;
          const upward = ((right + 1) & 2) === 0;
          const r = upward ? size - 1 - vert : vert;
          if (!fun[r][c] && bi < bits.length) {
            mod[r][c] = bits[bi] === 1;
            bi++;
          }
        }
      }
    }
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
      if (!fun[r][c] && (r + c) % 2 === 0) mod[r][c] = !mod[r][c];
    }
    return mod;
  }

  // ---- Public API ----
  function makeQrSvg(text, sizePx) {
    const bytes = Array.from(new TextEncoder().encode(String(text)));
    const ver = chooseVersion(bytes.length);
    const m = buildMatrix(buildCodewords(bytes, ver), ver);
    const n = m.length, quiet = 4, total = n + quiet * 2;
    let rects = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      if (m[r][c]) rects += `<rect x="${c + quiet}" y="${r + quiet}" width="1" height="1"/>`;
    }
    const px = sizePx || 128;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${px}" height="${px}" shape-rendering="crispEdges" role="img">` +
      `<rect width="${total}" height="${total}" fill="#fff"/><g fill="#000">${rects}</g></svg>`;
  }

  window.makeQrSvg = makeQrSvg;
})();
