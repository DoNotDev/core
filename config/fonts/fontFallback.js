/**
 * @fileoverview Size-matched fallback faces for framework web fonts (CLS-free swap)
 * @description A web font with `font-display: swap` first renders in the next family of
 * the stack, then swaps: when the two fonts differ in width and vertical metrics, text
 * re-wraps and the page shifts (CLS). A fallback face is a local system font (Arial,
 * or Times New Roman for serif families) scaled with `size-adjust` and given the web
 * font's ascent / descent / line gap, so both render in the same box.
 *
 * Same technique and formulas as next/font/local (Next.js `getFallbackMetricsFromFontFile`,
 * https://developer.chrome.com/blog/font-fallbacks/): the web font's metrics are read
 * from its woff2 file (head, hhea, cmap, hmtx), the system fonts' from the constants
 * below. Stacks list the face right after the web font (`Inter, 'Inter Fallback', …`,
 * packages/components/src/styles/variables.css).
 */

import { brotliDecompressSync } from 'node:zlib';

/**
 * Characters averaged for the width ratio: Latin letters weighted by frequency, plus
 * spaces for word length. Same string as next/font/local (calcAverageWidth).
 */
const AVG_WIDTH_CHARACTERS = 'aaabcdeeeefghiijklmnnoopqrrssttuvwxyz      ';

/**
 * System fallback fonts. azAvgWidth: mean advance width of AVG_WIDTH_CHARACTERS, in
 * font units. Values from next/font/local (DEFAULT_SANS_SERIF_FONT /
 * DEFAULT_SERIF_FONT, "retrieved with fontkit on system font files"). The Liberation
 * fonts are metric-compatible clones (same advance widths), for systems without the
 * Microsoft fonts (Linux); the face's overrides set the vertical metrics for both.
 */
const SYSTEM_FALLBACK_FONTS = {
  'sans-serif': {
    locals: ['Arial', 'Liberation Sans'],
    azAvgWidth: 934.5116279069767,
    unitsPerEm: 2048,
  },
  serif: {
    locals: ['Times New Roman', 'Liberation Serif'],
    azAvgWidth: 854.3953488372093,
    unitsPerEm: 2048,
  },
};

/** woff2 known-table index → tag (only the tables read here). */
const WOFF2_KNOWN_TAGS = { 0: 'cmap', 1: 'head', 2: 'hhea', 3: 'hmtx' };
/** Tag index meaning "arbitrary tag follows". */
const WOFF2_ARBITRARY_TAG = 63;
const WOFF2_HEADER_SIZE = 48;
const WOFF2_SIGNATURE = 0x774f4632; // 'wOF2'

/**
 * Read a woff2 UIntBase128.
 * @param {Buffer} buf
 * @param {number} offset
 * @returns {[number, number]} value, next offset
 */
function readBase128(buf, offset) {
  let value = 0;
  for (let i = 0; i < 5; i++) {
    const byte = buf[offset + i];
    value = value * 128 + (byte & 0x7f);
    if ((byte & 0x80) === 0) return [value, offset + i + 1];
  }
  throw new Error('woff2: invalid UIntBase128');
}

/**
 * Decompressed sfnt tables of a woff2 file, by tag. glyf/loca and a transformed hmtx
 * keep their woff2 transform (readFontMetrics reads only advance widths of hmtx, which
 * lead both encodings).
 *
 * @param {Buffer} buf - woff2 file
 * @returns {Map<string, {data: Buffer, transformed: boolean}>}
 * @throws {Error} When the buffer is not a single-font woff2
 */
