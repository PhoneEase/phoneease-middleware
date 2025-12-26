# Changelog

All notable changes to the PhoneEase Middleware will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Version Numbering

Using 0.x.x format for pre-release development phase.
Version 1.0.0 will represent first public production release.

## [0.9.6] - 2025-12-25

### Improved - Enhanced Area Code Matching Logging

**Problem:**
Difficult to debug area code matching issues when provisioned phone numbers don't match business phone area code. No visibility into:
- What area code was extracted from business_phone
- What parameters were sent to Twilio API
- How many numbers were available in requested area code
- Which specific number was selected and why
- When/why fallback to nationwide search was triggered

**Solution:**
Added comprehensive logging throughout area code extraction and phone provisioning process.

**Enhanced Functions:**

1. **extractAreaCode() - Detailed Input/Output Logging:**
   - Logs input phone number and format
   - Shows digit extraction process
   - Identifies format (10-digit vs 11-digit with country code)
   - Displays formatted breakdown: (XXX) XXX-XXXX
   - Clear success/failure indicators

2. **provisionPhoneNumber() - Complete Provisioning Flow:**
   - Logs target area code and source (extracted vs default)
   - Shows Twilio API search parameters
   - Lists all available numbers found (up to 5)
   - Shows locality and region for each option
   - Indicates when fallback is triggered and why
   - Compares selected number's area code to requested
   - Warns about area code mismatches with explanation

3. **Registration Endpoint - Request Processing:**
   - Logs business_phone input value
   - Shows area code extraction result
   - Indicates when default area code (786) is used
   - Clear boundaries for area code processing section

**Example Console Output:**

```
=== AREA CODE PROCESSING ===
Business phone provided: (305) 693-3949
=== AREA CODE EXTRACTION START ===
Twilio: Input phone number: "(305) 693-3949"
Twilio: Digits after removing non-numeric: "3056933949"
Twilio: Total digits: 10
Twilio: Format detected: 10 digits (no country code)
Twilio: ✓ Extracted area code: 305
Twilio: Full number breakdown: (305) 693-3949
=== AREA CODE EXTRACTION SUCCESS ===
✓ Area code extracted successfully: 305
Will search Twilio for numbers in 305 area code
=== AREA CODE PROCESSING COMPLETE ===

=== TWILIO PHONE PROVISIONING START ===
Twilio: Target area code: 305 (extracted from business phone)
Twilio: API Search Parameters: { country: 'US', type: 'local', areaCode: '305', limit: 5 }
Twilio: Found 12 available numbers in area code 305
  Option 1: +13055551234 (Miami, FL)
  Option 2: +13055552345 (Miami, FL)
  Option 3: +13055553456 (Homestead, FL)
Twilio: ✓ SELECTED: +13055551234 (Miami, FL)
Twilio: ✓ Area code match: 305 matches requested 305
```

**Fallback Example:**

```
Twilio: Found 0 available numbers in area code 786
Twilio: ⚠️  FALLBACK TRIGGERED - No numbers available in area code 786
Twilio: Reason: Twilio inventory for 786 is empty or area code doesn't exist
Twilio: Searching nationwide without area code filter...
Twilio: Found 43 available numbers nationwide
  Option 1: +13055559876 (Miami, FL)
  Option 2: +17863334567 (Miami, FL)
  Option 3: +19547778888 (Fort Lauderdale, FL)
Twilio: ✓ SELECTED: +13055559876 (Miami, FL)
Twilio: ⚠️  Area code mismatch: Requested 786, got 305
Twilio: This is expected when preferred area code has no available numbers
```

**Benefits:**
- Easy debugging of area code matching issues
- Visibility into Twilio inventory availability
- Clear understanding of why specific numbers were selected
- Immediate identification of fallback scenarios
- Helps with troubleshooting customer complaints about area code mismatches

**Testing:**
- Business phone (786) 333-7300 → Logs show 786 extraction and Twilio search
- Business phone (305) 555-1234 → Logs show 305 extraction and match
- Business phone (212) 555-9999 → Logs show 212 extraction and fallback (if needed)
- No business phone → Logs show default 786 usage

**Files Modified:**
- `services/twilio.js` - Enhanced extractAreaCode() and provisionPhoneNumber()
- `routes/register.js` - Added area code processing logging

## [0.9.5] - 2025-12-25

### Fixed - CRITICAL: Phone Provisioning Authentication
- **Cloud Run Missing Twilio Credentials**: Added missing TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN environment variables to Cloud Run
- **Root Cause**: Cloud Run service only had Google Cloud variables, missing Twilio credentials entirely
- **Impact**: All phone provisioning attempts were failing with "RestException [Error]: Authenticate" (code 20003, status 401)
- **Resolution**: Updated Cloud Run service with complete environment variables:
  - TWILIO_ACCOUNT_SID
  - TWILIO_AUTH_TOKEN
  - MIDDLEWARE_URL (for webhook configuration)
  - NODE_ENV=production
- **Verification**: Tested registration endpoint successfully provisioned +17866996413 (786 area code)

### Technical Details
- Deployment: Cloud Run revision phoneease-middleware-00025-77q
- Both service URLs remain active and functional:
  - https://phoneease-middleware-pr6tyivo4a-uc.a.run.app (legacy)
  - https://phoneease-middleware-375589245036.us-central1.run.app (current)
