import './config/env.js';
import cors from 'cors';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { registerRoutes } from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();
const port = process.env.PORT || 5174;
const serveClient = process.env.SERVE_CLIENT === 'true';

app.use(cors());
app.use(express.json({ limit: '2mb' }));

registerRoutes(app);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

if (serveClient) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const clientDistPath = path.resolve(__dirname, '../../client/dist');

  if (fs.existsSync(clientDistPath)) {
    app.use(express.static(clientDistPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(clientDistPath, 'index.html'));
    });
  } else {
    // eslint-disable-next-line no-console
    console.warn('SERVE_CLIENT=true 但未找到 client/dist 静态资源');
  }
}

app.use(errorHandler);

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`AI Travel Planner API listening on port ${port}`);
});
