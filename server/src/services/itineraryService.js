import { supabaseClient } from './supabaseClient.js';
import { llmService } from './llmService.js';
import { budgetService } from './budgetService.js';
import { buildMockItinerary } from '../utils/mockData.js';
import { isSupabaseConfigured } from '../utils/config.js';

export const itineraryService = {
  async list({ userId }) {
    if (!userId) {
      if (!isSupabaseConfigured()) {
        return [buildMockItinerary({ destination: '东京', companions: 3 })];
      }
      return [];
    }

    if (!isSupabaseConfigured()) {
      return [buildMockItinerary({ destination: '东京', companions: 3, budget: 12000 })];
    }

    const { data, error } = await supabaseClient
      .from('itineraries')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Supabase list itineraries failed: ${error.message}`);
    }

    return data ?? [];
  },

  async create(payload) {
    const itinerary = await llmService.generateItinerary(payload);

    const budget = budgetService.calculate(itinerary, { baseBudget: payload.budget });

    const record = {
      id: itinerary.id,
      user_id: payload.userId ?? null,
      request: payload,
      itinerary,
      budget,
      created_at: new Date().toISOString()
    };

    if (!isSupabaseConfigured()) {
      return record;
    }

    const { data, error } = await supabaseClient
      .from('itineraries')
      .insert(record)
      .select()
      .single();

    if (error) {
      throw new Error(`Supabase create itinerary failed: ${error.message}`);
    }

    return data;
  },

  async calculateBudget({ itineraryId, overrides, itinerary }) {
    let currentItinerary = itinerary;

    if (!currentItinerary && isSupabaseConfigured() && itineraryId) {
      const { data, error } = await supabaseClient
        .from('itineraries')
        .select('*')
        .eq('id', itineraryId)
        .single();

      if (error) {
        throw new Error(`Supabase fetch itinerary failed: ${error.message}`);
      }

      currentItinerary = data?.itinerary;

      const newBudget = budgetService.calculate(currentItinerary, overrides);

      await supabaseClient
        .from('itineraries')
        .update({ budget: newBudget })
        .eq('id', itineraryId);

      return newBudget;
    }

    if (!currentItinerary) {
      currentItinerary = buildMockItinerary({});
    }

    return budgetService.calculate(currentItinerary, overrides);
  }
};
