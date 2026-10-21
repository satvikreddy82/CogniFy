import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import pino from 'pino';
import rateLimit from 'express-rate-limit';

import authRouter from './routes/auth';
import coursesRouter from './routes/courses';
import papersRouter from './routes/papers';
import questionsRouter from './routes/questions';
import assessmentsRouter from './routes/assessments';
import adminRouter from './routes/admin';
import deanRouter from './routes/dean';
import notificationsRouter from './routes/notifications';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
const app = express();

// ─── Global Middleware ────────────────────────────────────────────────────────
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
app.use(cors({ origin: allowedOrigins, credentials: true }));

// Global rate limit (generous — auth endpoints have their own stricter ones)
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logger
app.use((req, _res, next) => {
  logger.info({ method: req.method, url: req.originalUrl });
  next();
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/courses', coursesRouter);
app.use('/api/v1/papers', papersRouter);
app.use('/api/v1/questions', questionsRouter);
app.use('/api/v1/assessments', assessmentsRouter);
app.use('/api/v1/dean', deanRouter);
app.use('/api/v1/admin', adminRouter);
app.use('/api/v1/notifications', notificationsRouter);

// Health check (used by deployment providers)
app.get('/health', (_req, res) =>
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
);

// 404 + Error handling
app.use(notFoundHandler);
app.use(errorHandler);

const PORT = Number(process.env.PORT) || 4000;
const HOST = process.env.HOST || '0.0.0.0';
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, HOST, () => {
    logger.info(`CogniFy backend running on http://${HOST}:${PORT}`);
  });
}

export default app;
