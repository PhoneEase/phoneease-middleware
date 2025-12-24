/**
 * Firestore Service
 *
 * Handles customer data operations:
 * - Retrieve customer by site_token
 * - Auto-register new customers
 * - Track training usage
 */

const { Firestore } = require('@google-cloud/firestore');

// Initialize Firestore
const firestore = new Firestore({
  projectId: process.env.GOOGLE_CLOUD_PROJECT,
});

const CUSTOMERS_COLLECTION = 'customers';

/**
 * Get customer by site_token
 *
 * @param {string} siteToken - The site token to lookup
 * @returns {Promise<Object|null>} Customer document or null if not found
 */
async function getCustomer(siteToken) {
  try {
    console.log(`Firestore: Looking up customer with site_token: ${siteToken}`);

    const snapshot = await firestore
      .collection(CUSTOMERS_COLLECTION)
      .where('site_token', '==', siteToken)
      .limit(1)
      .get();

    if (snapshot.empty) {
      console.log('Firestore: Customer not found');
      return null;
    }

    const doc = snapshot.docs[0];
    const data = { id: doc.id, ...doc.data() };

    console.log(`Firestore: Customer found - ${data.business_name}`);
    return data;
  } catch (error) {
    console.error('Firestore: Error getting customer:', error);
    throw error;
  }
}

/**
 * Register a new customer
 *
 * @param {string} siteToken - The site token
 * @param {string} businessName - Business name
 * @param {Object} additionalInfo - Additional business info (optional)
 * @returns {Promise<Object>} Created customer document
 */
async function registerCustomer(siteToken, businessName, additionalInfo = {}) {
  try {
    console.log(`Firestore: Registering new customer: ${businessName}`);

    /**
     * Call Tracking Schema:
     *
     * BILLABLE CALLS (count toward limit):
     * - billable_calls_used: Real customer calls that consume quota
     * - Limited by: calls_limit (default: 100 per billing period)
     *
     * FILTERED CALLS (FREE - don't count):
     * - spam_calls: Robocalls, telemarketers identified by AI
     * - silent_calls: Calls with no speech detected
     * - test_calls: Owner testing their phone system
     * - Total filtered: filtered_calls = spam_calls + silent_calls + test_calls
     *
     * ANALYTICS:
     * - total_calls: billable_calls_used + filtered_calls
     *
     * This ensures customers only pay for legitimate calls.
     */
    const customerData = {
      site_token: siteToken,
      business_name: businessName,
      business_hours: additionalInfo.business_hours || null,
      business_description: additionalInfo.business_description || null,

      // Call tracking - Billable vs Filtered
      calls_limit: 100,                // Maximum billable calls per billing period
      billable_calls_used: 0,          // Calls that count toward limit
      filtered_calls: 0,               // Spam/bots/silent calls (FREE)
      total_calls: 0,                  // All calls for analytics
      spam_calls: 0,                   // Spam/robocalls (subset of filtered)
      silent_calls: 0,                 // Silent/abandoned calls (subset of filtered)
      test_calls: 0,                   // Owner test calls (FREE)

      // Training tracking
      training_used: 0,
      training_limit: 100,             // Default training limit

      // Timestamps
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const docRef = await firestore
      .collection(CUSTOMERS_COLLECTION)
      .add(customerData);

    console.log(`Firestore: Customer registered with ID: ${docRef.id}`);

    return {
      id: docRef.id,
      ...customerData,
    };
  } catch (error) {
    console.error('Firestore: Error registering customer:', error);
    throw error;
  }
}

/**
 * Increment training usage counter
 *
 * @param {string} customerId - Firestore document ID
 * @returns {Promise<void>}
 */
async function incrementTrainingUsage(customerId) {
  try {
    console.log(`Firestore: Incrementing training usage for customer: ${customerId}`);

    await firestore
      .collection(CUSTOMERS_COLLECTION)
      .doc(customerId)
      .update({
        training_used: Firestore.FieldValue.increment(1),
        updated_at: new Date().toISOString(),
      });

    console.log('Firestore: Training usage incremented');
  } catch (error) {
    console.error('Firestore: Error incrementing training usage:', error);
    throw error;
  }
}

/**
 * Create a customer with full registration data
 *
 * @param {string} siteToken - Unique customer identifier
 * @param {object} customerData - Complete customer data object
 * @returns {Promise<void>}
 */
async function createCustomer(siteToken, customerData) {
  try {
    console.log(`Firestore: Creating customer with site_token: ${siteToken}`);

    const customerRef = firestore.collection(CUSTOMERS_COLLECTION).doc(siteToken);
    await customerRef.set(customerData);

    console.log(`Firestore: Customer created successfully - ${customerData.business_name}`);
  } catch (error) {
    console.error('Firestore: Error creating customer:', error);
    throw error;
  }
}

/**
 * Check if customer has exceeded training limit
 *
 * @param {Object} customer - Customer document
 * @returns {boolean} True if limit exceeded
 */
function hasExceededTrainingLimit(customer) {
  return customer.training_used >= customer.training_limit;
}

module.exports = {
  getCustomer,
  registerCustomer,
  createCustomer,
  incrementTrainingUsage,
  hasExceededTrainingLimit,
};
