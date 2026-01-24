# Changelog

All notable changes to the Solana Paper Trader Extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-01-07

### Added
- Initial release of Solana Paper Trader Extension
- Support for Axiom trading platform
- Partial support for Terminal (Padre) platform
- Real-time SOL/USD price fetching from Coinbase and Kraken
- WebSocket, fetch, and XMLHttpRequest hooking for price interception
- Paper trading badge overlay
- Extension popup with platform quick-launch buttons
- Comprehensive README documentation
- Package.json with build scripts
- JSDoc comments for key functions

### Fixed
- Duplicate export declaration in axiom.js
- Hardcoded version number in popup (now reads from manifest)
- Inconsistent code formatting

### Removed
- Debug console.log statements from content script
- Unnecessary mint logging interval

### Changed
- Centralized configuration constants in popup.js
- Improved code documentation with JSDoc comments
- Enhanced header documentation in page-bridge.js

## [Unreleased]

### Planned
- Complete Padre Terminal adapter implementation
- Paper trading state management
- Trade history tracking
- Portfolio balance simulation
- Settings panel for initial balance configuration
- Export trade history feature
