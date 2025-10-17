import crypto from 'crypto';

const samplePlaces = [
  {
    name: '当地热门景点',
    description: '沉浸式体验当地文化的半日游',
    coordinates: { lat: 35.6895, lng: 139.6917 },
    category: 'sightseeing'
  },
  {
    name: '特色餐厅',
    description: '品尝当地招牌料理，适合家庭出行',
    coordinates: { lat: 35.6704, lng: 139.7681 },
    category: 'food'
  },
  {
    name: '亲子活动中心',
    description: '为孩子设计的互动体验馆',
    coordinates: { lat: 35.6998, lng: 139.7745 },
    category: 'family'
  }
];

export const buildMockItinerary = (request) => {
  const id = crypto.randomUUID();
  const {
    destination = '东京',
    days = 5,
    budget = 10000,
    companions = 2,
    preferences = []
  } = request;

  const dailyPlans = Array.from({ length: Number(days) || 5 }).map((_, index) => ({
    day: index + 1,
    theme: preferences[index % preferences.length] ?? '综合体验',
    highlights: samplePlaces
  }));

  return {
    id,
    destination,
    companions,
    budget,
    summary: `${destination} ${days} 天行程，预算 ¥${budget}，适合 ${companions} 人出行。`,
    dailyPlans,
    recommendedHotels: [
      {
        name: `${destination} 中心酒店`,
        location: '市中心，交通便捷',
        pricePerNight: 1200
      }
    ],
    transportationTips: ['建议购买当地交通卡，方便随时乘坐地铁。'],
    createdAt: new Date().toISOString()
  };
};

export const buildMockBudget = (baseBudget = 10000) => {
  const transport = baseBudget * 0.2;
  const accommodation = baseBudget * 0.35;
  const food = baseBudget * 0.25;
  const entertainment = baseBudget * 0.15;
  const buffer = baseBudget - (transport + accommodation + food + entertainment);

  return {
    total: baseBudget,
    breakdown: {
      transport,
      accommodation,
      food,
      entertainment,
      buffer
    },
    currency: 'CNY',
    notes: ['当前为示例预算，实际金额请以真实报价为准。']
  };
};
