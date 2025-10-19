import '../config/env.js';

import { normalizeItineraryShape } from '../utils/itineraryShape.js';
import { llmService } from './llmService.js';
import { budgetService } from './budgetService.js';
import { toolService } from './toolService.js';
import { itineraryService } from './itineraryService.js';

const buildChatEndpoint = () => {
  const llmUrl = process.env.LLM_API_URL;
  if (!llmUrl) return null;
  const trimmed = llmUrl.replace(/\/$/, '');
  return /\/(responses|chat\/completions)$/i.test(trimmed) ? trimmed : `${trimmed}/chat/completions`;
};

const endpoint = buildChatEndpoint();
const MAX_TOOL_CALLS = 4;

export const plannerChatService = {
  async converse({ messages, userContext, itinerary, itineraryRequest, userId, itineraryId }) {
    if (!process.env.LLM_API_KEY || !endpoint) {
      return {
        reply: '大模型服务暂未配置，请稍后再试。',
        itinerary: null,
        itineraryRequest: null,
        readyForPlan: false
      };
    }

    const context = buildToolContext(itinerary, itineraryRequest);
    if (itineraryId && context.itinerary && !context.itinerary.id) {
      context.itinerary = { ...context.itinerary, id: itineraryId };
    }
    const effectiveItineraryId = itineraryId ?? context.itinerary?.id ?? null;
    const conversation = buildMessages(messages, userContext, context);
    const tools = buildToolDefinitions(context);
    const initialItineraryVersion = context.itineraryVersion ?? 0;
    const initialRoutesVersion = context.routesVersion ?? 0;

    let assistantMessage = null;
    let iterations = 0;

    while (iterations < MAX_TOOL_CALLS) {
      iterations += 1;
      const modelResponse = await callModel(conversation, tools);
      const choice = modelResponse.choices?.[0];
      const message = choice?.message;

      if (!message) {
        throw new Error('LLM provider returned an empty response.');
      }

      const embeddedToolCalls = extractEmbeddedToolCalls(message.content);
      const directToolCalls = Array.isArray(message.tool_calls) ? message.tool_calls : null;
      const toolCalls =
        directToolCalls && directToolCalls.length > 0 ? directToolCalls : embeddedToolCalls;

      if (toolCalls && toolCalls.length > 0) {
        conversation.push({
          role: 'assistant',
          content: message.content ?? '',
          tool_calls: toolCalls
        });

        for (const call of toolCalls) {
          const toolName = call?.function?.name;
          const rawArguments = call?.function?.arguments ?? '{}';
          let parsedArgs;
          try {
            parsedArgs = JSON.parse(rawArguments || '{}');
          } catch (error) {
            parsedArgs = null;
          }

          let toolResult;
          try {
            // eslint-disable-next-line no-console
            console.log('[PlannerChat] Invoking tool:', {
              name: toolName,
              args: parsedArgs
            });
            toolResult = await toolService.execute({
              name: toolName,
              args: parsedArgs,
              context
            });
            // eslint-disable-next-line no-console
            console.log('[PlannerChat] Tool result:', {
              name: toolName,
              ok: toolResult?.ok ?? false,
              keys: toolResult ? Object.keys(toolResult) : []
            });
          } catch (error) {
            toolResult = {
              error: error.message ?? '工具执行失败，请提供更多信息后重试。'
            };
            // eslint-disable-next-line no-console
            console.warn('[PlannerChat] Tool execution failed:', toolName, error);
          }

          conversation.push({
            role: 'tool',
            name: toolName,
            tool_call_id: call.id,
            content: JSON.stringify(toolResult)
          });
        }

        continue;
      }

      assistantMessage = message;
      break;
    }

    if (!assistantMessage) {
      const fallbackReply = '我已尝试处理您的需求，但仍需更多信息才能继续。能否再具体说明一下？';
      return {
        reply: fallbackReply,
        itinerary: context.itinerary,
        itineraryRequest: context.itineraryRequest,
        readyForPlan: false,
        meta: null
      };
    }

    const rawAssistantContent = assistantMessage.content ?? '';
    // eslint-disable-next-line no-console
    console.log('[PlannerChat] Assistant raw content:', rawAssistantContent);
    const parsed = parseAssistantContent(rawAssistantContent);

    if (context.itineraryVersion === initialItineraryVersion && parsed.itinerary) {
      try {
        const normalized = normalizeItineraryShape(parsed.itinerary, itineraryRequest);
        context.itinerary = normalized;
        context.itineraryVersion = (context.itineraryVersion ?? initialItineraryVersion) + 1;
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn('Failed to apply itinerary from assistant response:', error);
      }
    }

    if (
      context.routesVersion === initialRoutesVersion &&
      parsed.meta &&
      Array.isArray(parsed.meta.routes) &&
      parsed.meta.routes.length > 0
    ) {
      context.routes = parsed.meta.routes;
      context.routesVersion = (context.routesVersion ?? initialRoutesVersion) + 1;
    }
    const mergedRequest = {
      ...context.itineraryRequest,
      ...sanitizeItineraryRequest(parsed.itineraryRequest ?? {})
    };
    context.itineraryRequest = mergedRequest;

    let itineraryResult = context.itinerary ?? null;
    let budget = context.lastBudget ?? null;

    const wantsRegenerate = Boolean(
      parsed?.meta?.regenerate === true ||
        (Array.isArray(parsed?.actions) && parsed.actions.includes('regenerate_plan'))
    );
    const readyForPlan = Boolean(parsed.readyForPlan);
    const requestIsReady = Object.keys(mergedRequest).length > 0;

    const shouldRegenerate =
      requestIsReady &&
      (wantsRegenerate || (readyForPlan && (!itineraryResult || parsed.meta?.regenerate === true)));

    if (shouldRegenerate) {
      try {
        itineraryResult = await llmService.generateItinerary({ ...mergedRequest, apiKeys: null });
        itineraryResult = normalizeItineraryShape(itineraryResult, mergedRequest);
        if (effectiveItineraryId && (!itineraryResult.id || itineraryResult.id !== effectiveItineraryId)) {
          itineraryResult = { ...itineraryResult, id: effectiveItineraryId };
        }
        context.itinerary = itineraryResult;
        context.itineraryVersion = (context.itineraryVersion ?? initialItineraryVersion) + 1;
        budget = budgetService.calculate(itineraryResult, { baseBudget: mergedRequest.budget });
        context.lastBudget = budget;
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn('Failed to generate itinerary from chat context:', error);
      }
    } else if (itineraryResult) {
      try {
        budget = budgetService.calculate(itineraryResult, { baseBudget: mergedRequest.budget });
        context.lastBudget = budget;
      } catch (error) {
        budget = null;
        context.lastBudget = null;
      }
    }

    let finalItinerary = itineraryResult
      ? {
          ...itineraryResult,
          id: itineraryId ?? itineraryResult.id ?? effectiveItineraryId ?? itineraryResult.id
        }
      : null;
    let finalBudget = budget;
    let finalItineraryId = finalItinerary?.id ?? itineraryId ?? effectiveItineraryId ?? null;

    if (finalItinerary) {
      context.itinerary = finalItinerary;
    }

    const shouldPersist =
      userId && context.itinerary && context.itineraryVersion > initialItineraryVersion;

    if (!shouldPersist) {
      // eslint-disable-next-line no-console
      console.log('[PlannerChat] Skip persistence', {
        hasUser: Boolean(userId),
        hasItinerary: Boolean(context.itinerary),
        itineraryVersion: context.itineraryVersion,
        initialItineraryVersion
      });
    }

    if (shouldPersist) {
      try {
        if (finalItineraryId) {
          const persisted = await itineraryService.update({
            itineraryId: finalItineraryId,
            userId,
            itinerary: { ...context.itinerary, id: finalItineraryId },
            budget: finalBudget,
            request: mergedRequest
          });

          if (persisted?.itinerary) {
            // eslint-disable-next-line no-console
            console.log('[PlannerChat] Persist itinerary update', {
              itineraryId: finalItineraryId,
              userId,
              updated: Boolean(persisted),
              firstHighlight:
                persisted?.itinerary?.dailyPlans?.[0]?.highlights?.[0]?.name ?? null
            });

            finalItinerary = { ...persisted.itinerary, id: finalItineraryId };
            context.itinerary = finalItinerary;

            if (persisted?.budget != null) {
              finalBudget = persisted.budget;
              context.lastBudget = finalBudget;
            }
          } else {
            // eslint-disable-next-line no-console
            console.warn('[PlannerChat] Failed to persist itinerary update, itinerary is missing', {
              itineraryId: finalItineraryId,
              userId
            });
          }
        } else {
          const created = await itineraryService.create({
            ...mergedRequest,
            userId,
            itinerary: context.itinerary
          });

          const storedItinerary = created?.itinerary ?? created;
          const storedId =
            storedItinerary?.id ?? created?.id ?? context.itinerary?.id ?? effectiveItineraryId ?? null;

          // eslint-disable-next-line no-console
          console.log('[PlannerChat] Persist new itinerary', {
            userId,
            storedId,
            hasBudget: created?.budget != null
          });

          if (storedItinerary) {
            finalItinerary = {
              ...(storedItinerary.itinerary ?? storedItinerary),
              id: storedId ?? storedItinerary.id
            };
            context.itinerary = finalItinerary;
            context.itineraryVersion = (context.itineraryVersion ?? initialItineraryVersion) + 1;
          }

          if (storedId) {
            finalItineraryId = storedId;
          }

          if (created?.budget != null) {
            finalBudget = created.budget;
            context.lastBudget = finalBudget;
          }
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn('Failed to persist itinerary update:', error);
      }
    }

    if (finalItinerary && finalItineraryId) {
      finalItinerary = { ...finalItinerary, id: finalItineraryId };
      context.itinerary = finalItinerary;
    }

    return {
      reply: parsed.reply ?? '好的，我会继续为您完善行程！',
      itineraryRequest: mergedRequest,
      itinerary: finalItinerary,
      budget: finalBudget,
      readyForPlan: Boolean(parsed.readyForPlan),
      meta: parsed.meta ?? null,
      routes: context.routes ?? []
    };
  }
};

const callModel = async (messages, tools) => {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.LLM_API_KEY}`
    },
    body: JSON.stringify({
      model: process.env.LLM_MODEL ?? 'gpt-4o-mini',
      messages,
      temperature: 0.4,
      tools,
      tool_choice: 'auto'
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM provider error: ${response.status} ${errorText}`);
  }

  return response.json();
};

