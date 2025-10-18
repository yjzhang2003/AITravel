import { buildMockItinerary } from './mockData.js';

export const normalizeItineraryShape = (itinerary, request) => {
  if (!itinerary || typeof itinerary !== 'object') {
    return buildFallback(request);
  }

  const normalized = { ...itinerary };

  const originalSummary = normalized.summary;
  const metaSource =
    normalized.meta ?? normalized.summaryMetadata ?? (typeof originalSummary === 'object' ? originalSummary : null);
  normalized.meta = normalizeMetaInfo(metaSource);
  const { extras } = extractSummaryExtras(originalSummary, normalized.meta);
  normalized.summaryExtras = extras;
  normalized.summary = null;

  normalized.destination = normalized.destination ?? normalized.meta?.destination ?? request?.destination ?? '行程概要';

  normalized.dailyPlans = Array.isArray(normalized.dailyPlans)
    ? normalized.dailyPlans.map((day, index) => normalizeDayPlan(day, index))
    : buildFallback(request).dailyPlans;

  normalized.recommendedHotels = Array.isArray(normalized.recommendedHotels)
    ? normalized.recommendedHotels.map(normalizeHotel)
    : [];

  normalized.transportationTips = Array.isArray(normalized.transportationTips)
    ? normalized.transportationTips.map((tip) => (typeof tip === 'string' ? tip : JSON.stringify(tip)))
    : normalizeTransportationTips(normalized.transportationTips);

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

const extractSummaryExtras = (summary, meta) => {
  const extras = [];
  if (summary == null) {
    return { extras };
  }

  if (typeof summary === 'string') {
    extras.push({ label: '摘要', value: summary });
    return { extras };
  }

  if (Array.isArray(summary)) {
    const joined = summary
      .map((item) => (typeof item === 'string' ? item : JSON.stringify(item)))
      .filter(Boolean)
      .join('；');
    if (joined) {
      extras.push({ label: '摘要', value: joined });
    }
    return { extras };
  }

  if (summary && typeof summary === 'object') {
    const labelMap = {
      preferences: '偏好',
      transportation: '交通方式',
      notes: '额外说明',
      focus: '重点',
      theme: '主题',
      highlights: '亮点',
      goals: '出行目标'
    };

    Object.entries(summary).forEach(([key, value]) => {
      if (value == null || value === '') return;

      const normalizedKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      const metaField =
        normalizedKey.includes('destination')
          ? 'destination'
          : normalizedKey.includes('start')
            ? 'startDate'
            : normalizedKey.includes('end')
              ? 'endDate'
              : normalizedKey.includes('traveler') || normalizedKey.includes('companion') || normalizedKey.includes('people')
                ? 'travelers'
                : normalizedKey.includes('budget')
                  ? 'budget'
                  : normalizedKey === 'notes'
                    ? 'notes'
                    : null;

      if (metaField && meta && meta[metaField]) {
        return;
      }

      const label = labelMap[key] ?? key;
      let text;
      if (Array.isArray(value)) {
        text = value.map((item) => (typeof item === 'string' ? item : JSON.stringify(item))).join('、');
      } else if (typeof value === 'object') {
        if (key === 'transportationTips') {
          text = Object.entries(value)
            .map(([k, v]) => `${k}：${v}`)
            .join('；');
        } else {
          text = JSON.stringify(value);
        }
      } else {
        text = String(value);
      }

      extras.push({ label, value: text });
    });
  }

  return { extras };
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
      coordinates: null,
      category: null
    };
  }

  const coordinates = highlight.coordinates
    ? highlight.coordinates
    : highlight.lat && highlight.lng
      ? { lat: highlight.lat, lng: highlight.lng }
      : Array.isArray(highlight['经纬度']) && highlight['经纬度'].length === 2
        ? { lng: highlight['经纬度'][0], lat: highlight['经纬度'][1] }
        : highlight.location ?? null;

  return {
    name: highlight.name ?? highlight.title ?? highlight['地点'] ?? `活动 ${index + 1}`,
    description: highlight.description ?? highlight.detail ?? highlight['描述'] ?? null,
    coordinates,
    category: highlight.category ?? highlight.type ?? highlight['类别'] ?? null
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
    pricePerNight: hotel.pricePerNight ?? hotel.price ?? hotel.priceRange ?? null,
    highlights: hotel.highlights ?? hotel.features ?? hotel.pros ?? null
  };
};

const buildFallback = (request) => buildMockItinerary(request ?? {});

const normalizeTransportationTips = (tips) => {
  if (!tips || typeof tips !== 'object') {
    return [];
  }
  return Object.entries(tips)
    .map(([key, value]) => `${key}：${value}`)
    .filter(Boolean);
};
