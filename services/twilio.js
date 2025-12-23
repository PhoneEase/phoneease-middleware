/**
 * Twilio Service
 *
 * Handles Twilio API operations:
 * - Create sub-accounts for customers
 * - Provision phone numbers with area code matching
 * - Configure webhook URLs for voice and SMS
 */

const twilio = require('twilio');

// Initialize Twilio client with master account credentials
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

// Middleware URL for webhooks (configured in Cloud Run)
const middlewareUrl = process.env.MIDDLEWARE_URL || 'https://phoneease-middleware-pr6tyivo4a-uc.a.run.app';

// Default area code (Miami)
const DEFAULT_AREA_CODE = '786';

/**
 * Create a Twilio sub-account for a customer
 * @param {string} businessName - Customer's business name
 * @returns {Promise<{accountSid: string, authToken: string}>}
 */
async function createSubAccount(businessName) {
  try {
    console.log(`Twilio: Creating sub-account for: ${businessName}`);

    const subAccount = await client.api.accounts.create({
      friendlyName: businessName
    });

    console.log(`Twilio: Sub-account created - SID: ${subAccount.sid}`);

    return {
      accountSid: subAccount.sid,
      authToken: subAccount.authToken
    };
  } catch (error) {
    console.error('Twilio: Error creating sub-account:', error);
    throw new Error(`Failed to create Twilio sub-account: ${error.message}`);
  }
}

/**
 * Provision a phone number for a customer
 * @param {string} subAccountSid - Sub-account SID to assign number to
 * @param {string} areaCode - Preferred area code (e.g., "786", "305")
 * @returns {Promise<{phoneNumber: string, numberSid: string}>}
 */
async function provisionPhoneNumber(subAccountSid, areaCode = null) {
  try {
    // Use default area code if none provided
    const targetAreaCode = areaCode || DEFAULT_AREA_CODE;

    console.log(`Twilio: Searching for phone numbers in area code: ${targetAreaCode}`);

    // Create sub-account client
    const subClient = twilio(subAccountSid, authToken);

    // Search for available phone numbers
    let availableNumbers = await client.availablePhoneNumbers('US')
      .local
      .list({ areaCode: targetAreaCode, limit: 5 });

    // Fallback: If no numbers in preferred area code, try without area code filter
    if (availableNumbers.length === 0) {
      console.log(`Twilio: No numbers in area code ${targetAreaCode}, searching nationwide...`);
      availableNumbers = await client.availablePhoneNumbers('US')
        .local
        .list({ limit: 5 });
    }

    if (availableNumbers.length === 0) {
      throw new Error('No phone numbers available for provisioning');
    }

    // Select the first available number
    const selectedNumber = availableNumbers[0].phoneNumber;
    console.log(`Twilio: Selected phone number: ${selectedNumber}`);

    // Configure webhook URLs
    const voiceUrl = `${middlewareUrl}/api/v1/webhooks/twilio/voice`;
    const smsUrl = `${middlewareUrl}/api/v1/webhooks/twilio/sms`;

    // Purchase number using sub-account client
    const purchasedNumber = await subClient.incomingPhoneNumbers.create({
      phoneNumber: selectedNumber,
      voiceUrl: voiceUrl,
      voiceMethod: 'POST',
      smsUrl: smsUrl,
      smsMethod: 'POST',
      friendlyName: `PhoneEase - ${subAccountSid}`
    });

    console.log(`Twilio: Phone number provisioned - SID: ${purchasedNumber.sid}`);
    console.log(`Twilio: Voice webhook: ${voiceUrl}`);
    console.log(`Twilio: SMS webhook: ${smsUrl}`);

    return {
      phoneNumber: purchasedNumber.phoneNumber, // E.164 format
      numberSid: purchasedNumber.sid
    };
  } catch (error) {
    console.error('Twilio: Error provisioning phone number:', error);
    throw new Error(`Failed to provision phone number: ${error.message}`);
  }
}

/**
 * Delete a sub-account (rollback operation)
 * @param {string} subAccountSid - Sub-account SID to delete
 * @returns {Promise<void>}
 */
async function deleteSubAccount(subAccountSid) {
  try {
    console.log(`Twilio: Deleting sub-account: ${subAccountSid}`);
    await client.api.accounts(subAccountSid).update({ status: 'closed' });
    console.log(`Twilio: Sub-account closed successfully`);
  } catch (error) {
    console.error('Twilio: Error deleting sub-account:', error);
    // Don't throw - this is best-effort cleanup
  }
}

/**
 * Extract area code from phone number
 * @param {string} phoneNumber - Phone number (any format)
 * @returns {string|null} - Three-digit area code or null
 */
function extractAreaCode(phoneNumber) {
  if (!phoneNumber) {
    return null;
  }

  // Remove all non-digit characters
  const digits = phoneNumber.replace(/\D/g, '');

  // Check if we have at least 10 digits (US phone number)
  if (digits.length >= 10) {
    // Extract first 3 digits after country code (if present)
    // If 11 digits starting with 1: +1 (786) 333-7300 -> extract 786
    // If 10 digits: (786) 333-7300 -> extract 786
    const areaCode = digits.length === 11 && digits[0] === '1'
      ? digits.substring(1, 4)  // Skip country code 1
      : digits.substring(0, 3); // No country code

    console.log(`Twilio: Extracted area code ${areaCode} from ${phoneNumber}`);
    return areaCode;
  }

  console.log(`Twilio: Could not extract area code from ${phoneNumber}`);
  return null;
}

module.exports = {
  createSubAccount,
  provisionPhoneNumber,
  deleteSubAccount,
  extractAreaCode
};
