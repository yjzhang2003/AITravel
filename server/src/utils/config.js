export const isSupabaseConfigured = () =>
  Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

export const isLLMConfigured = () => Boolean(process.env.LLM_API_URL && process.env.LLM_API_KEY);

export const isVoiceConfigured = () => Boolean(process.env.VOICE_API_URL && process.env.VOICE_API_KEY);