const buildMessages = (history, userContext, context) => {
  const systemPrompt = `你是一位中文旅行规划助理，需要通过与用户多轮交流高效收集需求、提供建议并灵活使用系统工具。务必严格遵守以下约束：
1. 永远输出一个 JSON 对象（不要额外文本）。字段包括：
   - reply: string，与用户交流的自然中文回复。
   - questions: string[] 可选，若仍需确认信息。
   - itineraryRequest: object 可选，记录当前掌握的行程需求（destination、startDate、endDate、budget、companions、preferences、notes 等）。
   - readyForPlan: boolean，当信息已充分可生成完整行程时设为 true。
   - meta: object 可选，可包含 { regenerate: boolean, notes: string, routes: any[] } 等补充说明。
   - actions: string[] 可选，可包含 'regenerate_plan' 表示需要重新生成完整行程。
2. 只要用户希望对现有行程做出任何修改（新增/删除/替换景点、调整天数、酒店等），你必须先调用 update_itinerary 工具；在工具返回成功结果之前，禁止对用户做出“已修改”的陈述。若工具返回错误或缺少必要信息，请明确告诉用户你未能更新行程，并说明原因。
   - 工具返回后请读取其内容，确认修改已经写入 itinerary，再在 reply 中总结变化。
   - 工具调用必须通过 tool_calls 字段发送，arguments 必须是包含 updates 结构的 JSON 字符串（示例见下文）；仅在 actions 中写 “update_itinerary” 没有任何效果。
   - 如果本轮对话没有成功调用 update_itinerary，就不要说“已替换”“已调整”等字眼，并提醒自己需要工具支持。
   - 发送工具调用后必须等待系统返回的 tool 消息，再依据结果发送新的 assistant JSON（不再包含 tool_calls），其中 reply 要总结本次修改或说明失败原因。
3. 当用户请求或你主动提供具体出行路线（如从 A 到 B 的交通方式/耗时/距离）时，必须调用 plan_route 工具获取真实结果，并在最终 JSON 的 meta.routes 中总结关键数据（distance、duration、步骤）。
4. 如果仍缺少关键信息，reply 中要提示用户并在 questions 中列出需要确认的内容。
5. 如有现成行程，优先通过工具进行局部调整，避免无必要的整份重生成。
6. 保持语气专业、温暖，帮助用户逐步完善旅行计划。

【示例（务必遵循）】
用户：请把第一天的“中山陵”换成“玄武湖”。
你（必须先调用工具）：
  tool_calls = [
    {
      "id": "call-1",
      "type": "function",
      "function": {
        "name": "update_itinerary",
        "arguments": '{"updates":{"dailyPlans":[{"day":1,"highlights":[{"name":"玄武湖"},{"name":"明孝陵"},{"name":"老门东"}]}]}}'
      }
    }
  ]
工具返回成功后（系统会以 role=tool 的消息返回结果），你再发送最终回复：
  {
    "reply": "我已把 Day1 的中山陵替换为玄武湖，并保留其余安排……",
    "itineraryRequest": {...},
    "itinerary": {...},
    ...
  }
若工具返回错误或信息不足，你必须明确说明“未能更新行程”，并告知用户需要提供哪些信息。禁止在未调用或未成功调用工具时宣称“已经更新”。`;

  const msgs = [{ role: 'system', content: systemPrompt }];

  if (context.itinerary) {
    msgs.push({
      role: 'system',
      content: `当前行程数据（JSON）：${JSON.stringify(context.itinerary)}`
    });
  }

  if (context.itineraryRequest && Object.keys(context.itineraryRequest).length > 0) {
    msgs.push({
      role: 'system',
      content: `当前已知行程需求（JSON）：${JSON.stringify(context.itineraryRequest)}`
    });
  }

  if (userContext?.destination) {
    msgs.push({
      role: 'system',
      content: `用户历史偏好：目的地=${userContext.destination}`
    });
  }

  (history ?? []).forEach((message) => {
    if (message.role === 'user' || message.role === 'assistant') {
      msgs.push({ role: message.role, content: message.content });
    }
  });

  return msgs;
};

