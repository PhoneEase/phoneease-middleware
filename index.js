/**
 * PhoneEase Middleware - Cloud Run API
 *
 * Entry point for Express server handling:
 * - AI Training endpoint (/api/v1/train)
 * - Twilio webhooks (future)
 * - Customer registration (future)
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const trainRouter = require('./routes/train');
const chatRouter = require('./routes/chat');
const registerRouter = require('./routes/register');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'phoneease-middleware',
    timestamp: new Date().toISOString()
  });
});

// Performance monitoring endpoint
app.get('/api/v1/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'phoneease-middleware',
    version: '0.9.13',
    performance: {
      target_response_time: '1500-2500ms',
      vertex_ai_model: 'gemini-2.0-flash-exp',
      optimizations: {
        max_history_turns: 5,
        max_output_tokens: 150,
        temperature: 0.7,
        top_p: 0.9,
      },
    },
  });
});

// API Routes
app.use('/api/v1/train', trainRouter);
app.use('/api/v1/chat', chatRouter);
app.use('/api/v1/customers', registerRouter);

// 404 handler
app.use((req, res) => {
  console.log(`404 - Route not found: ${req.method} ${req.path}`);
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`PhoneEase Middleware listening on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Project: ${process.env.GOOGLE_CLOUD_PROJECT || 'not set'}`);
});
