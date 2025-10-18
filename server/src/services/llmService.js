import '../config/env.js';

import { buildMockItinerary } from '../utils/mockData.js';
import { normalizeLLMItinerary } from './llmNormalizer.js';
import { normalizeItineraryShape } from '../utils/itineraryShape.js';

let lastRawItinerary = null;
export const getLastRawItinerary = () => lastRawItinerary;

export const llmService = {
  async generateItinerary(request) {
    const llmKey = process.env.LLM_API_KEY;
    const llmUrl = process.env.LLM_API_URL;
    const llmModel = process.env.LLM_MODEL ?? 'gpt-4o-mini';

    if (!llmKey || !llmUrl) {
      return buildMockItinerary(request);
    }

    const trimmedUrl = llmUrl.replace(/\/$/, '');
    const endpoint = /\/(responses|chat\/completions)$/i.test(trimmedUrl)
      ? trimmedUrl
      : `${trimmedUrl}/chat/completions`;

    const useChatCompletions = endpoint.endsWith('/chat/completions');

    const payload = useChatCompletions
      ? {
          model: llmModel,
          messages: buildMessages(request),
          temperature: 0.6,
          response_format: { type: 'json_object' }
        }
      : {
          model: llmModel,
          input: buildPrompt(request)
        };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${llmKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LLM provider error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const normalized = normalizeLLMResponse(data, request);
    lastRawItinerary = data;
    return normalized;
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
  const itinerary = normalizeLLMItinerary(data, request);
  return normalizeItineraryShape(itinerary, request);
};

const buildMessages = (request) => {
  const prompt = buildPrompt(request);
  return [
    {
      role: 'system',
      content:
        '你是一个旅行策划专家，需要基于用户需求输出 JSON 格式的行程规划。请严格按照用户要求返回 summary、dailyPlans、recommendedHotels、transportationTips 等字段。'
    },
    {
      role: 'user',
      content: prompt
    }
  ];
};
