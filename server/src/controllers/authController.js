import { supabaseAdminClient, supabaseAuthClient } from '../services/supabaseClient.js';
import { isSupabaseConfigured } from '../utils/config.js';

export const authController = {
  async register(req, res, next) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
      }

      if (!isSupabaseConfigured() || !supabaseAdminClient || !supabaseAuthClient) {
        return res.status(503).json({ error: 'Supabase 未配置，暂无法注册用户。' });
      }

      const { data, error } = await supabaseAdminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true
      });

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      const { data: signInData, error: signInError } = await supabaseAuthClient.auth.signInWithPassword({
        email,
        password
      });

      if (signInError) {
        return res.status(201).json({ user: data.user });
      }

      return res.status(201).json({ user: data.user, session: signInData.session });
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

      if (!isSupabaseConfigured() || !supabaseAuthClient) {
        return res.status(503).json({ error: 'Supabase 未配置，暂无法登录。' });
      }

      const { data, error } = await supabaseAuthClient.auth.signInWithPassword({
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
