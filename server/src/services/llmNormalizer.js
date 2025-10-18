import JSON5 from 'json5';
import { jsonrepair } from 'jsonrepair';

import { buildMockItinerary } from '../utils/mockData.js';

export const normalizeLLMItinerary = (raw, fallbackRequest) => {
  if (!raw) {
    return buildMockItinerary(fallbackRequest);
  }

  if (raw?.summary && raw?.dailyPlans) {
    return raw;
  }

  const content = extractContentText(raw);

  if (!content) {
    return buildMockItinerary(fallbackRequest);
  }

  const parsed = parseItineraryFromText(content);
  if (parsed) {
    return parsed;
  }

  const normalized = normalizeViaRepair(content);
  if (normalized) {
    return normalized;
  }

  return buildMockItinerary(fallbackRequest);
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
        try {
          const repaired = jsonrepair(text);
          return JSON.parse(repaired);
        } catch (errorRepair) {
          continue;
        }
      }
    }
  }

  return null;
};

const normalizeViaRepair = (content) => {
  try {
    const repaired = jsonrepair(content);
    return JSON.parse(repaired);
  } catch (error) {
    try {
      return JSON5.parse(content);
    } catch (errorJSON5) {
      return null;
    }
  }
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
