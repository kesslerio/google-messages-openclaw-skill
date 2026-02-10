/**
 * SMS Security Filter — shared module for Node.js consumers.
 *
 * Blocks 2FA/OTP codes, password resets, and security alerts from being
 * forwarded to AI agent channels. Keep patterns in sync with
 * security/sensitive-sms-patterns.txt in shapescale-openclaw-skills.
 *
 * Browser-side (sms-observer.js) has its own copy of these patterns
 * because browser context can't require() Node modules.
 */

const SENSITIVE_PATTERNS = [
  /\b\d{6}\b.*(?:code|verify|confirm|otp|pin)/i,
  /(?:code|verify|confirm|otp|pin).*\b\d{6}\b/i,
  /^\s*\d{4,8}\s*$/,
  /(?:verification|security|auth|login|sign.?in)\s*code/i,
  /one.time.*(code|password|passcode|pin)/i,
  /your.*\bcode\b\s*(?:is|for|:)/i,
  /(?:2fa|two.factor|mfa|multi.factor)/i,
  /(?:reset|change|recover|forgot).*password/i,
  /password.*(reset|change|recover|expir)/i,
  /verify your/i,
  /confirm your.*(phone|number|identity|account|email)/i,
  /verification\s*(code|link|required)/i,
  /(?:new|unusual|suspicious|unrecognized).*(sign.?in|login|device|activity)/i,
  /security alert/i,
  /was this you/i,
];

function isShortCode(name) {
  if (!name) return false;
  const cleaned = String(name).trim().replace(/^\+/, '');
  return /^\d{4,6}$/.test(cleaned);
}

function isSensitiveMessage(text, contact) {
  if (isShortCode(contact)) return true;
  if (text) {
    for (const pat of SENSITIVE_PATTERNS) {
      if (pat.test(text)) return true;
    }
  }
  return false;
}

module.exports = { SENSITIVE_PATTERNS, isShortCode, isSensitiveMessage };
