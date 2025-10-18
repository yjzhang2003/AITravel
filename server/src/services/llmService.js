import JSON5 from 'json5';

import '../config/env.js';

import { buildMockItinerary } from '../utils/mockData.js';

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

  const content = extractContentText(data);

  if (!content) {
    return buildMockItinerary(request);
  }

  const parsed = parseItineraryFromText(content);

  if (parsed) {
    return parsed;
  }

  try {
    return JSON.parse(content);
  } catch (error) {
    try {
      return JSON5.parse(content);
    } catch (errorJSON5) {
      // eslint-disable-next-line no-console
      console.warn('LLM response parse failed, falling back to mock itinerary.', errorJSON5);
      return buildMockItinerary(request);
    }
  }
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

const extractContentText = (data) => {
  if (!data) return null;

  if (Array.isArray(data.output_text) && data.output_text.length > 0) {
    return data.output_text.join('\n');
  }

  if (Array.isArray(data.output)) {
    const segments = data.output
      .map((item) => {
        if (typeof item === 'string') return item;
        if (Array.isArray(item?.content)) {
          return item.content
            .map((segment) => segment?.text ?? segment?.value ?? '')
            .filter(Boolean)
            .join('\n');
        }
        if (typeof item?.content === 'string') {
          return item.content;
        }
        return '';
      })
      .filter(Boolean);

    if (segments.length) {
      return segments.join('\n');
    }
  }

  return data?.choices?.[0]?.message?.content ?? null;
};

const parseItineraryFromText = (rawText) => {
  if (!rawText) return null;

  const candidates = [];
  const trimmed = rawText.trim();

  const fencedMatch = trimmed.match(/```json([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    candidates.push(fencedMatch[1]);
  }

  const braceMatch = trimmed.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    candidates.push(braceMatch[0]);
  }

  const balanced = findFirstBalancedJson(trimmed);
  if (balanced) {
    candidates.push(balanced);
  }

  candidates.push(trimmed);

  for (const candidate of candidates) {
    const text = candidate.trim();
    if (!text) continue;

    try {
      return JSON.parse(text);
    } catch (error) {
      try {
        return JSON5.parse(text);
      } catch (errorJSON5) {
        // continue
      }
    }
  }

  return null;
};

const findFirstBalancedJson = (text) => {
  let depth = 0;
  let start = -1;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (char === '{') {
      if (depth === 0) {
        start = i;
      }
      depth += 1;
    }

    if (char === '}') {
      depth -= 1;
      if (depth === 0 && start !== -1) {
        return text.slice(start, i + 1);
      }
    }
  }

  return null;
};
