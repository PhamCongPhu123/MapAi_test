import { createVoiceAssistant } from './application/createVoiceAssistant.js';
import { platformSpeechPorts } from './infrastructure/speechAdapters';
export function makeVoiceAssistant() {
  return createVoiceAssistant({ ...platformSpeechPorts(), preferences: {
    read() { try { return JSON.parse(localStorage.getItem('mapai-voice-preferences')) || {}; } catch { return {}; } },
    write(value) { try { localStorage.setItem('mapai-voice-preferences', JSON.stringify(value)); } catch { /* In-memory preferences still work. */ } },
  }, timers: { set: (fn, ms) => setTimeout(fn, ms), clear: id => clearTimeout(id) } });
}
