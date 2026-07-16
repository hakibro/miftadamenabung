const { writeFileSync } = require("node:fs");
const { deflateSync } = require("node:zlib");

// Minimal 1-bit style PNG generator — 192x192 blue square with white "M"
// ponytail: replace with real logo PNGs from designer

function createPNG(size) {
	// PNG signature
	const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

	// IHDR
	const ihdr = createChunk(
		"IHDR",
		(buf) => {
			buf.writeUInt32BE(size, 0); // width
			buf.writeUInt32BE(size, 4); // height
			buf.writeUInt8(8, 8); // bit depth
			buf.writeUInt8(2, 9); // color type (RGB)
			buf.writeUInt8(0, 10); // compression
			buf.writeUInt8(0, 11); // filter
			buf.writeUInt8(0, 12); // interlace
		},
		13,
	);

	// IDAT — raw pixel data
	const rawData = [];
	const blue = [30, 64, 175]; // #1e40af
	const white = [255, 255, 255];
	const fontSize = Math.round(size * 0.55);
	const centerX = Math.round(size / 2);
	const baselineY = Math.round(size * 0.65);

	for (let y = 0; y < size; y++) {
		rawData.push(0); // filter: none
		for (let x = 0; x < size; x++) {
			// Simple letter M shape check
			const inM = isInM(x, y, centerX, baselineY, fontSize);
			const [r, g, b] = inM ? white : blue;
			rawData.push(r, g, b);
		}
	}

	const raw = Buffer.from(rawData);
	const compressed = deflateSync(raw);
	const idat = createChunkRaw("IDAT", compressed);

	// IEND
	const iend = createChunk("IEND", () => {}, 0);

	return Buffer.concat([signature, ihdr, idat, iend]);
}

function isInM(x, y, cx, by, fs) {
	// Normalize to center-based coordinates
	const dx = x - cx;
	const dy = by - y; // flip y

	if (dy < 0 || dy > fs) return false;

	const halfW = fs * 0.4;
	const relX = Math.abs(dx) / halfW;
	const relY = dy / fs;

	// M shape: two outer strokes + V middle
	// Left stroke: from bottom-left to top-center
	// Right stroke: from bottom-right to top-center
	const strokeWidth = 0.15;
	const leftEdge = 1 - relY; // diagonal left
	const rightEdge = relY; // diagonal right

	if (relX >= leftEdge - strokeWidth && relX <= leftEdge + strokeWidth)
		return true;
	if (relX >= rightEdge - strokeWidth && relX <= rightEdge + strokeWidth)
		return true;

	return false;
}

function createChunk(type, writeData, dataLen) {
	const buf = Buffer.alloc(dataLen);
	writeData(buf);
	return createChunkRaw(type, buf);
}

function createChunkRaw(type, data) {
	const len = Buffer.alloc(4);
	len.writeUInt32BE(data.length, 0);
	const typeB = Buffer.from(type, "ascii");
	const crcData = Buffer.concat([typeB, data]);
	const crc = crc32(crcData);
	const crcBuf = Buffer.alloc(4);
	crcBuf.writeUInt32BE(crc, 0);
	return Buffer.concat([len, typeB, data, crcBuf]);
}

// CRC32 table
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
	let c = n;
	for (let k = 0; k < 8; k++) {
		c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
	}
	crcTable[n] = c;
}

function crc32(buf) {
	let crc = 0xffffffff;
	for (let i = 0; i < buf.length; i++) {
		crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
	}
	return (crc ^ 0xffffffff) >>> 0;
}

// Generate icons
[192, 512].forEach((size) => {
	const png = createPNG(size);
	writeFileSync(`public/pwa-${size}x${size}.png`, png);
	console.log(`Generated pwa-${size}x${size}.png`);
});
