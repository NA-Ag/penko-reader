import { WordToken } from "../types";

export const processTextToTokens = (text: string): WordToken[] => {
  // Split by double newlines to find paragraphs
  const paragraphs = text.split(/\n\s*\n/);
  
  const tokens: WordToken[] = [];

  paragraphs.forEach((para) => {
    // Clean paragraph: replace single newlines with spaces
    const cleanPara = para.replace(/\n/g, ' ').trim();
    if (!cleanPara) return;

    const rawWords = cleanPara.split(/\s+/);
    
    rawWords.forEach((word, index) => {
      const hasPunctuation = /[.,;!?]$/.test(word);
      // Mark the first word of a new block as a paragraph start (except for the very first word of the text)
      const isParagraphStart = index === 0 && tokens.length > 0;

      tokens.push({
        id: `word-${tokens.length}-${Date.now()}`,
        word: word,
        raw: word,
        hasPause: hasPunctuation,
        isParagraphStart: isParagraphStart
      });
    });

    // Add a pause token at the end of paragraphs to give the user a breather
    // We don't display this token, but it adds delay
    tokens.push({
      id: `pause-${tokens.length}-${Date.now()}`,
      word: '',
      raw: '',
      hasPause: true,
      isParagraphStart: false
    });
  });
  
  return tokens;
};

// Optimal Recognition Point (ORP) logic
export const getPivotIndex = (word: string): number => {
  const length = word.length;
  if (length === 1) return 0;
  let pivot = Math.floor((length - 1) / 2);
  if (length > 9) pivot = 3; 
  else if (length > 5) pivot = Math.floor(length / 2) - 1; 
  return Math.ceil(length / 2) - 1;
};
