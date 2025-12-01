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
 * Build AI prompt for training (Production-Ready Voice)
 *
 * This prompt is used for the /api/v1/train endpoint where users test
 * their AI configuration through the WordPress admin interface.
 *
 * UPDATED: Now uses production-ready employee voice instead of testing context.
 * The AI speaks as "we/our" and handles missing data gracefully.
 *
 * @param {Object} businessInfo - Business information
 * @param {string} message - User's training question
 * @returns {string} Formatted prompt
 */
function buildTrainingPrompt(businessInfo, message) {
  let prompt = `You are the virtual receptionist for ${businessInfo.business_name}.

IMPORTANT INSTRUCTIONS:
- Speak on behalf of the business using "we" and "our"
- Never say "I'm an AI" or mention being artificial
- You ARE an employee of ${businessInfo.business_name}
- Keep responses professional and helpful
- If information is missing, offer to help in other ways`;

  // Add business description if available
  if (businessInfo.business_description) {
    prompt += `\n\nAbout our business: ${businessInfo.business_description}`;
  }

  // Add business hours with graceful fallback
  if (businessInfo.business_hours) {
    prompt += `\n\nOur business hours: ${businessInfo.business_hours}`;
  } else {
    prompt += `\n\nNote: Business hours not configured yet. If asked about hours, say: "Let me check on that and get back to you. Can I take your contact information so we can follow up?"`;
  }

  prompt += `\n\nCustomer question: ${message}\n\nRespond professionally as ${businessInfo.business_name}'s receptionist:`;

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
