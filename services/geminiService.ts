import { GoogleGenAI, Type } from "@google/genai";

// Access the key injected by Vite at build time
const apiKey = process.env.API_KEY || '';

// Initialize client lazily or handle empty key gracefully
const getAiClient = () => {
  if (!apiKey) {
    throw new Error("MISSING_KEY");
  }
  // Check for common wrong key formats (e.g. OpenAI style keys or third-party proxy keys)
  if (apiKey.startsWith("sk-")) {
    throw new Error("INVALID_KEY_FORMAT_SK");
  }
  return new GoogleGenAI({ apiKey });
};

export const generateDailyReport = async (contextData: string): Promise<string> => {
  try {
    const ai = getAiClient();
    
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

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "生成日报失败：无内容返回。";
  } catch (error: any) {
    console.error("Gemini Report Error:", error);
    
    const errStr = JSON.stringify(error) + (error.message || '');

    if (error.message === "MISSING_KEY") {
      return "⚠️ 配置错误：未检测到 API Key。\n\n请在 Vercel 项目设置 (Settings -> Environment Variables) 中，将变量名设置为 `API_KEY` (注意大写)，而不是其他名字。";
    }

    if (error.message === "INVALID_KEY_FORMAT_SK") {
      return "⚠️ 密钥格式错误：检测到以 'sk-' 开头的密钥。\n\n本项目使用 Google 官方原生接口，不支持第三方中转 Key (OpenAI 格式)。\n请访问 aistudio.google.com 申请免费的官方 Key (以 'AIza' 开头)。";
    }

    if (errStr.includes("429") || errStr.includes("RESOURCE_EXHAUSTED")) {
      return "⚠️ 请求过于频繁 (429 Rate Limit)。\n\nGoogle 免费版 API 限制了每分钟调用次数（约 15 次/分钟）。\n请稍等 1-2 分钟后再试，或者减少点击频率。";
    }
    
    return `AI 服务暂时不可用 (${error.message || '未知错误'})。`;
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
  try {
    const ai = getAiClient();

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
    
    return JSON.parse(text) as ScheduleItem[];

  } catch (error: any) {
    console.error("Gemini Smart Fill Error:", error);
    const errStr = JSON.stringify(error) + (error.message || '');

    if (error.message === "MISSING_KEY") {
      alert("⚠️ 错误：未配置 API Key。\n请在 Vercel 后台将变量名修改为 `API_KEY`。");
      throw error;
    }
    if (error.message === "INVALID_KEY_FORMAT_SK") {
      alert("⚠️ 密钥错误：不能使用 'sk-' 开头的第三方 Key。\n请使用 Google 官方 'AIza' 开头的 Key。");
      throw error;
    }
    if (errStr.includes("429") || errStr.includes("RESOURCE_EXHAUSTED")) {
      alert("⚠️ 请求过于频繁 (429)。\n\nGoogle 免费版 API 限制了调用频率。\n请稍等 1-2 分钟后再尝试生成。");
      throw error;
    }
    throw error;
  }
};