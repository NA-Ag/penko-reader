import { LanguageCode } from '../types';

const EMBEDDED_DICTIONARIES: Record<string, Record<string, string>> = {
  en: {
    "the": "Denoting one or more people or things already mentioned or assumed to be common knowledge.",
    "be": "Exist, occur, or take place.",
    "to": "Expressing motion in the direction of (a particular location).",
    "of": "Expressing the relationship between a part and a whole.",
    "and": "Used to connect words of the same part of speech, clauses, or sentences.",
    "have": "Possess, own, or hold.",
    "read": "Look at and comprehend the meaning of written or printed matter.",
    "book": "A written or printed work consisting of pages glued or sewn together along one side.",
    "focus": "The center of interest or activity.",
    "learn": "Acquire knowledge of or skill in something by study, experience, or being taught.",
    "speed": "The rate at which someone or something is able to move or operate.",
    "dyslexia": "A general term for disorders that involve difficulty in learning to read or interpret words, letters, and other symbols.",
    "attention": "Notice taken of someone or something; regarding something as important.",
    "cognitive": "Relating to, being, or involving conscious intellectual activity (such as thinking or reasoning).",
    "pwa": "Progressive Web App - an application software delivered through the web.",
    "offline": "Not connected to a computer, network, or the internet.",
    "accessibility": "The quality of being able to be reached, entered, or used by people with disabilities.",
    "dictionary": "A resource that lists the words of a language and gives their meaning.",
    "comprehension": "The action or capability of understanding something.",
    "rhythm": "A strong, regular, repeated pattern of movement or sound.",
    "rsvp": "Rapid Serial Visual Presentation - a reading display method.",
    "orp": "Optimal Recognition Point - the specific letter in a word that the eye focuses on.",
    "penguin": "A large flightless seabird of southern hemisphere cold waters.",
    "software": "The programs and other operating information used by a computer."
  },
  es: {
    "hola": "Expresión con que se saluda.",
    "mundo": "Conjunto de todas las cosas creadas.",
    "gracias": "Expresión que se usa para agradecer algo.",
    "libro": "Conjunto de hojas de papel manuscritas o impresas que forman un volumen.",
    "leer": "Pasar la vista por lo escrito comprendiendo la significación de los caracteres.",
    "velocidad": "Relación entre el espacio recorrido y el tiempo empleado.",
    "atencion": "Acción de atender o concentrar la mente.",
    "enfoque": "Manera de valorar o considerar una cosa."
  }
};

class DictionaryService {
  private cache: Map<LanguageCode, Map<string, string>> = new Map();
  private loading: Map<LanguageCode, Promise<void>> = new Map();

  async lookup(word: string, lang: LanguageCode): Promise<string | null> {
    const cleanWord = word.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()?"'’]/g, "").trim();

    // Check remote loaded cache first
    const dict = this.cache.get(lang);
    if (dict && dict.has(cleanWord)) {
      return dict.get(cleanWord) || null;
    }

    // Try loading dictionary binary online/locally
    if (!this.cache.has(lang)) {
      if (!this.loading.has(lang)) {
        this.loading.set(lang, this.loadDictionary(lang));
      }
      try {
        await this.loading.get(lang);
        const recheckDict = this.cache.get(lang);
        if (recheckDict && recheckDict.has(cleanWord)) {
          return recheckDict.get(cleanWord) || null;
        }
      } catch (e) {
        // Suppress warning, we have fallback
      }
    }

    // Fallback to local embedded lexicon
    const localDict = EMBEDDED_DICTIONARIES[lang];
    if (localDict && localDict[cleanWord]) {
      return localDict[cleanWord];
    }

    return null;
  }

  private async loadDictionary(lang: LanguageCode): Promise<void> {
    try {
      const response = await fetch(`/dicts/${lang}.bin`);
      if (!response.ok) throw new Error("Dictionary not found");

      const buffer = await response.arrayBuffer();
      const view = new DataView(buffer);
      let offset = 4; // Skip "DICT" magic

      const count = view.getUint32(offset, true);
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
      throw e;
    }
  }
}

export const dictionaryService = new DictionaryService();
export default dictionaryService;