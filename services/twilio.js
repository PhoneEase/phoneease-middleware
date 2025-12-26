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
 * @param {string} siteUrl - Customer's WordPress site URL for webhooks
 * @param {string} areaCode - Preferred area code (e.g., "786", "305")
 * @returns {Promise<{phoneNumber: string, numberSid: string}>}
 */
async function provisionPhoneNumber(subAccountSid, siteUrl, areaCode = null) {
  try {
    // Validate siteUrl parameter
    if (!siteUrl || typeof siteUrl !== 'string' || !siteUrl.startsWith('http')) {
      throw new Error('siteUrl is required and must be a valid URL (https://yourdomain.com)');
    }

    // Use default area code if none provided
    const targetAreaCode = areaCode || DEFAULT_AREA_CODE;
    const usingDefault = !areaCode;

    console.log('=== TWILIO PHONE PROVISIONING START ===');
    console.log(`Twilio: Target area code: ${targetAreaCode} ${usingDefault ? '(default - no business phone provided)' : '(extracted from business phone)'}`);
    console.log(`Twilio: Sub-account SID: ${subAccountSid}`);
    console.log(`Twilio: Site URL: ${siteUrl}`);

    // Search for available phone numbers using master account
    console.log(`Twilio: API Search Parameters: { country: 'US', type: 'local', areaCode: '${targetAreaCode}', limit: 5 }`);
    let availableNumbers = await client.availablePhoneNumbers('US')
      .local
      .list({ areaCode: targetAreaCode, limit: 5 });

    console.log(`Twilio: Found ${availableNumbers.length} available numbers in area code ${targetAreaCode}`);

    if (availableNumbers.length > 0) {
      // Log all available numbers for debugging
      availableNumbers.forEach((num, index) => {
        console.log(`  Option ${index + 1}: ${num.phoneNumber} (${num.locality || 'Unknown'}, ${num.region || 'Unknown'})`);
      });
    }

    // Fallback: If no numbers in preferred area code, try without area code filter
    if (availableNumbers.length === 0) {
      console.log(`Twilio: ⚠️  FALLBACK TRIGGERED - No numbers available in area code ${targetAreaCode}`);
      console.log(`Twilio: Reason: Twilio inventory for ${targetAreaCode} is empty or area code doesn't exist`);
      console.log(`Twilio: Searching nationwide without area code filter...`);
      console.log(`Twilio: API Search Parameters: { country: 'US', type: 'local', limit: 5 }`);

      availableNumbers = await client.availablePhoneNumbers('US')
        .local
        .list({ limit: 5 });

      console.log(`Twilio: Found ${availableNumbers.length} available numbers nationwide`);

      if (availableNumbers.length > 0) {
        availableNumbers.forEach((num, index) => {
          console.log(`  Option ${index + 1}: ${num.phoneNumber} (${num.locality || 'Unknown'}, ${num.region || 'Unknown'})`);
        });
      }
    }

    if (availableNumbers.length === 0) {
      console.error('Twilio: ❌ CRITICAL - No phone numbers available in Twilio inventory');
      throw new Error('No phone numbers available for provisioning');
    }

    // Select the first available number
    const selectedNumber = availableNumbers[0].phoneNumber;
    const selectedLocality = availableNumbers[0].locality || 'Unknown';
    const selectedRegion = availableNumbers[0].region || 'Unknown';

    console.log(`Twilio: ✓ SELECTED: ${selectedNumber} (${selectedLocality}, ${selectedRegion})`);

    // Extract area code from selected number to compare
    const selectedAreaCode = selectedNumber.substring(2, 5); // +1XXXYYYZZZZ -> XXX
    if (selectedAreaCode !== targetAreaCode) {
      console.log(`Twilio: ⚠️  Area code mismatch: Requested ${targetAreaCode}, got ${selectedAreaCode}`);
      console.log(`Twilio: This is expected when preferred area code has no available numbers`);
    } else {
      console.log(`Twilio: ✓ Area code match: ${selectedAreaCode} matches requested ${targetAreaCode}`);
    }

    // Configure webhook URLs to customer's WordPress site
    // Remove trailing slash from siteUrl if present
    const cleanSiteUrl = siteUrl.endsWith('/') ? siteUrl.slice(0, -1) : siteUrl;
    const voiceUrl = `${cleanSiteUrl}/wp-json/phoneease/v1/webhook/voice`;
    const statusCallbackUrl = `${cleanSiteUrl}/wp-json/phoneease/v1/webhook/call-status`;

    // Purchase number for sub-account using master account client
    // Use client.api.accounts(subAccountSid) to scope the purchase to the sub-account
    const purchasedNumber = await client.api.accounts(subAccountSid)
      .incomingPhoneNumbers
      .create({
        phoneNumber: selectedNumber,
        voiceUrl: voiceUrl,
        voiceMethod: 'POST',
        statusCallback: statusCallbackUrl,
        statusCallbackMethod: 'POST',
        friendlyName: `PhoneEase - ${subAccountSid}`
      });

    console.log(`Twilio: Phone number provisioned - SID: ${purchasedNumber.sid}`);
    console.log(`Twilio: Voice webhook: ${voiceUrl}`);
    console.log(`Twilio: Status callback: ${statusCallbackUrl}`);

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
  console.log('=== AREA CODE EXTRACTION START ===');
  console.log(`Twilio: Input phone number: "${phoneNumber}"`);
  console.log(`Twilio: Input type: ${typeof phoneNumber}`);

  if (!phoneNumber) {
    console.log('Twilio: ⚠️  No phone number provided, returning null');
    return null;
  }

  // Remove all non-digit characters
  const digits = phoneNumber.replace(/\D/g, '');
  console.log(`Twilio: Digits after removing non-numeric: "${digits}"`);
  console.log(`Twilio: Total digits: ${digits.length}`);

  // Check if we have at least 10 digits (US phone number)
  if (digits.length >= 10) {
    // Extract first 3 digits after country code (if present)
    // If 11 digits starting with 1: +1 (786) 333-7300 -> extract 786
    // If 10 digits: (786) 333-7300 -> extract 786
    const hasCountryCode = digits.length === 11 && digits[0] === '1';
    const areaCode = hasCountryCode
      ? digits.substring(1, 4)  // Skip country code 1
      : digits.substring(0, 3); // No country code

    console.log(`Twilio: Format detected: ${hasCountryCode ? '11 digits with country code (+1)' : '10 digits (no country code)'}`);
    console.log(`Twilio: ✓ Extracted area code: ${areaCode}`);
    console.log(`Twilio: Full number breakdown: ${hasCountryCode ? '+1' : ''}(${areaCode}) ${digits.substring(hasCountryCode ? 4 : 3, hasCountryCode ? 7 : 6)}-${digits.substring(hasCountryCode ? 7 : 6, hasCountryCode ? 11 : 10)}`);
    console.log('=== AREA CODE EXTRACTION SUCCESS ===');

    return areaCode;
  }

  console.log(`Twilio: ❌ Invalid phone number - need at least 10 digits, got ${digits.length}`);
  console.log(`Twilio: Could not extract area code from ${phoneNumber}`);
  console.log('=== AREA CODE EXTRACTION FAILED ===');
  return null;
}

module.exports = {
  createSubAccount,
  provisionPhoneNumber,
  deleteSubAccount,
  extractAreaCode
};
