import crypto from 'crypto';

import { supabaseAdminClient } from './supabaseClient.js';
import { llmService } from './llmService.js';
import { budgetService } from './budgetService.js';
import { buildMockItinerary } from '../utils/mockData.js';
import { isSupabaseConfigured } from '../utils/config.js';
import { normalizeItineraryShape } from '../utils/itineraryShape.js';

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
    const { itinerary: rawItinerary, userId, ...request } = payload ?? {};
    const requestPayload = { ...request };

    let itinerary;
    if (rawItinerary && Object.keys(rawItinerary).length > 0) {
      itinerary = normalizeItineraryShape(rawItinerary, requestPayload);
    } else {
      itinerary = await llmService.generateItinerary(requestPayload);
    }

    const itineraryId = itinerary?.id ?? crypto.randomUUID();
    if (!itinerary?.id) {
      itinerary = { ...itinerary, id: itineraryId };
    }

    const budget = budgetService.calculate(itinerary, { baseBudget: requestPayload.budget ?? payload?.budget });

    const record = {
      id: itineraryId,
      user_id: userId ?? null,
      request: userId ? { ...requestPayload, userId } : requestPayload,
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

  async update({ itineraryId, userId, itinerary, budget, request }) {
    if (!itineraryId || !itinerary) {
      return null;
    }

    const normalized = normalizeItineraryShape(itinerary, request);
    const computedBudget = budget ?? budgetService.calculate(normalized, { baseBudget: request?.budget });

    const payload = {
      itinerary: normalized,
      budget: computedBudget,
      updated_at: new Date().toISOString()
    };

    if (request) {
      payload.request = { ...request };
    }

    if (!isSupabaseConfigured() || !supabaseAdminClient) {
      // eslint-disable-next-line no-console
      console.warn('[itineraryService] Supabase not configured, cannot update itinerary.');
      return null;
    }

    try {
      let query = supabaseAdminClient.from('itineraries').update(payload).eq('id', itineraryId);
      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query.select().single();

      if (error) {
        // eslint-disable-next-line no-console
        console.error(`[itineraryService] Supabase update itinerary failed: ${error.message}`);
        return null;
      }

      const storedItinerary = data?.itinerary;
      const storedBudget = data?.budget;

      // eslint-disable-next-line no-console
      console.log('[itineraryService] Supabase update result:', { storedItinerary });

      return {
        itinerary: storedItinerary ? normalizeItineraryShape(storedItinerary, request) : normalized,
        budget: storedBudget ?? computedBudget
      };
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`[itineraryService] Unexpected error during update: ${error.message}`);
      return null;
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
  },

  async remove({ itineraryId, userId }) {
    if (!itineraryId) {
      return false;
    }

    if (!isSupabaseConfigured() || !supabaseAdminClient) {
      return true;
    }

    try {
      let query = supabaseAdminClient.from('itineraries').delete().eq('id', itineraryId);
      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { error } = await query;

      if (error) {
        if (isMissingItinerariesTable(error)) {
          return true;
        }
        throw error;
      }

      return true;
    } catch (error) {
      throw new Error(`Supabase delete itinerary failed: ${error.message}`);
    }
  }
};

const isMissingItinerariesTable = (error) => {
  if (!error) return false;

  const message = String(error?.message ?? '').toLowerCase();
  return (
    message.includes('relation "public.itineraries" does not exist') || message.includes('schema cache')
  );
};
