import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_FILE = path.join(__dirname, '../kaikki.org-dictionary-English-words.jsonl');
const OUT_FILE = path.join(__dirname, '../public/dicts/en.bin');
const OUT_DIR = path.join(__dirname, '../public/dicts');

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function processKaikki() {
  if (!fs.existsSync(SRC_FILE)) {
    console.log(`No Kaikki source file found at ${SRC_FILE}`);
    console.log('Please download a dictionary from https://kaikki.org/dictionary/English/index.html to use this script.');
    return;
  }

  console.log('Processing Kaikki dictionary stream...');
  
  const fileStream = fs.createReadStream(SRC_FILE);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const entries = [];
  const encoder = new TextEncoder();
  let count = 0;

  for await (const line of rl) {
    try {
      const data = JSON.parse(line);
      
      // Filter: We only want nouns/verbs/adjectives and simple words
      if (!data.word || !data.senses || data.word.includes(' ')) continue;
      
      // Get first definition
      const def = data.senses[0]?.glosses?.[0];
      if (!def) continue;

      // Limit length to keep binary small for this demo
      if (def.length > 200) continue;

      entries.push({
        wordBuf: encoder.encode(data.word),
        defBuf: encoder.encode(def)
      });

      count++;
      if (count % 10000 === 0) process.stdout.write(`\rProcessed ${count} words...`);
      
      // Cap at 50,000 words for performance in this demo
      if (count >= 50000) break;

    } catch (e) {
      // Skip bad lines
    }
  }

  console.log(`\nCompiling binary for ${entries.length} words...`);

  // Calculate size
  let size = 8; // Header
  entries.forEach(e => {
    size += 1 + e.wordBuf.length + 2 + e.defBuf.length;
  });

  const buffer = new ArrayBuffer(size);
  const view = new DataView(buffer);
  const uint8 = new Uint8Array(buffer);
  let offset = 0;

  // Header
  uint8.set([0x44, 0x49, 0x43, 0x54], offset); offset += 4;
  view.setUint32(offset, entries.length, true); offset += 4;

  entries.forEach(({ wordBuf, defBuf }) => {
    view.setUint8(offset, wordBuf.length); offset += 1;
    uint8.set(wordBuf, offset); offset += wordBuf.length;
    view.setUint16(offset, defBuf.length, true); offset += 2;
    uint8.set(defBuf, offset); offset += defBuf.length;
  });

  fs.writeFileSync(OUT_FILE, Buffer.from(buffer));
  console.log(`Done! Wrote ${OUT_FILE} (${(size / 1024 / 1024).toFixed(2)} MB)`);
}

processKaikki();