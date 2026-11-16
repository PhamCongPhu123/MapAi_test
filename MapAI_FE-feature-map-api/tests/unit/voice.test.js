import test from 'node:test';
import assert from 'node:assert/strict';
import { createVoiceAssistant } from '../../src/voice/application/createVoiceAssistant.js';
import { speechText } from '../../src/voice/application/speechText.js';
import { createWebCapture, createNativeCapture, createNativeSpeaker } from '../../src/voice/infrastructure/speechAdapters.js';
import { createMapService } from '../../src/map/application/createMapService.js';
import fs from 'node:fs';
function fixture() {
  let events, saves = {}, spoken = [], cancelled = 0, next = 0;
  const jobs = new Map();
  const assistant = createVoiceAssistant({ capture: { async start(callbacks) { events = callbacks; return { cancel() { cancelled++; } }; } },
    speaker: { cancel() {}, async speak(text, options) { spoken.push({ text, ...options }); } },
    preferences: { read: () => ({}), write: value => { saves = value; } },
    timers: { set(fn, ms) { jobs.set(++next, { fn, ms }); return next; }, clear: id => jobs.delete(id) } });
  return { assistant, spoken, get events() { return events; }, get saves() { return saves; }, get cancelled() { return cancelled; },
    tick(ms) { for (const [id, job] of [...jobs]) if (job.ms === ms) { jobs.delete(id); job.fn(); } } };
}
test('speech sanitizer keeps 3 short sentences, removes URLs, markdown and coordinates in both languages', () => {
  const vi = speechText('**OSM** cách 1.5 km 📍 (16.061100, 108.226600). Giá 25k. [Chi tiết](https://example.test). Câu thứ tư.');
  assert.match(vi, /bản đồ mở.*1 phẩy 5 ki lô mét/); assert.match(vi, /25 nghìn đồng/);
  assert.doesNotMatch(vi, /https|\*|108\.2266|Câu thứ tư|📍/);
  assert.match(speechText('OSM is 1.5 km away.', 'en-US'), /OpenStreetMap is 1 point 5 kilometers away/);
  assert.ok(speechText('long '.repeat(500)).length < 530);
});
test('recognition sends a single finalized transcript with its selected language and suppresses late events', async () => {
  const f = fixture(), sent = [];
  f.assistant.setLanguage('en-US');
  await f.assistant.start((text, language) => sent.push({ text, language }));
  f.events.onText('Find bus stops'); assert.equal(sent.length, 0);
  f.events.onText('Find bus stops near Viet Han', { final: true, confidence: .94 });
  f.events.onText('Duplicate final', { final: true, confidence: 1 }); f.events.onEnd();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(sent, [{ text: 'Find bus stops near Viet Han', language: 'en-US' }]);
  assert.ok(f.cancelled); assert.equal(f.saves.language, 'en-US');
});
test('noise, low confidence, cancellation and language switches never send stale speech', async () => {
  const f = fixture(), sent = [];
  await f.assistant.start(text => sent.push(text));
  f.events.onText('unclear', { final: true, confidence: .2 });
  await Promise.resolve(); assert.equal(sent.length, 0); assert.match(f.assistant.getSnapshot().notice, /Chưa nghe rõ/);
  await f.assistant.start(text => sent.push(text));
  f.events.onText('draft'); f.assistant.setLanguage('en-US'); f.tick(2000);
  f.events.onText('late', { final: true }); await Promise.resolve(); assert.equal(sent.length, 0);
  await f.assistant.start(text => sent.push(text)); f.tick(5000);
  assert.match(f.assistant.getSnapshot().notice, /could not hear/);
});
test('muting persists, sanitizes replay, and skips a late response in the old language', async () => {
  const f = fixture(); f.assistant.toggleSpeaker();
  await f.assistant.speak('No sound'); assert.equal(f.spoken.length, 0); assert.equal(f.saves.autoSpeak, false);
  f.assistant.setLanguage('en-US'); await f.assistant.speak('Câu cũ', { language: 'vi-VN' }); assert.equal(f.spoken.length, 0);
  await f.assistant.speak('**Here** is [the map](https://test.example).', { language: 'en-US', manual: true });
  assert.equal(f.spoken.length, 1); assert.equal(f.spoken[0].language, 'en-US'); assert.doesNotMatch(f.spoken[0].text, /https|\*/);
});
test('offline web recognition starts only with a verified installed local model', async () => {
  let starts = 0;
  class Recognition { processLocally = false; static available = async () => 'downloadable'; start() { starts++; } }
  const capture = createWebCapture({ SpeechRecognition: Recognition, isSecureContext: true });
  await assert.rejects(capture.start({ language: 'vi-VN', offline: true }), error => error.code === 'offline');
  assert.equal(starts, 0);
  Recognition.available = async () => 'available';
  await capture.start({ language: 'vi-VN', offline: true }); assert.equal(starts, 1);
});
test('native offline/denied microphone and a cancelled permission prompt never start native recording', async () => {
  let starts = 0, active = true;
  const plugin = { available: async () => ({ available: true }), checkPermissions: async () => ({ speechRecognition: 'prompt' }), requestPermissions: async () => { active = false; return { speechRecognition: 'granted' }; }, start: async () => { starts++; } };
  const adapter = createNativeCapture(plugin);
  await assert.rejects(adapter.start({ language: 'en-US', offline: true }), error => error.code === 'offline');
  await assert.rejects(adapter.start({ language: 'en-US', isCurrent: () => active }), error => error.code === 'aborted');
  assert.equal(starts, 0);
});
test('native TTS selects the right installed offline voice and refuses a network-only voice', async () => {
  const spoken = [];
  const adapter = createNativeSpeaker({ getSupportedVoices: async () => ({ voices: [{ lang: 'vi-VN', localService: false }, { lang: 'en-US', localService: true }] }), speak: async options => spoken.push(options) });
  await adapter.speak('Hello', { language: 'en-US', offline: true }); assert.equal(spoken[0].lang, 'en-US'); assert.equal(spoken[0].voice, 1);
  await assert.rejects(adapter.speak('Chào', { language: 'vi-VN', offline: true }), error => error.code === 'voiceMissing');
});
test('English voice text uses the same cached OSM search and directions offline with no backend', async () => {
  const places = JSON.parse(fs.readFileSync(new URL('../../public/offline/osm-pois.json', import.meta.url))).places;
  const service = createMapService({ remote: { ask() { throw new Error('Offline must not call the backend'); } }, local: {}, getMode: () => 'offline', getLocalData: () => ({ places }) });
  const result = await service.ask('Directions to bus stops Viet Han', [], null, {}, { language: 'en-US' });
  assert.ok(result.places.length); assert.equal(result.action.type, 'LOCAL_DIRECTIONS'); assert.match(result.message, /^Found/);
  assert.ok(result.places.every(p => p.canonicalId.startsWith('osm:')));
  const natural = await service.ask('Directions to the Viet Han bus stop', [], null, {}, { language: 'en-US' });
  assert.ok(natural.places.length); assert.equal(natural.action.type, 'LOCAL_DIRECTIONS');
});
test('native offline speech is forced to the on-device engine and receives final/error events', async () => {
  const events = {}, starts = [], received = [], errors = []; let cancelled = 0;
  const plugin = { available: async () => ({ available: true, onDeviceAvailable: true }), checkPermissions: async () => ({ speechRecognition: 'granted' }),
    addListener: async (name, fn) => { events[name] = fn; return { remove: async () => { delete events[name]; } }; },
    start: async options => starts.push(options), stop: async () => { cancelled++; } };
  const capture = createNativeCapture(plugin);
  const handle = await capture.start({ language: 'vi-VN', offline: true, onText: (...args) => received.push(args), onError: code => errors.push(code), onEnd() {} });
  assert.equal(starts[0].onDeviceOnly, true); assert.equal(starts[0].language, 'vi-VN');
  events.partialResults({ matches: ['Tìm bến xe'], isFinal: true, confidence: .9 });
  assert.equal(received[0][1].final, true); assert.equal(received[0][1].confidence, .9);
  events.recognitionError({ code: 'unsupported' }); assert.deepEqual(errors, ['offline']);
  handle.cancel(); await Promise.resolve(); assert.equal(cancelled, 1);
});
