import { buildMockItinerary } from './mockData.js';

export const normalizeItineraryShape = (itinerary, request) => {
  if (!itinerary || typeof itinerary !== 'object') {
    return buildFallback(request);
  }

  const normalized = { ...itinerary };

  normalized.meta = normalizeMetaInfo(normalized.meta ?? normalized.summaryMetadata);

  if (!normalized.summary) {
    normalized.summary = buildSummaryFromMeta(normalized.meta);
  }

  normalized.destination = normalized.destination ?? normalized.meta?.destination ?? request?.destination ?? '行程概要';

  normalized.dailyPlans = Array.isArray(normalized.dailyPlans)
    ? normalized.dailyPlans.map((day, index) => normalizeDayPlan(day, index))
    : buildFallback(request).dailyPlans;

  normalized.recommendedHotels = Array.isArray(normalized.recommendedHotels)
    ? normalized.recommendedHotels.map(normalizeHotel)
    : [];

  normalized.transportationTips = Array.isArray(normalized.transportationTips)
    ? normalized.transportationTips.map((tip) => (typeof tip === 'string' ? tip : JSON.stringify(tip)))
    : [];

  return normalized;
};

export const deriveHistoryTitle = (record) => {
  if (!record) return '行程';

  return (
    record.itinerary?.destination ??
    record.itinerary?.meta?.destination ??
    record.destination ??
    record.request?.destination ??
    '行程'
  );
};

const normalizeMetaInfo = (meta) => {
  if (!meta || typeof meta !== 'object') return null;

  return {
    destination: meta.destination ?? meta.city ?? meta.location ?? null,
    startDate: meta.startDate ?? meta.start_date ?? null,
    endDate: meta.endDate ?? meta.end_date ?? null,
    travelers: meta.travelers ?? meta.people ?? meta.companions ?? null,
    budget: meta.budget ?? meta.budgetCNY ?? meta.totalBudget ?? null,
    notes: meta.notes ?? meta.highlights ?? null
  };
};

const buildSummaryFromMeta = (meta) => {
  if (!meta) return null;

  const items = [];

  if (meta.destination) items.push(`目的地：${meta.destination}`);
  if (meta.startDate) items.push(`开始日期：${meta.startDate}`);
  if (meta.endDate) items.push(`结束日期：${meta.endDate}`);
  if (meta.travelers) items.push(`同行人数：${meta.travelers}`);
  if (meta.budget) items.push(`预算参考：${meta.budget}`);
  if (meta.notes) items.push(`额外说明：${meta.notes}`);

  return items.length ? items.join('；') : null;
};

const normalizeDayPlan = (day, index) => {
  if (!day || typeof day !== 'object') {
    return {
      day: index + 1,
      theme: '行程安排',
      highlights: []
    };
  }

  const highlights = Array.isArray(day.highlights)
    ? day.highlights.map((highlight, highlightIndex) => normalizeHighlight(highlight, highlightIndex))
    : [];

  return {
    day: day.day ?? day.index ?? index + 1,
    theme: day.theme ?? day.title ?? day.notes ?? '行程安排',
    description: day.description ?? day.summary ?? null,
    highlights
  };
};

const normalizeHighlight = (highlight, index) => {
  if (!highlight || typeof highlight !== 'object') {
    return {
      name: `活动 ${index + 1}`,
      description: null,
      coordinates: null
    };
  }

  return {
    name: highlight.name ?? highlight.title ?? `活动 ${index + 1}`,
    description: highlight.description ?? highlight.detail ?? null,
    coordinates: highlight.coordinates ?? highlight.location ?? null,
    category: highlight.category ?? highlight.type ?? null
  };
};

const normalizeHotel = (hotel) => {
  if (!hotel || typeof hotel !== 'object') {
    return {
      name: '推荐酒店',
      location: null,
      pricePerNight: null
    };
  }

  return {
    name: hotel.name ?? hotel.title ?? '推荐酒店',
    location: hotel.location ?? hotel.address ?? null,
    pricePerNight: hotel.pricePerNight ?? hotel.price ?? null
  };
};

const buildFallback = (request) => buildMockItinerary(request ?? {});
