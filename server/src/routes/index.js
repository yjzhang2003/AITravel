import authRouter from './auth.js';
import configRouter from './config.js';
import debugRouter from './debug.js';
import itineraryRouter from './itineraries.js';
import voiceRouter from './voice.js';

export const registerRoutes = (app) => {
  app.use('/api/auth', authRouter);
  app.use('/api/itineraries', itineraryRouter);
  app.use('/api/voice', voiceRouter);
  app.use('/api/config', configRouter);
  if (process.env.NODE_ENV !== 'production') {
    app.use('/api/debug', debugRouter);
  }
};
