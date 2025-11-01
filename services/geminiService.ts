import { GoogleGenAI, Chat } from "@google/genai";

// Helper to convert a File object to a GoogleGenAI.Part object.
const fileToGenerativePart = async (file: File): Promise<{ inlineData: { data: string; mimeType: string; }; }> => {
  const base64EncodedData = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
        if (typeof reader.result === 'string') {
            // The result includes the data URL prefix (e.g., "data:video/mp4;base64,"), 
            // which needs to be removed.
            resolve(reader.result.split(',')[1]);
        } else {
            reject(new Error("Failed to read file as base64 string."));
        }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });

  return {
    inlineData: {
      data: base64EncodedData,
      mimeType: file.type,
    },
  };
};

export const startAnalysisAndChat = async (videoFile: File): Promise<{ analysis: string, chatSession: Chat }> => {
  if (!process.env.API_KEY) {
    throw new Error("API key not found. Please ensure the API_KEY environment variable is set.");
  }
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Use the specified Gemini Pro model for video understanding
  const model = 'gemini-2.5-pro';

  try {
    console.log("Starting video analysis and chat initialization...");
    const videoPart = await fileToGenerativePart(videoFile);

    const prompt = `
      You are an expert analyst. Analyze the content of this video meeting recording thoroughly. 
      Based on your analysis, provide a structured summary in Markdown format with the following three sections:

      ### Executive Summary
      Provide a concise, high-level summary of the video's main points, purpose, decisions made, and overall outcome.

      ### Key Takeaways
      List the most important insights, discussion points, or pieces of information from the video as a detailed bulleted list.
      - **[Takeaway Title or Theme]:** [Detailed explanation of the point and its context.]

      ### Action Items
      Identify all specific tasks, recommendations, or next steps mentioned in the video. Group them by the person or entity responsible. If no one is specified, use a general heading like "General Action Items".
      - **[Name of Person/Team]:**
        - [Specific action item 1]
        - [Specific action item 2]
    `;
    
    // First, generate the initial analysis
    const initialResponse = await ai.models.generateContent({
      model: model,
      contents: { parts: [videoPart, { text: prompt }] },
    });
    
    const analysisText = initialResponse.text;

    // Now, create a chat session with the history of the analysis
    const chatSession = ai.chats.create({
        model: model,
        history: [
            {
                role: 'user',
                parts: [videoPart, { text: prompt }],
            },
            {
                role: 'model',
                parts: [{ text: analysisText }],
            }
        ]
    });
    
    console.log("Analysis and chat session created.");
    return { analysis: analysisText, chatSession: chatSession };

  } catch (error) {
    console.error("Error during analysis and chat creation:", error);
    if (error instanceof Error) {
        throw new Error(`An error occurred: ${error.message}`);
    }
    throw new Error("An unknown error occurred during video analysis.");
  }
};
