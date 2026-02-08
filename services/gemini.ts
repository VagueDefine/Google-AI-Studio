
import { GoogleGenAI } from "@google/genai";
import { ChatMessage } from '../types';

/**
 * Generates a response from the Gemini AI model.
 */
export const generateAiResponse = async (
  history: ChatMessage[], 
  currentMessage: string, 
  files?: Array<{ name: string; type: string; data: string }>
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const contents = history.map(msg => {
    const parts: any[] = [{ text: msg.text }];
    if (msg.files && msg.files.length > 0) {
      msg.files.forEach(file => {
        parts.push({
          inlineData: {
            mimeType: file.type,
            data: file.data.split(',')[1] || file.data
          }
        });
      });
    }
    return {
      role: msg.role === 'user' ? 'user' : 'model',
      parts: parts
    };
  });

  const currentParts: any[] = [{ text: currentMessage }];
  
  if (files && files.length > 0) {
    files.forEach(file => {
      currentParts.push({
        inlineData: {
          mimeType: file.type,
          data: file.data.split(',')[1] || file.data
        }
      });
    });
  }

  contents.push({
    role: 'user',
    parts: currentParts
  });

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: contents,
    config: {
      systemInstruction: `你是一个嵌入在 Obsidian 工作空间中的 GitHub 助手。
你的目标是帮助用户分析 GitHub 仓库中的代码、处理附件并回答技术问题。
当用户提到仓库上下文时，请基于这些信息提供精确、简洁且具有行动价值的建议。
请始终使用 Markdown 格式化你的回答，并确保在深色模式下有良好的可读性。`
    }
  });

  return response.text || "对不起，我无法生成回复，请重试。";
};
