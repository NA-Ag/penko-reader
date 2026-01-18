import { LanguageCode } from '../types';

interface DictionaryEntry {
  word: string;
  definition: string;
}

class DictionaryService {
  private cache: Map<LanguageCode, Map<string, string>> = new Map();
  private loading: Map<LanguageCode, Promise<void>> = new Map();

  async lookup(word: string, lang: LanguageCode): Promise<string | null> {
    // Ensure dictionary is loaded
    if (!this.cache.has(lang)) {
      if (!this.loading.has(lang)) {
        this.loading.set(lang, this.loadDictionary(lang));
      }
      try {
        await this.loading.get(lang);
      } catch (e) {
        console.warn(`Could not load dictionary for ${lang}`);
        return null;
      }
    }

    const dict = this.cache.get(lang);
    if (!dict) return null;

    // Simple normalization
    const cleanWord = word.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "");
    return dict.get(cleanWord) || null;
  }

  private async loadDictionary(lang: LanguageCode): Promise<void> {
    try {
      // In production, this would fetch from /dicts/{lang}.bin
      const response = await fetch(`/dicts/${lang}.bin`);
      if (!response.ok) throw new Error("Dictionary not found");

      const buffer = await response.arrayBuffer();
      const view = new DataView(buffer);
      let offset = 0;

      // Simple Binary Parser
      // Magic "DICT" check (skipped for brevity)
      offset += 4; 
      
      const count = view.getUint32(offset, true); // Little endian
      offset += 4;

      const map = new Map<string, string>();
      const decoder = new TextDecoder();

      for (let i = 0; i < count; i++) {
        const wordLen = view.getUint8(offset);
        offset += 1;
        const word = decoder.decode(new Uint8Array(buffer, offset, wordLen));
        offset += wordLen;

        const defLen = view.getUint16(offset, true);
        offset += 2;
        const def = decoder.decode(new Uint8Array(buffer, offset, defLen));
        offset += defLen;

        map.set(word, def);
      }

      this.cache.set(lang, map);
    } catch (e) {
      // Fallback or error handling
      throw e;
    }
  }
}

export const dictionaryService = new DictionaryService();