import { speechText, voiceLanguage, voiceMessages } from './speechText.js';

// All microphone, audio, storage and timer effects arrive through ports.
export function createVoiceAssistant({ capture, speaker, preferences, timers }) {
  const listeners = new Set();
  let state = { phase: 'idle', transcript: '', notice: '', noticeCode: null, language: voiceLanguage(preferences.read()?.language), autoSpeak: preferences.read()?.autoSpeak !== false };
  let epoch = 0, audioEpoch = 0, session, quietTimer, emptyTimer, hardTimer, onSubmit, lastConfidence;
  const publish = patch => { state = { ...state, ...patch }; listeners.forEach(fn => fn()); };
  const clearTimers = () => { [quietTimer, emptyTimer, hardTimer].forEach(id => timers.clear(id)); };
  const persist = () => preferences.write({ language: state.language, autoSpeak: state.autoSpeak });
  function stopSpeaking() { audioEpoch++; speaker.cancel(); if (state.phase === 'speaking') publish({ phase: 'idle' }); }
  function cancel() { epoch++; clearTimers(); session?.cancel(); session = null; stopSpeaking(); publish({ phase: 'idle', transcript: '' }); }
  function fail(code) { cancel(); publish({ noticeCode: code, notice: voiceMessages[state.language][code] || voiceMessages[state.language].noSpeech }); }
  function finish() {
    if (!['listening', 'checking'].includes(state.phase)) return;
    const text = state.transcript.trim(), language = state.language;
    if (!text || (lastConfidence > 0 && lastConfidence < .65)) { fail('noSpeech'); return; }
    epoch++; clearTimers(); session?.cancel(); session = null;
    publish({ phase: 'processing', transcript: '', notice: '' });
    const active = epoch;
    const submit = onSubmit;
    Promise.resolve().then(() => { if (epoch === active) return submit?.(text.slice(0, 2000), language); }).catch(() => {
      if (epoch === active) publish({ notice: voiceMessages[language].network });
    }).finally(() => { if (epoch === active && state.phase === 'processing') publish({ phase: 'idle' }); });
  }
  async function start(submit, { offline = false } = {}) {
    cancel(); onSubmit = submit; lastConfidence = undefined;
    const active = epoch;
    publish({ phase: 'checking', transcript: '', notice: '', noticeCode: null });
    try {
      const handle = await capture.start({ isCurrent: () => active === epoch, language: state.language, offline,
        onText(text, { final = false, confidence } = {}) {
          if (active !== epoch) return;
          lastConfidence = confidence;
          publish({ transcript: String(text).slice(0, 2000) });
          timers.clear(quietTimer);
          if (final) finish();
          else if (text.trim()) quietTimer = timers.set(finish, 2000);
        },
        onEnd() { if (active === epoch) { timers.clear(quietTimer); quietTimer = timers.set(finish, 2000); } },
        onError(code) { if (active === epoch) fail(code); },
      });
      if (active !== epoch) { handle.cancel(); return; }
      session = handle;
      publish({ phase: 'listening' });
      emptyTimer = timers.set(() => { if (active === epoch && !state.transcript.trim()) fail('noSpeech'); }, 5000);
      hardTimer = timers.set(() => { if (active === epoch) finish(); }, 25000);
    } catch (error) { if (active === epoch) fail(Object.hasOwn(voiceMessages[state.language], error.code) ? error.code : 'unsupported'); }
  }
  async function speak(text, { language = state.language, offline = false, manual = false } = {}) {
    if ((!state.autoSpeak && !manual) || (!manual && state.language !== language) || ['listening', 'checking'].includes(state.phase)) return;
    stopSpeaking(); const active = audioEpoch;
    const clean = speechText(text, language); if (!clean) return;
    publish({ phase: 'speaking', notice: '', noticeCode: null });
    try { await speaker.speak(clean, { language, offline }); }
    catch (error) { if (active === audioEpoch) publish({ noticeCode: error.code || 'playback', notice: voiceMessages[language][error.code] || voiceMessages[language].playback }); }
    finally { if (active === audioEpoch && state.phase === 'speaking') publish({ phase: 'idle' }); }
  }
  return { start, cancel, finish, speak, stopSpeaking, clearNotice: () => publish({ notice: '' }),
    setLanguage(value) { cancel(); publish({ language: voiceLanguage(value), notice: '', noticeCode: null }); persist(); },
    toggleSpeaker() { stopSpeaking(); publish({ autoSpeak: !state.autoSpeak }); persist(); },
    getSnapshot: () => state, subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
}
