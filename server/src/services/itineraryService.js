import { supabaseAdminClient } from './supabaseClient.js';
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

    if (!isSupabaseConfigured() || !supabaseAdminClient) {
      return [buildMockItinerary({ destination: '东京', companions: 3, budget: 12000 })];
    }

    try {
      const { data, error } = await supabaseAdminClient
        .from('itineraries')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        if (isMissingItinerariesTable(error)) {
          return [buildMockItinerary({ destination: '东京', companions: 3, budget: 12000 })];
        }
        throw error;
      }

      return data ?? [];
    } catch (error) {
      throw new Error(`Supabase list itineraries failed: ${error.message}`);
    }
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

    if (!isSupabaseConfigured() || !supabaseAdminClient) {
      return record;
    }

    try {
      const { data, error } = await supabaseAdminClient
        .from('itineraries')
        .insert(record)
        .select()
        .single();

      if (error) {
        if (isMissingItinerariesTable(error)) {
          return record;
        }
        throw error;
      }

      return data;
    } catch (error) {
      throw new Error(`Supabase create itinerary failed: ${error.message}`);
    }
  },

  async calculateBudget({ itineraryId, overrides, itinerary }) {
    let currentItinerary = itinerary;

    if (!currentItinerary && isSupabaseConfigured() && supabaseAdminClient && itineraryId) {
      try {
        const { data, error } = await supabaseAdminClient
          .from('itineraries')
          .select('*')
          .eq('id', itineraryId)
          .single();

        if (error) {
          if (isMissingItinerariesTable(error)) {
            currentItinerary = buildMockItinerary({});
          } else {
            throw error;
          }
        } else {
          currentItinerary = data?.itinerary;

          const newBudget = budgetService.calculate(currentItinerary, overrides);

          await supabaseAdminClient
            .from('itineraries')
            .update({ budget: newBudget })
            .eq('id', itineraryId);

          return newBudget;
        }
      } catch (error) {
        if (!isMissingItinerariesTable(error)) {
          throw new Error(`Supabase fetch itinerary failed: ${error.message}`);
        }
      }
    }

    if (!currentItinerary) {
      currentItinerary = buildMockItinerary({});
    }

    return budgetService.calculate(currentItinerary, overrides);
  }
};

const isMissingItinerariesTable = (error) => {
  if (!error) return false;

  const message = String(error?.message ?? '').toLowerCase();
  const code = error?.code;

  return (
    message.includes('could not find the table') ||
    message.includes('relation "public.itineraries" does not exist') ||
    message.includes('schema cache') ||
    code === 'PGRST301' ||
    code === 'PGRST305' ||
    code === '42P01'
  );
};
