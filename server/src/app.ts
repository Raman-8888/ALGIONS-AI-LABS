import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import { config } from './common/config/index.js';
import { requestIdMiddleware } from './common/middleware/requestId.js';
import { errorHandler } from './common/middleware/errorHandler.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { usersRouter } from './modules/users/users.routes.js';
import { genresRouter } from './modules/genres/genres.routes.js';
import { moviesRouter } from './modules/movies/movies.routes.js';
import { theatresRouter } from './modules/theatres/theatres.routes.js';
import { screensRouter } from './modules/screens/screens.routes.js';
import { showsRouter } from './modules/shows/shows.routes.js';

export const app: Express = express();

// 1. Request ID & Security Headers
app.use(requestIdMiddleware);
app.use(helmet());
app.use(
  cors({
    origin: config.clientUrl,
    credentials: true,
  }),
);

// 2. Cookie & Body Parsers
app.use(cookieParser(config.cookieSecret));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// 3. Infrastructure & Health Endpoints
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', requestId: req.id, timestamp: new Date().toISOString() });
});

app.get('/ready', (req: Request, res: Response) => {
  const isConnected = mongoose.connection.readyState === 1;
  if (!isConnected) {
    return res.status(503).json({
      status: 'unavailable',
      details: 'Database connection not ready',
      requestId: req.id,
    });
  }
  return res.status(200).json({
    status: 'ready',
    database: mongoose.connection.name,
    requestId: req.id,
    timestamp: new Date().toISOString(),
  });
});

// 4. API Routes
app.get(config.apiPrefix, (req: Request, res: Response) => {
  res.json({
    message: 'Cinema Hall Ticket Booking API v1',
    status: 'running',
    requestId: req.id,
    docs: '/api/docs',
  });
});

app.use(`${config.apiPrefix}/auth`, authRouter);
app.use(`${config.apiPrefix}/users`, usersRouter);
app.use(`${config.apiPrefix}/genres`, genresRouter);
app.use(`${config.apiPrefix}/movies`, moviesRouter);
app.use(`${config.apiPrefix}/theatres`, theatresRouter);
app.use(`${config.apiPrefix}/screens`, screensRouter);
app.use(`${config.apiPrefix}/shows`, showsRouter);

// 5. Global 404 Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Cannot ${req.method} ${req.originalUrl}`,
      requestId: req.id,
    },
  });
});

// 6. Global Error Handler
app.use(errorHandler);
