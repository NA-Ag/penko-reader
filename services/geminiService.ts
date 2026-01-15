import { GoogleGenAI, Type } from "@google/genai";
import { GeneratedContent } from "../types";

export const generateReadingContent = async (
  topic: string, 
  complexity: 'simple' | 'intermediate' | 'advanced' = 'intermediate'
): Promise<GeneratedContent> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const modelName = 'gemini-3-flash-preview';
  
  const prompt = `
    Generate a short article or story about "${topic}".
    Complexity level: ${complexity}.
    Length: Approximately 300-500 words.
    Format: Return pure JSON with 'title' and 'text' fields.
    The text should be engaging and formatted for reading.
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            text: { type: Type.STRING }
          },
          required: ["title", "text"]
        }
      }
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("No response generated");

    return JSON.parse(jsonText) as GeneratedContent;
  } catch (error) {
    console.error("Gemini Generation Error:", error);
    throw new Error("Failed to generate content. Please try again.");
  }
};

export const summarizeContent = async (text: string): Promise<GeneratedContent> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const modelName = 'gemini-3-flash-preview';

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: `Summarize the following text into a concise version suitable for speed reading (keep it under 50% of original length). Return JSON with 'title' (suggest a title) and 'text' (the summary). \n\nText: ${text.substring(0, 10000)}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            text: { type: Type.STRING }
          },
          required: ["title", "text"]
        }
      }
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("No response generated");
    return JSON.parse(jsonText) as GeneratedContent;
  } catch (error) {
    console.error("Gemini Summarization Error:", error);
    throw new Error("Failed to summarize content.");
  }
};