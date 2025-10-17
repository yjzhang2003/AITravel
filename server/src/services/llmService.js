import { buildMockItinerary } from '../utils/mockData.js';

export const llmService = {
  async generateItinerary(request) {
    const llmKey = process.env.LLM_API_KEY;
    const llmUrl = process.env.LLM_API_URL;
    const llmModel = process.env.LLM_MODEL ?? 'gpt-4o-mini';

    if (!llmKey || !llmUrl) {
      return buildMockItinerary(request);
    }

    const response = await fetch(llmUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${llmKey}`
      },
      body: JSON.stringify({
        model: llmModel,
        input: buildPrompt(request)
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LLM provider error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return normalizeLLMResponse(data, request);
  }
};

const buildPrompt = ({ destination, startDate, endDate, budget, companions, preferences, notes }) => {
  const preferenceText = (preferences ?? []).join('、') || '综合体验';
  const noteText = notes ? `补充说明：${notes}` : '';
  return `请基于以下需求输出结构化 JSON 行程安排：
目的地：${destination}
开始日期：${startDate ?? '待定'}
结束日期：${endDate ?? '待定'}
预算（人民币）：${budget ?? '未提供'}
同行人：${companions ?? '未提供'}
偏好：${preferenceText}

${noteText}

输出字段包括：summary, dailyPlans (数组，包含 day, theme, highlights[地点、描述、经纬度、类别]), recommendedHotels, transportationTips。`;
};

const normalizeLLMResponse = (data, request) => {
  if (data?.itinerary) {
    return data.itinerary;
  }

  if (data?.choices?.[0]?.message?.content) {
    try {
      return JSON.parse(data.choices[0].message.content);
    } catch (error) {
      throw new Error(`Failed to parse LLM response: ${error.message}`);
    }
  }

  return buildMockItinerary(request);
};
