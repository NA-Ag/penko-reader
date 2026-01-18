import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.join(__dirname, '../dictionaries');
const OUT_DIR = path.join(__dirname, '../public/dicts');

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

const processDictionary = (lang) => {
  const srcPath = path.join(SRC_DIR, `${lang}.json`);
  const outPath = path.join(OUT_DIR, `${lang}.bin`);

  if (!fs.existsSync(srcPath)) {
    console.log(`No source dictionary for ${lang}, skipping.`);
    return;
  }

  console.log(`Processing ${lang}...`);
  const data = JSON.parse(fs.readFileSync(srcPath, 'utf-8'));
  const entries = Object.entries(data);

  // Calculate buffer size
  // Header: 4 (Magic) + 4 (Count) = 8 bytes
  // Entry: 1 (WordLen) + WordBytes + 2 (DefLen) + DefBytes
  let size = 8;
  const encoder = new TextEncoder();
  
  const binaryEntries = entries.map(([word, def]) => {
    const wordBuf = encoder.encode(word);
    const defBuf = encoder.encode(def);
    size += 1 + wordBuf.length + 2 + defBuf.length;
    return { wordBuf, defBuf };
  });

  const buffer = new ArrayBuffer(size);
  const view = new DataView(buffer);
  const uint8 = new Uint8Array(buffer);
  let offset = 0;

  // Magic "DICT" (0x44 0x49 0x43 0x54)
  uint8.set([0x44, 0x49, 0x43, 0x54], offset);
  offset += 4;

  // Count
  view.setUint32(offset, entries.length, true);
  offset += 4;

  // Entries
  binaryEntries.forEach(({ wordBuf, defBuf }) => {
    view.setUint8(offset, wordBuf.length);
    offset += 1;
    uint8.set(wordBuf, offset);
    offset += wordBuf.length;

    view.setUint16(offset, defBuf.length, true);
    offset += 2;
    uint8.set(defBuf, offset);
    offset += defBuf.length;
  });

  fs.writeFileSync(outPath, Buffer.from(buffer));
  console.log(`Wrote ${outPath} (${(size / 1024).toFixed(2)} KB)`);
};

// Process all languages
['en', 'es', 'fr', 'de', 'ja', 'zh'].forEach(processDictionary);