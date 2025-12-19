/**
 * Vertex AI Service
 *
 * Handles Gemini API integration for AI training responses
 */

const { VertexAI } = require('@google-cloud/vertexai');

// Initialize Vertex AI
const vertexAI = new VertexAI({
  project: process.env.GOOGLE_CLOUD_PROJECT,
  location: process.env.VERTEX_AI_LOCATION || 'us-central1',
});

// Model configuration
const MODEL_NAME = process.env.VERTEX_AI_MODEL || 'gemini-2.0-flash-exp';

/**
 * Build AI prompt for training (Owner-Assistant Context)
 *
 * This prompt is used for the /api/v1/train endpoint where business OWNERS
 * configure and test their AI receptionist through the WordPress admin interface.
 *
 * IMPORTANT: The AI is talking to the business OWNER, not to customers.
 * The AI helps owners identify missing configuration and guides them to Settings.
 *
 * @param {Object} businessInfo - Business information
 * @param {string} message - Owner's training question
 * @returns {string} Formatted prompt
 */
function buildTrainingPrompt(businessInfo, message) {
  const prompt = `You are an AI training assistant helping the owner of ${businessInfo.business_name} configure their phone receptionist.

CONTEXT:
- The person you're talking to is the business OWNER, not a customer
- Help them identify and configure missing information
- Be helpful and guide them to Settings when needed
- Explain how you will interact with customers once configured

CURRENT CONFIGURATION:
Business Name: ${businessInfo.business_name}
Business Hours: ${businessInfo.business_hours || 'NOT SET - Recommend adding in Settings'}
  (When the physical business is open. NOTE: Your AI receptionist operates 24/7 and is always available to answer calls)
Business Description: ${businessInfo.business_description || 'NOT SET - Optional but helpful'}

The owner asks: ${message}

Respond as a helpful AI training assistant who helps them improve their setup:`;

  return prompt;
}

/**
 * Build AI prompt for customer conversations (Production Context)
 *
 * This prompt is used for actual customer phone calls where the AI acts as
 * a professional receptionist for the business.
 *
 * IMPORTANT DIFFERENCES FROM TRAINING PROMPT:
 * - Use "we" and "our" instead of "I'm an AI"
 * - Speak on behalf of the business as if you're an employee
 * - Never mention being an AI or not having information
 * - Provide professional, employee-like responses
 *
 * @param {Object} businessInfo - Business information
 * @param {string} message - Customer's message
 * @param {Array} conversationHistory - Previous conversation turns (optional)
 * @returns {string} Formatted prompt
 */
function buildConversationPrompt(businessInfo, message, conversationHistory = []) {
  let prompt = `You are the virtual receptionist for ${businessInfo.business_name}.

CRITICAL RULES:
1. ONLY provide information that was explicitly given to you in the business context below
2. NEVER make up, fabricate, or assume information that wasn't provided
3. If you don't have specific information, politely say: "I don't have that specific information right now, but I'd be happy to take your contact information and have someone get back to you"
4. Speak on behalf of the business using "we" and "our"
5. Never mention that you are an AI
6. Keep responses concise and suitable for phone conversation
7. Be helpful, professional, and friendly`;

  if (businessInfo.business_description) {
    prompt += `\n\nAbout our business: ${businessInfo.business_description}`;
  }

  if (businessInfo.business_hours) {
    prompt += `\n\nOur business hours: ${businessInfo.business_hours}`;
  }

  if (businessInfo.services) {
    prompt += `\n\nServices we offer: ${businessInfo.services}`;
  }

  // Add conversation history if provided
  if (conversationHistory && conversationHistory.length > 0) {
    prompt += `\n\nConversation so far:`;
    conversationHistory.forEach((turn) => {
      const speaker = turn.role === 'user' ? 'Customer' : 'You';
      prompt += `\n${speaker}: ${turn.content}`;
    });
  }

  prompt += `\n\nCustomer says: ${message}\n\nRespond professionally as ${businessInfo.business_name}'s receptionist:`;

  return prompt;
}

/**
 * Call Gemini API with prompt
 *
 * @param {string} prompt - The prompt to send
 * @returns {Promise<Object>} Response with text and tokens
 */
async function callGemini(prompt) {
  try {
    console.log('Vertex AI: Calling Gemini model:', MODEL_NAME);
    console.log('Vertex AI: Prompt:', prompt);

    // Get the generative model
    const model = vertexAI.getGenerativeModel({
      model: MODEL_NAME,
    });

    // Generate content
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const response = result.response;
    const text = response.candidates[0].content.parts[0].text;

    // Extract token usage (if available)
    const tokensUsed = response.usageMetadata?.totalTokenCount || 0;

    console.log('Vertex AI: Response received');
    console.log('Vertex AI: Response text:', text);
    console.log('Vertex AI: Tokens used:', tokensUsed);

    return {
      text,
      tokensUsed,
    };
  } catch (error) {
    console.error('Vertex AI: Error calling Gemini:', error);
    throw error;
  }
}

/**
 * Generate AI training response
 *
 * @param {Object} businessInfo - Business information
 * @param {string} message - User's training question
 * @returns {Promise<Object>} AI response with text and tokens
 */
async function generateTrainingResponse(businessInfo, message) {
  const prompt = buildTrainingPrompt(businessInfo, message);
  return await callGemini(prompt);
}

/**
 * Generate AI conversation response (for customer phone calls)
 *
 * @param {Object} businessInfo - Business information
 * @param {string} message - Customer's message
 * @param {Array} conversationHistory - Previous conversation turns
 * @param {string} systemPrompt - Optional: Full system prompt from WordPress (overrides buildConversationPrompt)
 * @returns {Promise<Object>} AI response with text and tokens
 */
async function generateConversationResponse(businessInfo, message, conversationHistory = [], systemPrompt = null) {
  let prompt;

  if (systemPrompt) {
    console.log('Vertex AI: Using WordPress system prompt (includes caller ID, detailed instructions)');

    // WordPress system prompt is the instruction set - we still need to append conversation history and current message
    prompt = systemPrompt;

    // Add conversation history if provided
    if (conversationHistory && conversationHistory.length > 0) {
      prompt += '\n\nConversation so far:';
      conversationHistory.forEach((turn) => {
        const speaker = turn.role === 'user' ? 'Customer' : 'You';
        prompt += `\n${speaker}: ${turn.content}`;
      });
    }

    // Add current message
    prompt += `\n\nCustomer says: ${message}\n\nRespond professionally:`;

  } else {
    console.log('Vertex AI: Using fallback buildConversationPrompt (simple prompt - no caller ID)');
    // Fall back to the simple buildConversationPrompt for backward compatibility
    prompt = buildConversationPrompt(businessInfo, message, conversationHistory);
  }

  return await callGemini(prompt);
}

module.exports = {
  generateTrainingResponse,
  generateConversationResponse,
  buildTrainingPrompt,
  buildConversationPrompt,
  callGemini,
};
