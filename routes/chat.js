/**
 * AI Chat Route (Customer Conversations)
 *
 * POST /api/v1/chat
 *
 * Handles customer conversation requests from live phone calls
 * Uses receptionist-style prompts, NOT training prompts
 */

const express = require('express');
const router = express.Router();

const {
  getCustomer,
  registerCustomer,
} = require('../services/firestore');

const { generateConversationResponse } = require('../services/vertexai');

/**
 * POST /api/v1/chat
 *
 * Request body:
 * {
 *   site_token: string (required)
 *   message: string (required)
 *   conversation_history: array (optional) - Previous turns
 *   context: string (optional) - "conversation"
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
    console.log('=== /api/v1/chat Request ===');
    console.log('Body:', JSON.stringify(req.body, null, 2));

    // 1. Validate required fields
    const { site_token, message, business_info, conversation_history, system_prompt } = req.body;

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

    // 2. Check Firestore for site_token (auto-register if needed)
    let customer = await getCustomer(site_token);

    if (!customer) {
      console.log('Customer not found - auto-registering');
      customer = await registerCustomer(site_token, business_info.business_name, {
        business_hours: business_info.business_hours,
        business_description: business_info.business_description,
      });
    }

    // 3. Generate AI conversation response (receptionist mode)
    console.log('Generating AI conversation response...');
    const aiResponse = await generateConversationResponse(
      business_info,
      message,
      conversation_history || [],
      system_prompt // Pass system_prompt from WordPress (may be undefined for backward compatibility)
    );

    // 4. Return response
    console.log('=== /api/v1/chat Success ===');
    return res.json({
      success: true,
      ai_response: aiResponse.text,
      tokens_used: aiResponse.tokensUsed,
    });
  } catch (error) {
    console.error('=== /api/v1/chat Error ===');
    console.error('Error:', error);

    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
});

module.exports = router;
