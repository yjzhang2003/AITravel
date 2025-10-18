import '../config/env.js';

import { normalizeItineraryShape } from '../utils/itineraryShape.js';
import { llmService } from './llmService.js';
import { budgetService } from './budgetService.js';

const buildChatEndpoint = () => {
  const llmUrl = process.env.LLM_API_URL;
  if (!llmUrl) return null;
  const trimmed = llmUrl.replace(/\/$/, '');
  return /\/(responses|chat\/completions)$/i.test(trimmed) ? trimmed : `${trimmed}/chat/completions`;
};

const endpoint = buildChatEndpoint();

export const plannerChatService = {
  async converse({ messages, userContext }) {
    if (!process.env.LLM_API_KEY || !endpoint) {
      return {
        reply: '大模型服务暂未配置，请稍后再试。',
        itinerary: null,
        itineraryRequest: null,
        readyForPlan: false
      };
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.LLM_API_KEY}`
      },
      body: JSON.stringify({
        model: process.env.LLM_MODEL ?? 'gpt-4o-mini',
        messages: buildMessages(messages, userContext),
        temperature: 0.6,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LLM provider error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content ?? '';

    let parsed;
    try {
      parsed = JSON.parse(rawContent);
    } catch (error) {
      throw new Error(`Failed to parse chat response: ${error.message}`);
    }

    const itineraryRequest = sanitizeItineraryRequest(parsed.itineraryRequest ?? {});

    let itinerary = null;
    let budget = null;

    if (parsed.readyForPlan && Object.keys(itineraryRequest).length > 0) {
      try {
        itinerary = await llmService.generateItinerary({ ...itineraryRequest, apiKeys: null });
        itinerary = normalizeItineraryShape(itinerary, itineraryRequest);
        budget = budgetService.calculate(itinerary, { baseBudget: itineraryRequest.budget });
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn('Failed to generate itinerary from chat context:', error);
        itinerary = null;
        budget = null;
      }
    }

    return {
      reply: parsed.reply ?? '好的，我会继续帮你完善行程！',
      itineraryRequest,
      itinerary,
      budget,
      readyForPlan: Boolean(parsed.readyForPlan),
      meta: parsed.meta ?? null
    };
  }
};

const buildMessages = (history, userContext) => {
  const systemPrompt = `你是一位中文旅行规划助理，需要通过与用户多轮对话，逐步收集以下关键信息：目的地、出行日期、出行天数或开始/结束日期、预算、同行人数、偏好（如美食、亲子）、特殊需求等。\n\n你必须遵循以下规则：\n1. 每次回复使用简洁自然的中文，与用户保持友好、有引导性的对话。\n2. 对话回复使用 JSON 格式，字段包括：\n   - reply: string，与用户的自然语言回复。\n   - questions: 可选数组，如果需要继续追问，用于说明下一步应该向用户确认的信息。\n   - itineraryRequest: 对象（可选），包含已收集的信息字段，例如 destination、startDate、endDate、budget、companions、preferences、notes 等。\n   - readyForPlan: boolean，只有当关键信息已经足够生成完整行程时才为 true。\n   - meta: 可选对象，用于补充说明当前掌握的摘要信息。\n3. 当 readyForPlan 为 true 时，不要再询问用户，而是总结确认并等待系统生成行程。\n4. 如果用户修改了某些条件，请在 itineraryRequest 中同步更新对应字段。\n5. 如果仍缺少关键信息，reply 中要表达正在确认，并在 questions 中说明。`;

  const msgs = [
    { role: 'system', content: systemPrompt }
  ];

  if (userContext?.destination) {
    msgs.push({
      role: 'system',
      content: `已知用户过往偏好：目的地=${userContext.destination}`
    });
  }

  (history ?? []).forEach((message) => {
    if (message.role === 'user' || message.role === 'assistant') {
      msgs.push({ role: message.role, content: message.content });
    }
  });

  return msgs;
};

const sanitizeItineraryRequest = (request) => {
  if (!request || typeof request !== 'object') return {};

  const cleaned = { ...request };

  const numberFields = ['budget', 'companions', 'travelers'];
  numberFields.forEach((field) => {
    if (cleaned[field] != null) {
      const value = Number(cleaned[field]);
      cleaned[field] = Number.isFinite(value) ? value : undefined;
    }
  });

  if (cleaned.travelers && !cleaned.companions) {
    cleaned.companions = cleaned.travelers;
  }

  if (cleaned.preferences && !Array.isArray(cleaned.preferences)) {
    cleaned.preferences = String(cleaned.preferences)
      .split(/[,，；;]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return Object.fromEntries(
    Object.entries(cleaned).filter(([, value]) => value !== undefined && value !== null)
  );
};
