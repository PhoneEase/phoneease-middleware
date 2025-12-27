/**
 * AI Training Route
 *
 * POST /api/v1/train
 *
 * Handles training requests from WordPress admin
 * Validates site_token, checks limits, calls Gemini, tracks usage
 */

const express = require('express');
const router = express.Router();

const {
  getCustomer,
  registerCustomer,
  incrementTrainingUsage,
  hasExceededTrainingLimit,
} = require('../services/firestore');

const vertexAI = require('../services/vertexai');
const anthropic = require('../services/anthropic');

/**
 * POST /api/v1/train
 *
 * Request body:
 * {
 *   site_token: string (required)
 *   message: string (required)
 *   model: string (optional) - AI model to use (defaults to gemini-2.0-flash-exp)
 *     Supported: gemini-2.5-flash-lite, gemini-2.5-flash, gemini-3-flash-preview,
 *                claude-haiku-4-5, claude-sonnet-4-5
 *   context: string (optional)
 *   business_info: {
 *     business_name: string (required)
 *     business_hours: string (optional)
 *     business_description: string (optional)
 *   }
 * }
 *
 * Response:
 * {
 *   success: true,
 *   ai_response: string,
 *   tokens_used: number
 * }
 */
router.post('/', async (req, res) => {
  try {
    console.log('=== /api/v1/train Request ===');
    console.log('Body:', JSON.stringify(req.body, null, 2));

    // 1. Validate required fields
    const { site_token, message, business_info, model } = req.body;

    // Default model if not specified
    const selectedModel = model || process.env.VERTEX_AI_MODEL || 'gemini-2.0-flash-exp';

    if (!site_token) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: site_token',
      });
    }

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: message',
      });
    }

    if (!business_info || !business_info.business_name) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: business_info.business_name',
      });
    }

    // 2. Check Firestore for site_token
    let customer = await getCustomer(site_token);

    // 3. Auto-register if not found
    if (!customer) {
      console.log('Customer not found - auto-registering');
      customer = await registerCustomer(site_token, business_info.business_name, {
        business_hours: business_info.business_hours,
        business_description: business_info.business_description,
      });
    }

    // 4. Check training limits
    if (hasExceededTrainingLimit(customer)) {
      return res.status(429).json({
        success: false,
        error: 'Training limit exceeded',
        training_used: customer.training_used,
        training_limit: customer.training_limit,
      });
    }

    // 5. Generate AI response with selected model
    console.log(`Generating AI response using model: ${selectedModel}...`);

    let aiResponse;
    const isClaude = selectedModel.startsWith('claude-');

    if (isClaude) {
      // Use Claude (Anthropic)
      const prompt = vertexAI.buildTrainingPrompt(business_info, message);
      aiResponse = await anthropic.generateTrainingResponse(selectedModel, prompt, message);
    } else {
      // Use Gemini (VertexAI) - pass model name for dynamic selection
      aiResponse = await vertexAI.generateTrainingResponse(business_info, message, selectedModel);
    }

    // 6. Increment training counter
    await incrementTrainingUsage(customer.id);

    // 7. Return response
    console.log('=== /api/v1/train Success ===');
    return res.json({
      success: true,
      ai_response: aiResponse.text,
      tokens_used: aiResponse.tokensUsed,
    });
  } catch (error) {
    console.error('=== /api/v1/train Error ===');
    console.error('Error:', error);

    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
});

module.exports = router;