const buildToolDefinitions = (context) => {
  const destinations = Array.from(
    new Set(
      (context.itinerary?.dailyPlans ?? []).flatMap((day) =>
        (day?.highlights ?? [])
          .map((highlight) => highlight?.name)
          .filter(Boolean)
      )
    )
  );

  return [
    {
      type: 'function',
      function: {
        name: 'update_itinerary',
        description:
          '根据用户最新需求修改当前行程。适用于添加或删除景点、更新天数、调整住宿等。返回更新后的行程摘要。',
        parameters: {
          type: 'object',
          properties: {
            updates: {
              type: 'object',
              description:
                '需要合并到当前行程的局部更新，结构与 itinerary 相同。例如 dailyPlans / recommendedHotels / meta。'
            },
            overwrite: {
              type: 'boolean',
              description: '为 true 时对应字段将被整体替换；默认进行深度合并。'
            },
            note: {
              type: 'string',
              description: '对本次调整的简要说明。'
            }
          },
          required: ['updates']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'plan_route',
        description:
          `规划两个地点间的交通路线，可使用当前行程中的景点名称${destinations.length ? `（例如：${destinations.slice(0, 5).join('、')}）` : ''}，也可提供经纬度。返回路程距离、预计时间及关键步骤。`,
        parameters: {
          type: 'object',
          properties: {
            origin: {
              type: 'string',
              description: '起点名称，建议使用较精确的景点或住宿名称。'
            },
            destination: {
              type: 'string',
              description: '终点名称，建议使用较精确的景点或住宿名称。'
            },
            originCoordinates: {
              type: 'object',
              description: '当行程数据缺少坐标时，可直接提供起点经纬度。',
              properties: {
                lat: { type: 'number' },
                lng: { type: 'number' }
              }
            },
            destinationCoordinates: {
              type: 'object',
              description: '当行程数据缺少坐标时，可直接提供终点经纬度。',
              properties: {
                lat: { type: 'number' },
                lng: { type: 'number' }
              }
            },
            waypoints: {
              type: 'array',
              description: '途经点名称或坐标。',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  lat: { type: 'number' },
                  lng: { type: 'number' }
                }
              }
            },
            preference: {
              type: 'string',
              description: '路线偏好，例如 driving、walking、public_transit。'
            }
          },
          required: ['origin', 'destination']
        }
      }
    }
  ];
};

