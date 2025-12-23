# Changelog

All notable changes to the PhoneEase Middleware will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Version Numbering

Using 0.x.x format for pre-release development phase.
Version 1.0.0 will represent first public production release.

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
