import { GoogleGenAI, Type } from "@google/genai";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

// Helper to check key
const checkKey = () => {
  if (!apiKey) {
    throw new Error("API Key is missing. Please set process.env.API_KEY");
  }
};

export const generateDailyReport = async (contextData: string): Promise<string> => {
  checkKey();
  
  const prompt = `你是一位专业的 ERP 生产计划专家。
  请根据以下生产排程数据摘要，用中文生成一份简短的“生产排程分析日报”。
  
  数据摘要：
  ${contextData}

  要求：
  1. 使用专业的语气。
  2. 总结各个车间的总负荷情况。
  3. 识别出是否有“待排”状态的计划。
  4. 给出排程建议。
  5. 使用 Markdown 格式输出。
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "生成日报失败。";
  } catch (error) {
    console.error("Gemini Report Error:", error);
    return "AI 服务暂时不可用。";
  }
};

export interface ScheduleItem {
  date: string;
  qty: number;
}

export const generateSmartFill = async (
  currentDate: string, 
  userInstruction: string
): Promise<ScheduleItem[]> => {
  checkKey();

  const prompt = `你是一个排程助手。用户希望自动分配、修改或删除每日生产数量。
  当前起始日期：${currentDate}。
  用户指令：“${userInstruction}”
  
  请根据指令生成需要变更的日期数据。
  
  规则：
  1. 仅返回 JSON 数组。不要包含 Markdown 代码块标记。
  2. 格式示例：[{"date": "2024-05-20", "qty": 100}, {"date": "2024-05-21", "qty": 0}]
  3. 如果用户想要“删除”、“清除”、“清空”或“取消”，请将 qty 设置为 0。
  4. 根据当前起始日期推断具体日期。
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              date: { type: Type.STRING },
              qty: { type: Type.NUMBER }
            }
          }
        }
      }
    });

    const text = response.text;
    if (!text) return [];
    
    // The response is guaranteed to be JSON due to responseMimeType
    return JSON.parse(text) as ScheduleItem[];

  } catch (error) {
    console.error("Gemini Smart Fill Error:", error);
    throw error;
  }
};