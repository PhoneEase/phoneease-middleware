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
 * Build AI prompt for training
 *
 * @param {Object} businessInfo - Business information
 * @param {string} message - User's training question
 * @returns {string} Formatted prompt
 */
function buildTrainingPrompt(businessInfo, message) {
  let prompt = `You are an AI assistant for ${businessInfo.business_name}.`;

  // Add business description if available
  if (businessInfo.business_description) {
    prompt += `\n\nAbout the business: ${businessInfo.business_description}`;
  }

  // Add business hours if available
  if (businessInfo.business_hours) {
    prompt += `\n\nBusiness hours: ${businessInfo.business_hours}`;
  }

  prompt += `\n\nRespond to the following training question in a helpful, professional manner:\n${message}`;

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

module.exports = {
  generateTrainingResponse,
  buildTrainingPrompt,
  callGemini,
};
