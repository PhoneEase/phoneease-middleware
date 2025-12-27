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
 * @param {string} modelName - Optional model name (defaults to MODEL_NAME)
 * @returns {Promise<Object>} Response with text, tokens, and response time
 */
async function callGemini(prompt, modelName = null) {
  console.log('=== VERTEX AI API CALL ===');
  const startTime = Date.now();

  const selectedModel = modelName || MODEL_NAME;

  try {
    console.log('├─ Model:', selectedModel);
    console.log('├─ Prompt length:', prompt.length, 'characters');

    // Model initialization
    const modelInitStart = Date.now();
    const model = vertexAI.getGenerativeModel({
      model: selectedModel,
      generationConfig: {
        maxOutputTokens: 150,      // Receptionist responses should be concise (1-2 sentences)
        temperature: 0.7,           // Lower = faster, more consistent responses
        topP: 0.9,                  // Slightly more focused sampling
        candidateCount: 1,          // Only generate 1 response
      },
      safetySettings: [
        {
          category: 'HARM_CATEGORY_HATE_SPEECH',
          threshold: 'BLOCK_ONLY_HIGH',
        },
        {
          category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
          threshold: 'BLOCK_ONLY_HIGH',
        },
        {
          category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
          threshold: 'BLOCK_ONLY_HIGH',
        },
        {
          category: 'HARM_CATEGORY_HARASSMENT',
          threshold: 'BLOCK_ONLY_HIGH',
        },
      ],
    });
    const modelInitTime = Date.now() - modelInitStart;
    console.log(`├─ Model initialization: ${modelInitTime}ms`);

    // API call
    const apiStart = Date.now();
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    const apiTime = Date.now() - apiStart;
    console.log(`├─ Vertex AI API call: ${apiTime}ms`);

    // Response processing
    const processingStart = Date.now();
    const response = result.response;
    const text = response.candidates[0].content.parts[0].text;
    const tokensUsed = response.usageMetadata?.totalTokenCount || 0;
    const processingTime = Date.now() - processingStart;
    console.log(`├─ Response processing: ${processingTime}ms`);

    const totalTime = Date.now() - startTime;
    console.log(`├─ Response length: ${text.length} characters`);
    console.log(`├─ Tokens used: ${tokensUsed}`);
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
 * Generate AI training response
 *
 * @param {Object} businessInfo - Business information
 * @param {string} message - User's training question
 * @param {string} modelName - Optional model name
 * @returns {Promise<Object>} AI response with text and tokens
 */
async function generateTrainingResponse(businessInfo, message, modelName = null) {
  const prompt = buildTrainingPrompt(businessInfo, message);
  return await callGemini(prompt, modelName);
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
  // PERFORMANCE OPTIMIZATION: Only use last 5 turns to reduce latency
  // Each turn = customer message + AI response = 2 messages
  // 5 turns = 10 messages maximum
  const MAX_HISTORY_TURNS = 5;
  const maxMessages = MAX_HISTORY_TURNS * 2;

  const recentHistory = conversationHistory.length > maxMessages
    ? conversationHistory.slice(-maxMessages)
    : conversationHistory;

  if (conversationHistory.length > maxMessages) {
    console.log(`Vertex AI: Conversation history optimization - Using last ${recentHistory.length} messages (${conversationHistory.length} total, ${conversationHistory.length - recentHistory.length} truncated)`);
  }

  let prompt;

  if (systemPrompt) {
    console.log('Vertex AI: Using WordPress system prompt (includes caller ID, detailed instructions)');

    // PERFORMANCE OPTIMIZATION: Trim excessive whitespace from system prompt to reduce token count
    const optimizedPrompt = systemPrompt
      .replace(/\n{3,}/g, '\n\n')      // Replace 3+ newlines with 2
      .replace(/\s{2,}/g, ' ')         // Replace multiple spaces with 1
      .trim();

    if (systemPrompt.length !== optimizedPrompt.length) {
      console.log(`Vertex AI: System prompt optimization - Size reduced: ${systemPrompt.length} → ${optimizedPrompt.length} chars (${systemPrompt.length - optimizedPrompt.length} chars saved)`);
    }

    // WordPress system prompt is the instruction set - we still need to append conversation history and current message
    prompt = optimizedPrompt;

    // Add conversation history if provided (using optimized recent history)
    if (recentHistory && recentHistory.length > 0) {
      prompt += '\n\nConversation so far:';
      recentHistory.forEach((turn) => {
        const speaker = turn.role === 'user' ? 'Customer' : 'You';
        prompt += `\n${speaker}: ${turn.content}`;
      });
    }

    // Add current message
    prompt += `\n\nCustomer says: ${message}\n\nRespond professionally:`;

  } else {
    console.log('Vertex AI: Using fallback buildConversationPrompt (simple prompt - no caller ID)');
    // Fall back to the simple buildConversationPrompt for backward compatibility
    prompt = buildConversationPrompt(businessInfo, message, recentHistory);
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
