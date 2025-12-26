/**
 * PhoneEase Middleware Performance Test
 *
 * Tests response time optimizations for AI receptionist conversations.
 * Target: 1500-2500ms average response time
 *
 * Usage:
 *   node test-performance.js [middleware-url]
 *
 * Examples:
 *   node test-performance.js
 *   node test-performance.js https://phoneease-middleware-375589245036.us-central1.run.app
 *   node test-performance.js http://localhost:8080
 */

const https = require('https');
const http = require('http');

// Default to Cloud Run production URL
const MIDDLEWARE_URL = process.argv[2] || 'https://phoneease-middleware-375589245036.us-central1.run.app';

// Test messages simulating real customer questions
const TEST_MESSAGES = [
  'What are your hours?',
  'How much does it cost?',
  'Can someone call me back?',
  'I need to schedule an appointment',
  'Where are you located?',
  'Do you offer emergency services?',
  'What services do you provide?',
  'Are you open on weekends?',
  'Can I speak to someone?',
  'I have a question about my account',
];

// Sample business info for testing
const BUSINESS_INFO = {
  business_name: 'Test Business',
  business_hours: 'Monday-Friday 9AM-5PM',
  business_description: 'We provide professional services to help customers with their needs.',
};

/**
 * Make HTTP/HTTPS request
 */
function makeRequest(url, data) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : http;

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = protocol.request(options, (res) => {
      let body = '';

      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          resolve(response);
        } catch (error) {
          reject(new Error(`Failed to parse response: ${body}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(JSON.stringify(data));
    req.end();
  });
}

/**
 * Test a single message
 */
async function testMessage(message, conversationHistory = []) {
  const start = Date.now();

  try {
    const response = await makeRequest(`${MIDDLEWARE_URL}/api/v1/chat`, {
      site_token: 'test-performance-token',
      message: message,
      business_info: BUSINESS_INFO,
      conversation_history: conversationHistory,
    });

    const elapsed = Date.now() - start;

    if (!response.success) {
      throw new Error(response.error || 'API returned success: false');
    }

    return {
      success: true,
      message: message,
      response: response.ai_response,
      elapsed: elapsed,
      tokens: response.tokens_used || 0,
    };
  } catch (error) {
    const elapsed = Date.now() - start;
    return {
      success: false,
      message: message,
      error: error.message,
      elapsed: elapsed,
    };
  }
}

/**
 * Run performance tests
 */
async function runTests() {
  console.log('=================================');
  console.log('PhoneEase Performance Test');
  console.log('=================================');
  console.log(`Middleware URL: ${MIDDLEWARE_URL}`);
  console.log(`Test messages: ${TEST_MESSAGES.length}`);
  console.log(`Target: 1500-2500ms per response`);
  console.log('=================================\n');

  const results = [];
  const conversationHistory = [];

  for (let i = 0; i < TEST_MESSAGES.length; i++) {
    const message = TEST_MESSAGES[i];
    console.log(`[${i + 1}/${TEST_MESSAGES.length}] Testing: "${message}"`);

    const result = await testMessage(message, conversationHistory);
    results.push(result);

    if (result.success) {
      console.log(`✓ Response: "${result.response.substring(0, 60)}${result.response.length > 60 ? '...' : ''}"`);
      console.log(`  Time: ${result.elapsed}ms | Tokens: ${result.tokens}`);

      // Add to conversation history for next test (simulates real conversation)
      conversationHistory.push(
        { role: 'user', content: message },
        { role: 'assistant', content: result.response }
      );
    } else {
      console.log(`✗ Error: ${result.error}`);
      console.log(`  Time: ${result.elapsed}ms`);
    }

    console.log('');

    // Small delay between requests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Calculate statistics
  const successfulTests = results.filter(r => r.success);
  const failedTests = results.filter(r => !r.success);

  if (successfulTests.length === 0) {
    console.log('=================================');
    console.log('❌ ALL TESTS FAILED');
    console.log('=================================');
    console.log(`Failed: ${failedTests.length}/${results.length}`);
    failedTests.forEach(test => {
      console.log(`  - "${test.message}": ${test.error}`);
    });
    return;
  }

  const times = successfulTests.map(r => r.elapsed);
  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const maxTime = Math.max(...times);
  const minTime = Math.min(...times);
  const medianTime = times.sort((a, b) => a - b)[Math.floor(times.length / 2)];

  const totalTokens = successfulTests.reduce((sum, r) => sum + r.tokens, 0);
  const avgTokens = totalTokens / successfulTests.length;

  const under2500ms = successfulTests.filter(r => r.elapsed <= 2500).length;
  const under1500ms = successfulTests.filter(r => r.elapsed <= 1500).length;
  const over3000ms = successfulTests.filter(r => r.elapsed > 3000).length;

  console.log('=================================');
  console.log('Performance Summary');
  console.log('=================================');
  console.log(`Total tests: ${results.length}`);
  console.log(`Successful: ${successfulTests.length}`);
  console.log(`Failed: ${failedTests.length}`);
  console.log('');
  console.log('Response Times:');
  console.log(`  Average: ${Math.round(avgTime)}ms`);
  console.log(`  Median: ${Math.round(medianTime)}ms`);
  console.log(`  Min: ${minTime}ms`);
  console.log(`  Max: ${maxTime}ms`);
  console.log('');
  console.log('Performance Distribution:');
  console.log(`  < 1500ms (excellent): ${under1500ms} (${Math.round(under1500ms/successfulTests.length*100)}%)`);
  console.log(`  < 2500ms (target): ${under2500ms} (${Math.round(under2500ms/successfulTests.length*100)}%)`);
  console.log(`  > 3000ms (slow): ${over3000ms} (${Math.round(over3000ms/successfulTests.length*100)}%)`);
  console.log('');
  console.log('Token Usage:');
  console.log(`  Total: ${totalTokens}`);
  console.log(`  Average: ${Math.round(avgTokens)} per response`);
  console.log('');
  console.log('Target Metrics:');
  console.log(`  Target range: 1500-2500ms`);
  console.log(`  Average within target: ${avgTime >= 1500 && avgTime <= 2500 ? '✓ YES' : '✗ NO'}`);
  console.log(`  Status: ${avgTime <= 2500 ? '✓ PASS' : '✗ FAIL'}`);
  console.log('=================================');

  if (failedTests.length > 0) {
    console.log('\nFailed Tests:');
    failedTests.forEach(test => {
      console.log(`  ✗ "${test.message}": ${test.error}`);
    });
  }
}

// Run tests
runTests().catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});