function readWoff2Tables(buf) {
  if (buf.length < WOFF2_HEADER_SIZE || buf.readUInt32BE(0) !== WOFF2_SIGNATURE) {
    throw new Error('woff2: bad signature');
  }
  if (buf.readUInt32BE(4) === 0x74746366) {
    throw new Error('woff2: font collections are not supported');
  }
  const numTables = buf.readUInt16BE(12);
  const totalCompressedSize = buf.readUInt32BE(20);

  let offset = WOFF2_HEADER_SIZE;
  const entries = [];
  for (let i = 0; i < numTables; i++) {
    const flags = buf[offset++];
    const tagIndex = flags & 0x3f;
    const transformVersion = flags >> 6;
    let tag = WOFF2_KNOWN_TAGS[tagIndex] ?? `#${tagIndex}`;
    if (tagIndex === WOFF2_ARBITRARY_TAG) {
      tag = buf.toString('latin1', offset, offset + 4);
      offset += 4;
    }
    let origLength;
    [origLength, offset] = readBase128(buf, offset);
    // glyf (10) / loca (11): version 0 = transformed; other tables: version 0 = none
    const transformed =
      tagIndex === 10 || tagIndex === 11
        ? transformVersion !== 3
        : transformVersion !== 0;
    let length = origLength;
    if (transformed) [length, offset] = readBase128(buf, offset);
    entries.push({ tag, length, transformed });
  }

  const stream = brotliDecompressSync(
    buf.subarray(offset, offset + totalCompressedSize)
  );
  const tables = new Map();
  let position = 0;
  for (const { tag, length, transformed } of entries) {
    tables.set(tag, {
      data: stream.subarray(position, position + length),
      transformed,
    });
    position += length;
  }
  return tables;
}

/**
 * Glyph id lookup from a cmap table (format 4 or 12 subtable, Unicode encodings).
 * @param {Buffer} cmap
 * @returns {(codePoint: number) => number} Glyph id (0 = missing)
 */
function cmapLookup(cmap) {
  const numTables = cmap.readUInt16BE(2);
  const subtables = [];
  for (let i = 0; i < numTables; i++) {
    const record = 4 + i * 8;
    const platformId = cmap.readUInt16BE(record);
    const encodingId = cmap.readUInt16BE(record + 2);
    const offset = cmap.readUInt32BE(record + 4);
    const unicode =
      platformId === 0 || (platformId === 3 && (encodingId === 1 || encodingId === 10));
    if (unicode) subtables.push({ offset, format: cmap.readUInt16BE(offset) });
  }
  const table =
    subtables.find((t) => t.format === 12) ?? subtables.find((t) => t.format === 4);
  if (!table) throw new Error('font: no Unicode cmap (format 4 or 12)');
  const base = table.offset;

  if (table.format === 12) {
    const numGroups = cmap.readUInt32BE(base + 12);
    return (codePoint) => {
      for (let g = 0; g < numGroups; g++) {
        const group = base + 16 + g * 12;
        const start = cmap.readUInt32BE(group);
        const end = cmap.readUInt32BE(group + 4);
        if (codePoint >= start && codePoint <= end) {
          return cmap.readUInt32BE(group + 8) + (codePoint - start);
        }
      }
      return 0;
    };
  }

  const segCount = cmap.readUInt16BE(base + 6) / 2;
  const endCodes = base + 14;
  const startCodes = endCodes + segCount * 2 + 2;
  const idDeltas = startCodes + segCount * 2;
  const idRangeOffsets = idDeltas + segCount * 2;
  return (codePoint) => {
    for (let s = 0; s < segCount; s++) {
      if (codePoint > cmap.readUInt16BE(endCodes + s * 2)) continue;
      const start = cmap.readUInt16BE(startCodes + s * 2);
      if (codePoint < start) return 0;
      const delta = cmap.readInt16BE(idDeltas + s * 2);
      const rangeOffsetPos = idRangeOffsets + s * 2;
      const rangeOffset = cmap.readUInt16BE(rangeOffsetPos);
      if (rangeOffset === 0) return (codePoint + delta) & 0xffff;
      const glyph = cmap.readUInt16BE(
        rangeOffsetPos + rangeOffset + (codePoint - start) * 2
      );
      return glyph === 0 ? 0 : (glyph + delta) & 0xffff;
    }
    return 0;
  };
}