const buildToolContext = (itinerary, itineraryRequest) => {
  const sanitizedRequest = sanitizeItineraryRequest(itineraryRequest ?? {});
  let normalizedItinerary = null;

  if (itinerary && typeof itinerary === 'object') {
    try {
      normalizedItinerary = normalizeItineraryShape(itinerary, sanitizedRequest);
    } catch {
      normalizedItinerary = itinerary;
    }
  }

  return {
    itinerary: normalizedItinerary,
    itineraryRequest: sanitizedRequest,
    routes: [],
    lastBudget: null,
    itineraryVersion: 0,
    routesVersion: 0
  };
};

const parseAssistantContent = (content) => {
  if (!content) {
    return {};
  }

  try {
    return JSON.parse(content);
  } catch (primaryError) {
    const candidate = extractJsonBlock(content);
    if (candidate) {
      try {
        return JSON.parse(candidate);
      } catch (secondaryError) {
        throw new Error(`Failed to parse chat response: ${secondaryError.message}`);
      }
    }
    if (typeof content === 'string' && content.includes('"tool_calls"')) {
      return {};
    }
    throw new Error(`Failed to parse chat response: ${primaryError.message}`);
  }
};

const extractJsonBlock = (content) => {
  const fencedMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const firstBrace = content.indexOf('{');
  const lastBrace = content.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return content.slice(firstBrace, lastBrace + 1).trim();
  }

  return null;
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

const extractEmbeddedToolCalls = (content) => {
  if (!content || typeof content !== 'string') return null;

  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed?.tool_calls) && parsed.tool_calls.length > 0) {
      return parsed.tool_calls.map((call, index) => ({
        id: call?.id ?? `embedded_${index}`,
        type: call?.type ?? 'function',
        function: call?.function ?? null
      }));
    }
  } catch (error) {
    return null;
  }

  return null;
};
