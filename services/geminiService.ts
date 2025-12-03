import { GoogleGenAI, Type } from "@google/genai";

// ==================================================================================
// 🔧 自定义配置区域
// ==================================================================================

// 1. 在这里填入您的 API Key (支持官方 Key 或 第三方中转 Key)
const CUSTOM_API_KEY = "sk-hLE0UQVwjBkiwB4Bi73qrsjTVBdHswS0YPrJCGNSHvMtgn5v"; 

// 2. 在这里填入自定义 Base URL (例如您的中转服务地址)
// 注意：不要带末尾的斜杠，SDK 会自动处理路径
const CUSTOM_BASE_URL = "https://ccapi.aiclaude.club";

// ==================================================================================

// 优先使用硬编码的 Key，如果没有则尝试读取环境变量
const apiKey = CUSTOM_API_KEY || process.env.API_KEY || '';

// Initialize client
const getAiClient = () => {
  if (!apiKey) {
    throw new Error("MISSING_KEY");
  }
  
  // 初始化 SDK
  // 修复：apiKey 和 baseUrl 必须在同一个配置对象中传入
  return new GoogleGenAI({ 
    apiKey: apiKey,
    baseUrl: CUSTOM_BASE_URL // 设置请求的基础地址，确保走代理
  });
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
      return "⚠️ 错误：未检测到 API Key。\n\n请在 services/geminiService.ts 文件中填入您的 CUSTOM_API_KEY。";
    }

    if (errStr.includes("429") || errStr.includes("RESOURCE_EXHAUSTED")) {
      return "⚠️ 请求过于频繁 (429 Rate Limit)。\n\n您的 API Key 配额已耗尽或触发频率限制。\n请稍等片刻后再试。";
    }

    if (errStr.includes("Failed to fetch") || errStr.includes("NetworkError")) {
      return `❌ 网络连接失败。\n\n当前连接地址: ${CUSTOM_BASE_URL || '默认 Google 地址'}\n请检查您的代理地址是否正确，或网络是否通畅。`;
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
      alert("⚠️ 错误：请在 services/geminiService.ts 中配置您的 API Key。");
      throw error;
    }
    if (errStr.includes("429") || errStr.includes("RESOURCE_EXHAUSTED")) {
      alert("⚠️ 请求过于频繁 (429)。\n请稍后再试。");
      throw error;
    }
    if (errStr.includes("Failed to fetch") || errStr.includes("NetworkError")) {
      alert(`❌ 网络错误。\n无法连接到: ${CUSTOM_BASE_URL}`);
      throw error;
    }
    throw error;
  }
};