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
 * FUTURE: Build AI prompt for phone calls (Production Context)
 *
 * When handling actual phone calls via Twilio, use a different prompt structure
 * that presents the AI as a business employee, not as an AI assistant.
 *
 * IMPORTANT DIFFERENCES FROM TRAINING PROMPT:
 * - Use "we" and "our" instead of "I'm an AI"
 * - Speak on behalf of the business as if you're an employee
 * - Never mention being an AI or not having information
 * - Provide professional, employee-like responses
 *
 * Example implementation for future /api/v1/twilio/gather endpoint:
 *
 * function buildPhoneCallPrompt(businessInfo, message) {
 *   let prompt = `You are the virtual receptionist for ${businessInfo.business_name}.
 *
 * IMPORTANT INSTRUCTIONS:
 * - Speak on behalf of the business using "we" and "our"
 * - Never say "I'm an AI" or "I don't have business hours"
 * - Answer as if you are an employee of ${businessInfo.business_name}
 * - Keep responses concise and suitable for phone conversation`;
 *
 *   if (businessInfo.business_description) {
 *     prompt += `\n\nAbout us: ${businessInfo.business_description}`;
 *   }
 *
 *   if (businessInfo.business_hours) {
 *     prompt += `\n\nBusiness hours: ${businessInfo.business_hours}`;
 *   }
 *
 *   if (businessInfo.services) {
 *     prompt += `\n\nServices we offer: ${businessInfo.services}`;
 *   }
 *
 *   prompt += `\n\nCustomer says: ${message}\n\nRespond professionally as ${businessInfo.business_name}'s receptionist:`;
 *
 *   return prompt;
 * }
 */

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

module.exports = {
  generateTrainingResponse,
  buildTrainingPrompt,
  callGemini,
};
