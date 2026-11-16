import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
const failure = code => Object.assign(new Error(code), { code });
const errorCode = value => /not-allowed|permission|denied/i.test(value) ? 'permission' : /network|connection/i.test(value) ? 'network' : /language/i.test(value) ? 'unsupported' : 'noSpeech';
const sameLanguage = (a, b) => a?.toLowerCase().split(/[-_]/)[0] === b.toLowerCase().split('-')[0];

export function createWebCapture(scope = window) {
  return { async start({ language, offline, onText, onEnd, onError, isCurrent = () => true }) {
    const Recognition = scope.SpeechRecognition || scope.webkitSpeechRecognition;
    if (!Recognition) throw failure('unsupported');
    if (!scope.isSecureContext) throw failure('insecure');
    const recognition = new Recognition(); let cancelled = false;
    if (offline) {
      // Never invoke a cloud recognizer while claiming to work offline.
      if (!('processLocally' in recognition) || !Recognition.available) throw failure('offline');
      let availability;
      try { availability = await Recognition.available({ langs: [language], processLocally: true }); } catch { throw failure('offline'); }
      if (availability !== 'available') throw failure('offline');
      recognition.processLocally = true;
    }
    if (!isCurrent()) throw failure('aborted');
    recognition.lang = language; recognition.interimResults = true; recognition.continuous = false; recognition.maxAlternatives = 1;
    recognition.onresult = event => {
      if (cancelled) return;
      const results = Array.from(event.results), text = results.map(r => r[0].transcript).join(' ').trim();
      const final = results.length > 0 && results.every(r => r.isFinal);
      onText(text, { final, confidence: final ? results.at(-1)[0].confidence : undefined });
    };
    recognition.onerror = event => { if (!cancelled && event.error !== 'aborted') onError(errorCode(event.error)); };
    recognition.onend = () => { if (!cancelled) onEnd(); };
    try { recognition.start(); } catch { throw failure('unsupported'); }
    return { cancel() { cancelled = true; recognition.onresult = recognition.onend = recognition.onerror = null; recognition.abort(); } };
  } };
}
export function createNativeCapture(plugin = SpeechRecognition) {
  let stopping = Promise.resolve();
  return { async start({ language, offline, onText, onEnd, onError, isCurrent = () => true }) {
    await stopping;
    const available = await plugin.available();
    if (offline && !available.onDeviceAvailable) throw failure('offline');
    if (!available.available) throw failure('unsupported');
    if (!isCurrent()) throw failure('aborted');
    let permission = await plugin.checkPermissions();
    if (!isCurrent()) throw failure('aborted');
    if (permission.speechRecognition !== 'granted') permission = await plugin.requestPermissions();
    if (!isCurrent()) throw failure('aborted');
    if (permission.speechRecognition !== 'granted') throw failure('permission');
    let cancelled = false; const handles = [];
    const cancel = () => { if (cancelled) return; cancelled = true; handles.forEach(h => { void h.remove().catch(() => {}); }); stopping = plugin.stop().catch(() => {}); };
    try {
      handles.push(await plugin.addListener('partialResults', ({ matches, isFinal, confidence }) => { if (!cancelled && matches?.[0]) onText(matches[0], { final: Boolean(isFinal), confidence }); }));
      handles.push(await plugin.addListener('recognitionError', ({ code }) => { if (!cancelled) onError(offline && code === 'unsupported' ? 'offline' : code); }));
      handles.push(await plugin.addListener('listeningState', ({ status }) => { if (!cancelled && status === 'stopped') onEnd(); }));
      if (!isCurrent()) { cancel(); throw failure('aborted'); }
      await plugin.start({ language, partialResults: true, popup: false, maxResults: 1, onDeviceOnly: offline });
    } catch (error) { cancel(); onError(errorCode(error.message || '')); throw failure(errorCode(error.message || '')); }
    return { cancel };
  } };
}

export function createWebSpeaker(scope = window) {
  let pending, generation = 0;
  return {
    cancel() { generation++; pending?.(); pending = null; scope.speechSynthesis?.cancel(); },
    async speak(text, { language, offline }) {
      const current = generation, synth = scope.speechSynthesis;
      if (!synth || !scope.SpeechSynthesisUtterance) throw failure('voiceMissing');
      let voices = synth.getVoices();
      if (!voices.length) await new Promise(resolve => {
        const done = () => { clearTimeout(timer); synth.removeEventListener('voiceschanged', done); resolve(); };
        const timer = setTimeout(done, 1000); synth.addEventListener('voiceschanged', done, { once: true });
      });
      if (generation !== current) return;
      voices = synth.getVoices().filter(v => sameLanguage(v.lang, language) && (!offline || v.localService));
      const voice = voices.find(v => v.lang.toLowerCase() === language.toLowerCase()) || voices[0];
      if (!voice) throw failure('voiceMissing');
      const utterance = new scope.SpeechSynthesisUtterance(text);
      utterance.lang = language; utterance.voice = voice; utterance.rate = 1.05;
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => { synth.cancel(); reject(failure('playback')); }, 60000);
        pending = () => { clearTimeout(timer); resolve(); };
        utterance.onend = () => { clearTimeout(timer); pending = null; resolve(); };
        utterance.onerror = () => { clearTimeout(timer); pending = null; reject(failure('playback')); };
        synth.speak(utterance);
      });
    },
  };
}
export function createNativeSpeaker(plugin = TextToSpeech) {
  let generation = 0;
  return { cancel() { generation++; void plugin.stop().catch(() => {}); }, async speak(text, { language, offline }) {
    const current = generation;
    const { voices } = await plugin.getSupportedVoices();
    if (current !== generation) return;
    const supported = voices.map((v, i) => ({ ...v, index: i })).filter(v => sameLanguage(v.lang, language) && (!offline || v.localService));
    const selected = supported.find(v => v.lang.toLowerCase() === language.toLowerCase()) || supported[0];
    if (!selected) throw failure('voiceMissing');
    await plugin.speak({ text, lang: language, voice: selected.index, rate: 1.05, pitch: 1, volume: 1, queueStrategy: 0 });
  } };
}
export function platformSpeechPorts() {
  const native = Capacitor.isNativePlatform();
  return { capture: native ? createNativeCapture() : createWebCapture(), speaker: native ? createNativeSpeaker() : createWebSpeaker() };
}