- Test customer created: site_token f95f89bc-e180-41b0-92f8-f32b398e7ebc
- Twilio sub-account: AC[REDACTED] (test account)

## [0.9.4] - 2025-12-24

### Changed - Call Tracking Schema Improvement
- **Replaced ambiguous `calls_used` with clear billable vs filtered tracking**
- Added `billable_calls_used` - Counts toward customer's limit
- Added `filtered_calls` - Spam/bots/silent calls (FREE - don't count)
- Added `total_calls` - All calls for analytics
- Added `spam_calls` - Spam/robocalls (subset of filtered)
- Added `silent_calls` - Silent/abandoned calls (subset of filtered)
- Added `test_calls` - Owner testing (FREE)

### Fixed
- **Billing Fairness**: Customers no longer charged for spam/bot calls
- **Schema Clarity**: Clear distinction between billable and free calls
- **Webhook Ready**: Proper tracking foundation for webhook implementation

### Migration
- New customers automatically get new schema fields
- Existing customers: Fields will be added on next update (Firestore schema-less)
- No breaking changes - backward compatible

## [0.9.2] - 2025-12-23

### Added
- **Customer Registration Endpoint**: POST /api/v1/customers/register
  - Creates Twilio sub-accounts for customers
  - Provisions phone numbers with area code matching
  - Stores complete customer data in Firestore
  - Returns site_token and phone_number for configuration
  - Generates unique site tokens using UUID v4

### Added - Twilio Service Module
- Created services/twilio.js for Twilio API integration
  - `createSubAccount(businessName)` - Creates Twilio sub-accounts
  - `provisionPhoneNumber(subAccountSid, areaCode)` - Provisions phone numbers with area code matching
  - `deleteSubAccount(subAccountSid)` - Rollback operation for failed registrations
  - `extractAreaCode(phoneNumber)` - Parses area codes from various phone number formats
  - Configures webhook URLs for voice and SMS automatically
  - Default area code: 786 (Miami) when no preference provided
  - Fallback to nationwide search if preferred area code unavailable

### Changed - Customer Schema
- Extended Firestore customer schema with phone-related fields:
  - `phone_number` - Provisioned phone number in E.164 format
  - `twilio_subaccount_sid` - Sub-account SID for customer
  - `twilio_subaccount_token` - Sub-account auth token
  - `calls_limit` - Maximum calls per billing period (default: 100)
  - `calls_used` - Current call usage counter (default: 0)
  - `billing_period_start` - Start of 30-day billing cycle
  - `billing_period_end` - End of 30-day billing cycle
  - `status` - Account status (active/suspended/cancelled)
  - `site_url` - Customer's website URL
  - `business_phone` - Customer's business phone (used for area code matching)
- Added `createCustomer(siteToken, customerData)` function to firestore service
- Maintained backward compatibility with existing auto-registration via registerCustomer()

### Fixed
- Comprehensive error handling for Twilio API failures
  - Returns 503 Service Unavailable when Twilio API fails
  - Returns 400 Bad Request for validation errors
  - Returns 500 Internal Server Error for database failures
- Rollback logic for partial registration failures
  - Automatically deletes sub-account if phone provisioning fails
  - Automatically deletes sub-account if Firestore storage fails
  - Best-effort cleanup on unexpected errors
- Area code extraction supports multiple phone formats:
  - E.164: +17863337300
  - Formatted: (786) 333-7300
  - Dashed: 786-333-7300
  - Plain: 7863337300

### Technical
- Webhook URLs automatically configured on provisioned numbers:
  - Voice: `{MIDDLEWARE_URL}/api/v1/webhooks/twilio/voice`
  - SMS: `{MIDDLEWARE_URL}/api/v1/webhooks/twilio/sms`
- Billing period set to 30 days from registration
- Customer status defaults to 'active'
- All timestamps stored in ISO 8601 format
- Sub-account friendly names set to business name for easy identification

## [0.9.1] - 2025-12-23

### Added
- Twilio SDK dependency (twilio) for Phase 2 phone infrastructure
- UUID package (uuid) for secure token generation
- Preparing for customer registration endpoint implementation

### Changed
- Updated npm dependencies to support sub-account creation and phone provisioning
- Ready for Phase 2 phone number management features

## [0.9.0] - 2025-12-23

### Changed
- Aligned version number with pre-release status (was incorrectly set to 1.0.0)
- Version now matches WordPress plugin pre-release versioning scheme
- No functional changes - version number correction only

### Security
- Updated Cloud Run environment variables with rotated credentials
- Added TWILIO_AUTH_TOKEN, VERTEX_AI_API_KEY, TWILIO_ACCOUNT_SID to Cloud Run service

### Documentation
- Added comprehensive environment variables management section to deployment-guide.md
- Created .env.example template for local development setup
- Updated README.md with local development setup instructions
- Added credential rotation best practices

## [Unreleased - Previous Development]

### Added
- Initial middleware implementation with Twilio and Vertex AI integration
- Express.js server with /health, /api/v1/train, and /api/v1/chat endpoints
- Firestore integration for customer and usage tracking
- Vertex AI (Gemini) integration for AI conversation handling
- Cloud Run deployment scripts and configuration
- Comprehensive deployment guide
