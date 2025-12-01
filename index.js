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

// API Routes
app.use('/api/v1/train', trainRouter);

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
