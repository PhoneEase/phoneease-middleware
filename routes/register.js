/**
 * Customer Registration Route
 *
 * POST /api/v1/customers/register
 *
 * Handles new customer registration:
 * - Generates unique site_token
 * - Creates Twilio sub-account
 * - Provisions phone number with area code matching
 * - Stores customer data in Firestore
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const twilioService = require('../services/twilio');
const firestoreService = require('../services/firestore');

/**
 * POST /api/v1/customers/register
 *
 * Request body:
 * {
 *   business_name: string (required)
 *   business_phone: string (optional) - Used for area code matching
 *   site_url: string (optional)
 * }
 *
 * Response:
 * {
 *   success: true,
 *   site_token: string,
 *   phone_number: string,
 *   twilio_subaccount_sid: string,
 *   message: string
 * }
 */
router.post('/register', async (req, res) => {
  let subAccountSid = null; // Track for rollback

  try {
    console.log('=== /api/v1/customers/register Request ===');
    console.log('Body:', JSON.stringify(req.body, null, 2));

    // 1. Validate request body
    const { business_name, business_phone, site_url } = req.body;

    if (!business_name || typeof business_name !== 'string' || business_name.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'business_name is required and must be a non-empty string'
      });
    }

    // 2. Generate unique site_token
    const siteToken = uuidv4();
    console.log(`Generated site_token: ${siteToken}`);

    // 3. Extract area code from business_phone if provided
    let areaCode = null;
    if (business_phone) {
      areaCode = twilioService.extractAreaCode(business_phone);
      if (areaCode) {
        console.log(`Using area code from business_phone: ${areaCode}`);
      }
    }

    // 4. Create Twilio sub-account
    console.log('Creating Twilio sub-account...');
    let subAccount;
    try {
      subAccount = await twilioService.createSubAccount(business_name);
      subAccountSid = subAccount.accountSid; // Save for potential rollback
    } catch (error) {
      console.error('Failed to create Twilio sub-account:', error);
      return res.status(503).json({
        success: false,
        error: 'Twilio service unavailable',
        details: 'Failed to create sub-account. Please try again later.'
      });
    }

    // 5. Provision phone number
    console.log('Provisioning phone number...');
    let phoneNumber, numberSid;
    try {
      const phoneData = await twilioService.provisionPhoneNumber(
        subAccount.accountSid,
        areaCode
      );
      phoneNumber = phoneData.phoneNumber;
      numberSid = phoneData.numberSid;
    } catch (error) {
      console.error('Failed to provision phone number:', error);

      // ROLLBACK: Delete sub-account since phone provisioning failed
      console.log('Rolling back: Deleting sub-account...');
      await twilioService.deleteSubAccount(subAccountSid);

      return res.status(503).json({
        success: false,
        error: 'Phone number provisioning failed',
        details: error.message.includes('No phone numbers available')
          ? `No phone numbers available${areaCode ? ` in area code ${areaCode}` : ''}`
          : 'Failed to provision phone number. Please try again later.'
      });
    }

    // 6. Store customer in Firestore with extended schema
    console.log('Storing customer in Firestore...');
    const now = new Date().toISOString();
    const billingPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const customerData = {
      site_token: siteToken,
      business_name: business_name.trim(),
      business_phone: business_phone || null,
      site_url: site_url || null,
      phone_number: phoneNumber,
      twilio_subaccount_sid: subAccount.accountSid,
      twilio_subaccount_token: subAccount.authToken,
      calls_limit: 100,
      calls_used: 0,
      training_limit: 100,
      training_used: 0,
      billing_period_start: now,
      billing_period_end: billingPeriodEnd,
      status: 'active',
      created_at: now,
      updated_at: now
    };

    try {
      await firestoreService.createCustomer(siteToken, customerData);
    } catch (error) {
      console.error('Failed to store customer in Firestore:', error);

      // ROLLBACK: Delete sub-account and potentially release phone number
      console.log('Rolling back: Deleting sub-account...');
      await twilioService.deleteSubAccount(subAccountSid);

      return res.status(500).json({
        success: false,
        error: 'Database error',
        details: 'Failed to store customer data. Please try again later.'
      });
    }

    // 7. Return success response
    console.log('=== /api/v1/customers/register Success ===');
    console.log(`Customer registered: ${business_name}`);
    console.log(`Site Token: ${siteToken}`);
    console.log(`Phone Number: ${phoneNumber}`);

    return res.status(201).json({
      success: true,
      site_token: siteToken,
      phone_number: phoneNumber,
      twilio_subaccount_sid: subAccount.accountSid,
      message: 'Customer registered successfully'
    });

  } catch (error) {
    console.error('=== /api/v1/customers/register Error ===');
    console.error('Error:', error);

    // Best-effort rollback if we created a sub-account
    if (subAccountSid) {
      console.log('Rolling back: Deleting sub-account...');
      await twilioService.deleteSubAccount(subAccountSid);
    }

    return res.status(500).json({
      success: false,
      error: 'Internal server error during registration',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
