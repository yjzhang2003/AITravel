import { buildMockBudget } from '../utils/mockData.js';

export const budgetService = {
  calculate(itinerary, overrides = {}) {
    if (!itinerary) {
      return buildMockBudget(overrides.baseBudget);
    }

    const days = itinerary?.dailyPlans?.length ?? overrides.days ?? 5;
    const travellers = itinerary?.companions ?? overrides.companions ?? 2;
    const baseBudget = overrides.baseBudget ?? itinerary?.budget ?? days * travellers * 800;

    const transport = overrides.transport ?? baseBudget * 0.22;
    const accommodation = overrides.accommodation ?? days * travellers * 300;
    const food = overrides.food ?? days * travellers * 200;
    const entertainment = overrides.entertainment ?? days * 150;
    const buffer =
      overrides.buffer ?? Math.max(baseBudget - (transport + accommodation + food + entertainment), 0);

    return {
      total: transport + accommodation + food + entertainment + buffer,
      breakdown: {
        transport,
        accommodation,
        food,
        entertainment,
        buffer
      },
      currency: 'CNY',
      notes: overrides.notes ?? [
        '预算为估算值，实际费用视出行季节和供应商报价而定。',
        '可在前端界面中针对特定项目进行手动调整。'
      ]
    };
  }
};
