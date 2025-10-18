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
  const noteText = notes ? `补充说明：${notes}` : '补充说明：无';

  return `请扮演专业旅行策划师，仅输出一个 JSON 对象（不要包含额外解释或多余字段），严格遵循下列结构与键名：
{
  "summary": {
    "destination": "城市或地区名",
    "startDate": "出发日期（若为相对时间，可写如“后天”）",
    "endDate": "返程日期或结束时间",
    "budget": 预算数字（单位人民币）, 
    "travelers": 同行人数,
    "preferences": ["偏好标签"],
    "transportation": "往返交通方式"
  },
  "dailyPlans": [
    {
      "day": 天数数字,
      "theme": "当天主题",
      "highlights": [
        {
          "name": "地点名称",
          "description": "简洁描述",
          "category": "类别",
          "lat": 纬度数字,
          "lng": 经度数字
        }
      ]
    }
  ],
  "recommendedHotels": [
    {
      "name": "酒店名称",
      "location": "所在位置",
      "pricePerNight": 每晚预算（数字）, 
      "highlights": ["该酒店的优点"]
    }
  ],
  "transportationTips": ["交通建议（每条字符串）"]
}
必须保持字段名与上述完全一致；纬度/经度缺失时使用 null；若某项信息缺省，可使用 null 或空数组。请使用中文描述。

待生成行程需求：
- 目的地：${destination}
- 出发日期：${startDate ?? '待定'}
- 结束日期：${endDate ?? '待定'}
- 预算（人民币）：${budget ?? '未提供'}
- 同行人数：${companions ?? '未提供'}
- 偏好：${preferenceText}
- ${noteText}`;
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
        '你是专业旅行策划助手。务必仅输出一个 JSON 对象，不要添加额外说明。字段必须与示例结构完全一致：summary/dailyPlans/recommendedHotels/transportationTips。地点描述、主题等使用中文。缺失信息以 null 或空数组表示。纬度使用 "lat"，经度使用 "lng"，均为数字。'
    },
    {
      role: 'user',
      content: prompt
    }
  ];
};
