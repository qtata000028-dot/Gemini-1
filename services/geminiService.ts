// 移除 SDK 依赖，直接使用 fetch 以确保 100% 走代理
// import { GoogleGenAI, Type } from "@google/genai"; 

// ==================================================================================
// 🔧 自定义配置区域
// ==================================================================================

// 1. 在这里填入您的 API Key
const CUSTOM_API_KEY = "sk-hLE0UQVwjBkiwB4Bi73qrsjTVBdHswS0YPrJCGNSHvMtgn5v"; 

// 2. 在这里填入自定义 Base URL
const CUSTOM_BASE_URL = "https://ccapi.aiclaude.club";

// ==================================================================================

const apiKey = CUSTOM_API_KEY || process.env.API_KEY || '';

// 辅助函数：处理 API 请求
async function callGeminiApi(model: string, payload: any) {
  if (!apiKey) {
    throw new Error("MISSING_KEY");
  }

  // 1. 构建完整的 URL
  // 确保 baseUrl 不以 / 结尾
  const baseUrl = (CUSTOM_BASE_URL || "https://generativelanguage.googleapis.com").replace(/\/$/, "");
  const url = `${baseUrl}/v1beta/models/${model}:generateContent?key=${apiKey}`;

  console.log(`[Gemini Service] Sending request to: ${url}`);

  // 2. 直接使用原生 fetch 发送请求
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    // 尝试解析错误信息
    let errorMsg = `HTTP Error ${response.status} ${response.statusText}`;
    try {
      const errorData = await response.json();
      if (errorData.error) {
        errorMsg = JSON.stringify(errorData.error);
      }
    } catch (e) {
      // 忽略解析错误
    }
    throw new Error(errorMsg);
  }

  return await response.json();
}

export const generateDailyReport = async (contextData: string): Promise<string> => {
  try {
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

    const data = await callGeminiApi('gemini-2.5-flash', {
      contents: [{ parts: [{ text: prompt }] }]
    });

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return text || "生成日报失败：无内容返回。";

  } catch (error: any) {
    console.error("Gemini Report Error:", error);
    return handleApiError(error);
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
    const prompt = `你是一个排程助手。用户希望自动分配、修改或删除每日生产数量。
    当前起始日期：${currentDate}。
    用户指令：“${userInstruction}”
    
    请根据指令生成需要变更的日期数据。
    
    规则：
    1. 仅返回 JSON 数组。不要包含 Markdown 代码块标记 (如 \`\`\`json)。
    2. 格式示例：[{"date": "2024-05-20", "qty": 100}, {"date": "2024-05-21", "qty": 0}]
    3. 如果用户想要“删除”、“清除”、“清空”或“取消”，请将 qty 设置为 0。
    4. 根据当前起始日期推断具体日期。
    `;

    // 注意：Gemini 2.5 Flash 支持 responseMimeType，但为了兼容性，我们主要依靠 Prompt 约束 JSON
    // 并在接收后进行清理
    const data = await callGeminiApi('gemini-2.5-flash', {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        response_mime_type: "application/json"
      }
    });

    let text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return [];

    // 清理可能的 Markdown 标记
    if (text.startsWith('```json')) {
        text = text.replace(/^```json/, '').replace(/```$/, '');
    } else if (text.startsWith('```')) {
        text = text.replace(/^```/, '').replace(/```$/, '');
    }
    
    return JSON.parse(text) as ScheduleItem[];

  } catch (error: any) {
    console.error("Gemini Smart Fill Error:", error);
    const friendlyMsg = handleApiError(error);
    // SmartFill 需要抛出异常或返回空数组，这里我们弹窗提示后返回空
    if (friendlyMsg) alert(friendlyMsg);
    throw error;
  }
};

function handleApiError(error: any): string {
  const errStr = typeof error === 'string' ? error : (error.message || JSON.stringify(error));

  if (errStr.includes("MISSING_KEY")) {
    return "⚠️ 错误：未配置 API Key。\n请在 services/geminiService.ts 中配置。";
  }

  if (errStr.includes("400") || errStr.includes("INVALID_ARGUMENT") || errStr.includes("API key not valid")) {
      return "⚠️ Key 无效或不被支持。\n\n请检查：\n1. services/geminiService.ts 中的 Key 是否正确。\n2. 代理地址是否支持该 Key。\n(当前响应来自: " + CUSTOM_BASE_URL + ")";
  }

  if (errStr.includes("429") || errStr.includes("RESOURCE_EXHAUSTED")) {
    return "⚠️ 请求过于频繁 (429 Rate Limit)。\n请稍等片刻后再试。";
  }

  if (errStr.includes("Failed to fetch") || errStr.includes("NetworkError")) {
    return `❌ 网络连接失败。\n\n无法连接到: ${CUSTOM_BASE_URL}\n请检查网络或代理地址。`;
  }
  
  return `AI 服务错误: ${errStr.substring(0, 100)}...`;
}
