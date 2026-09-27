const fs = require('fs');
const path = require('path');

const enginePath = path.join(__dirname, '..', 'services', 'cctvAssemblyEngine.js');
const newPath = path.join(__dirname, '..', 'services', '_assemble_new.js');

let src = fs.readFileSync(enginePath, 'utf8');
const neu = fs.readFileSync(newPath, 'utf8');

const startMark = 'async function assembleCCTVPackage(params = {}) {';
const endMark = '/* ==========================================================================\n * ۱۰) خروجی ماژول';

const startIdx = src.indexOf(startMark);
const endIdx = src.indexOf(endMark);

if (startIdx < 0 || endIdx < 0) {
  console.error('markers not found', { startIdx, endIdx });
  process.exit(1);
}

const before = src.slice(0, startIdx);
const after = src.slice(endIdx);
const out = before + neu.trim() + '\n\n' + after;
fs.writeFileSync(enginePath, out, 'utf8');
console.log('spliced ok, new length', out.length);
