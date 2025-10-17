import { supabaseClient } from '../services/supabaseClient.js';
import { isSupabaseConfigured } from '../utils/config.js';

export const authController = {
  async register(req, res, next) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
      }

      if (!isSupabaseConfigured() || !supabaseClient) {
        return res.status(503).json({ error: 'Supabase 未配置，暂无法注册用户。' });
      }

      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password
      });

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      if (!isSupabaseConfigured() || !supabaseClient) {
        return res.status(503).json({ error: 'Supabase 未配置，暂无法登录。' });
      }

      return res.status(201).json({ user: data.user });
    } catch (error) {
      next(error);
    }
  },

  async login(req, res, next) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
      }

      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      return res.json({ session: data.session, user: data.user });
    } catch (error) {
      next(error);
    }
  }
};
