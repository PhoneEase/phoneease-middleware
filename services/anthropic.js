/**
 * Anthropic (Claude) AI Service
 *
 * Handles Claude API integration for AI training and conversation responses
 */

const Anthropic = require('@anthropic-ai/sdk');

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Call Claude API with prompt
 *
 * @param {string} model - Model name (claude-haiku-4-5 or claude-sonnet-4-5)
 * @param {string} prompt - The system prompt
 * @param {string} message - The user message
 * @param {Array} conversationHistory - Previous conversation turns (optional)
 * @returns {Promise<Object>} Response with text, tokens, and response time
 */
async function callClaude(model, prompt, message, conversationHistory = []) {
  console.log('=== ANTHROPIC API CALL ===');
  const startTime = Date.now();

  try {
    console.log('├─ Model:', model);
    console.log('├─ Prompt length:', prompt.length, 'characters');
    console.log('├─ Message:', message);

    // Build messages array from conversation history
    const messages = [];

    // Add conversation history
    if (conversationHistory && conversationHistory.length > 0) {
      conversationHistory.forEach((turn) => {
        messages.push({
          role: turn.role === 'user' ? 'user' : 'assistant',
          content: turn.content
        });
      });
    }

    // Add current message
    messages.push({
      role: 'user',
      content: message
    });

    // API call
    const apiStart = Date.now();
    const response = await anthropic.messages.create({
      model: model,
      max_tokens: 150,  // Match Gemini's concise response length
      temperature: 0.7,
      system: prompt,   // System prompt goes here
      messages: messages
    });
    const apiTime = Date.now() - apiStart;
    console.log(`├─ Anthropic API call: ${apiTime}ms`);

    // Extract response
    const text = response.content[0].text;
    const tokensUsed = response.usage.input_tokens + response.usage.output_tokens;

    const totalTime = Date.now() - startTime;
    console.log(`├─ Response length: ${text.length} characters`);
    console.log(`├─ Tokens used: ${tokensUsed} (${response.usage.input_tokens} in, ${response.usage.output_tokens} out)`);
    console.log(`└─ TOTAL TIME: ${totalTime}ms`);

    // Performance warning
    if (totalTime > 3000) {
      console.log(`⚠️  WARNING: Slow response (${totalTime}ms) - target is <2500ms`);
    } else if (totalTime < 2500) {
      console.log(`✓ Performance target met (${totalTime}ms < 2500ms)`);
    }

    return {
      text,
      tokensUsed,
      responseTimeMs: totalTime,
    };
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.log(`└─ ERROR after ${totalTime}ms: ${error.message}`);
    throw error;
  }
}

/**
 * Generate AI training response using Claude
 *
 * @param {string} model - Claude model name
 * @param {string} prompt - System prompt
 * @param {string} message - User's training question
 * @returns {Promise<Object>} AI response with text and tokens
 */
async function generateTrainingResponse(model, prompt, message) {
  return await callClaude(model, prompt, message, []);
}

/**
 * Generate AI conversation response using Claude (for customer phone calls)
 *
 * @param {string} model - Claude model name
 * @param {string} systemPrompt - System prompt with instructions
 * @param {string} message - Customer's message
 * @param {Array} conversationHistory - Previous conversation turns
 * @returns {Promise<Object>} AI response with text and tokens
 */
async function generateConversationResponse(model, systemPrompt, message, conversationHistory = []) {
  // PERFORMANCE OPTIMIZATION: Only use last 5 turns to reduce latency
  const MAX_HISTORY_TURNS = 5;
  const maxMessages = MAX_HISTORY_TURNS * 2;

  const recentHistory = conversationHistory.length > maxMessages
    ? conversationHistory.slice(-maxMessages)
    : conversationHistory;

  if (conversationHistory.length > maxMessages) {
    console.log(`Claude: Conversation history optimization - Using last ${recentHistory.length} messages (${conversationHistory.length} total, ${conversationHistory.length - recentHistory.length} truncated)`);
  }

  return await callClaude(model, systemPrompt, message, recentHistory);
}

module.exports = {
  generateTrainingResponse,
  generateConversationResponse,
  callClaude,
};
