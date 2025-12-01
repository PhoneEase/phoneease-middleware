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

    const customerData = {
      site_token: siteToken,
      business_name: businessName,
      business_hours: additionalInfo.business_hours || null,
      business_description: additionalInfo.business_description || null,
      training_used: 0,
      training_limit: 100, // Default training limit
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
  incrementTrainingUsage,
  hasExceededTrainingLimit,
};
