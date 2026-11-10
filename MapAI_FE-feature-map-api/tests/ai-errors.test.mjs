import test from 'node:test';
import assert from 'node:assert/strict';
import { aiFailure } from '../src/services/aiErrors.js';

test('invalid Gemini key has a specific warning, safe suggestions, and no generated map action', () => {
  const result = aiFailure(503, { code: 'AI_KEY_INVALID' });
  assert.equal(result.error, true);
  assert.match(result.message, /Gemini không hợp lệ/);
  assert.equal(result.action, undefined);
  assert.ok(result.suggestions.includes('Phóng to bản đồ'));
});
test('legacy backend error is recognized without exposing its raw exception or key', () => {
  const result = aiFailure(500, { message: 'An error occurred', error: 'Gemini API error: API_KEY_INVALID key=fixture-secret-do-not-display' });
  assert.equal(result.errorCode, 'AI_KEY_INVALID');
  assert.doesNotMatch(JSON.stringify(result), /fixture-secret-do-not-display/);
});
test('transport, quota, timeout and invalid responses have distinct explanations', () => {
  for (const [status, code] of [[0, 'AI_BACKEND_UNREACHABLE'], [429, 'AI_RATE_LIMITED'], [504, 'AI_TIMEOUT'], [400, 'AI_INVALID_REQUEST']]) {
    assert.equal(aiFailure(status).errorCode, code);
  }
  assert.equal(aiFailure(502, { code: 'AI_INVALID_RESPONSE' }).errorCode, 'AI_INVALID_RESPONSE');
  assert.equal(aiFailure(500, null).errorCode, 'AI_UNAVAILABLE');
  assert.equal(aiFailure(500, { code: 'constructor' }).errorCode, 'AI_UNAVAILABLE');
});
