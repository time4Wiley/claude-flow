import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { readFileSync } from 'fs';
import { join } from 'path';
import yaml from 'yaml';

// Import routers
import { agentsRouter } from './rest/agents';
import { workflowsRouter } from './rest/workflows';
import { goalsRouter } from './rest/goals';
import { messagesRouter } from './rest/messages';
import { webhooksRouter } from './rest/webhooks';
import { pluginsRouter } from './rest/plugins';

// Import middleware
import { authMiddleware } from './middleware/auth';
import { errorHandler } from './middleware/error-handler';
import { requestLogger } from './middleware/request-logger';
import { apiMetrics } from './middleware/metrics';

// Import GraphQL server
import { createGraphQLServer } from './graphql/server';

const app = express();
const port = process.env.PORT || 3000;

// Load OpenAPI specification
const openApiPath = join(__dirname, 'openapi.yaml');
const openApiDocument = yaml.parse(readFileSync(openApiPath, 'utf8'));

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(requestLogger);

// API metrics collection
app.use(apiMetrics);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to API routes
app.use('/v1', limiter);

// Health check endpoint (no auth required)
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    version: process.env.npm_package_version || '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// API documentation (no auth required)
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Agentic Flow API Documentation',
}));

// API v1 routes with authentication
app.use('/v1', authMiddleware);
app.use('/v1/agents', agentsRouter);
app.use('/v1/workflows', workflowsRouter);
app.use('/v1/goals', goalsRouter);
app.use('/v1/messages', messagesRouter);
app.use('/v1/webhooks', webhooksRouter);
app.use('/v1/plugins', pluginsRouter);

// GraphQL endpoint
createGraphQLServer(app);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'not_found',
    message: 'The requested resource was not found',
    path: req.path,
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
const server = app.listen(port, () => {
  console.log(`🚀 Agentic Flow API server running on port ${port}`);
  console.log(`📚 API documentation available at http://localhost:${port}/docs`);
  console.log(`🎯 GraphQL playground available at http://localhost:${port}/graphql`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export { app, server };