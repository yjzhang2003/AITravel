import authRouter from './auth.js';
import configRouter from './config.js';
import itineraryRouter from './itineraries.js';
import voiceRouter from './voice.js';

export const registerRoutes = (app) => {
  app.use('/api/auth', authRouter);
  app.use('/api/itineraries', itineraryRouter);
  app.use('/api/voice', voiceRouter);
  app.use('/api/config', configRouter);
};