/**
 * Metrics of a woff2 font: unitsPerEm (head), ascent / descent / lineGap (hhea, as
 * fontkit and next/font read them) and azAvgWidth, the mean advance width of
 * AVG_WIDTH_CHARACTERS (cmap + hmtx).
 *
 * @param {Buffer} woff2 - woff2 file
 * @returns {{unitsPerEm: number, ascent: number, descent: number, lineGap: number, azAvgWidth: number}}
 * @throws {Error} When the file is not a woff2 font or lacks a Latin letter
 */
export function readFontMetrics(woff2) {
  const tables = readWoff2Tables(woff2);
  for (const tag of ['head', 'hhea', 'hmtx', 'cmap']) {
    if (!tables.has(tag)) throw new Error(`font: missing ${tag} table`);
  }
  const head = tables.get('head').data;
  const hhea = tables.get('hhea').data;
  const hmtx = tables.get('hmtx');
  const numberOfHMetrics = hhea.readUInt16BE(34);
  // Untransformed hmtx: {advanceWidth, lsb} pairs. Transformed: flags byte, then the
  // advanceWidth array.
  const advanceWidth = (glyphId) => {
    const index = Math.min(glyphId, numberOfHMetrics - 1);
    return hmtx.transformed
      ? hmtx.data.readUInt16BE(1 + index * 2)
      : hmtx.data.readUInt16BE(index * 4);
  };
  const glyphOf = cmapLookup(tables.get('cmap').data);

  let totalWidth = 0;
  for (const character of AVG_WIDTH_CHARACTERS) {
    const glyphId = glyphOf(character.codePointAt(0));
    if (glyphId === 0) {
      throw new Error(`font: no glyph for '${character}'`);
    }
    totalWidth += advanceWidth(glyphId);
  }

  return {
    unitsPerEm: head.readUInt16BE(18),
    ascent: hhea.readInt16BE(4),
    descent: hhea.readInt16BE(6),
    lineGap: hhea.readInt16BE(8),
    azAvgWidth: totalWidth / AVG_WIDTH_CHARACTERS.length,
  };
}

/** next/font's formatOverrideValue. */
const percent = (value) => `${Math.abs(value * 100).toFixed(2)}%`;

/**
 * Name of the fallback face of a family, listed right after it in font stacks.
 * @param {string} family - Web font family (e.g. 'Inter')
 * @returns {string} e.g. 'Inter Fallback'
 */
export function fallbackFamilyName(family) {
  return `${family} Fallback`;
}

/**
 * `@font-face` rule of a family's size-matched fallback face (next/font/local formulas).
 *
 * @param {Object} params
 * @param {string} params.family - Web font family (e.g. 'Inter')
 * @param {'sans-serif'|'serif'} params.category - Picks the system font (Arial / Times New Roman)
 * @param {ReturnType<typeof readFontMetrics>} params.metrics - The web font's metrics
 * @returns {string} CSS rule
 */
export function fallbackFontFace({ family, category, metrics }) {
  const system = SYSTEM_FALLBACK_FONTS[category];
  if (!system) throw new Error(`font fallback: unknown category '${category}'`);
  const { unitsPerEm, ascent, descent, lineGap, azAvgWidth } = metrics;
  const sizeAdjust =
    azAvgWidth / unitsPerEm / (system.azAvgWidth / system.unitsPerEm);
  const scaled = (value) => percent(value / (unitsPerEm * sizeAdjust));
  const name = fallbackFamilyName(family);
  return [
    `/* ${name}: ${system.locals[0]} size-matched to ${family} */`,
    '@font-face {',
    `  font-family: '${name}';`,
    `  src: ${system.locals.map((local) => `local('${local}')`).join(', ')};`,
    `  ascent-override: ${scaled(ascent)};`,
    `  descent-override: ${scaled(descent)};`,
    `  line-gap-override: ${scaled(lineGap)};`,
    `  size-adjust: ${percent(sizeAdjust)};`,
    '}',
  ].join('\n');
}
