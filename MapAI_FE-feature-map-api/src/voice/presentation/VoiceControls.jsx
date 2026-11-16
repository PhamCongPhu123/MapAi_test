import { Mic, Loader2, Send, X, Volume2, VolumeX, Square } from 'lucide-react';
export function SpeakerControl({ voice }) {
  const en = voice.language === 'en-US';
  return <div className="flex items-center gap-1">
    {voice.phase === 'speaking' && <button type="button" className="voice-button" aria-label={en ? 'Stop speaking' : 'Dừng đọc'} onClick={voice.assistant.stopSpeaking}><Square size={16} /></button>}
    <button type="button" className="voice-button" aria-label={en ? 'Automatic voice replies' : 'Tự động đọc câu trả lời'} aria-pressed={voice.autoSpeak} onClick={() => voice.assistant.toggleSpeaker()} title={en ? 'Toggle voice replies' : 'Bật/tắt loa trả lời'}>{voice.autoSpeak ? <Volume2 size={18} /> : <VolumeX size={18} />}</button>
  </div>;
}
export function VoiceControls({ voice, busy, offline, onStart }) {
  const en = voice.language === 'en-US', recording = ['checking', 'listening'].includes(voice.phase);
  return <>
    <div className="voice-toolbar">
      <div role="group" aria-label="VI / EN" className="voice-language">
        {[['vi-VN', 'VI', 'Tiếng Việt (VI)'], ['en-US', 'EN', 'English (EN)']].map(([language, label, name]) => <button key={language} type="button" aria-label={name} aria-pressed={voice.language === language} onClick={() => voice.assistant.setLanguage(language)}>{label}</button>)}
      </div>
      <span className="text-[10px] text-slate-400 flex-1">{offline ? en ? 'Offline · downloaded places and routes' : 'Offline · địa điểm và đường đã tải' : en ? 'Voice may use the device speech service' : 'Giọng nói có thể dùng dịch vụ của thiết bị'}</span>
      <button type="button" className={`voice-button voice-mic ${recording ? 'is-listening' : ''}`} aria-label={recording ? en ? 'Stop recording' : 'Dừng thu âm' : en ? 'Ask by voice' : 'Hỏi bằng giọng nói'} aria-pressed={recording} disabled={busy || voice.phase === 'checking'} onClick={() => recording ? voice.assistant.finish() : onStart()}>{voice.phase === 'checking' ? <Loader2 size={20} className="animate-spin" /> : <Mic size={20} />}</button>
    </div>
    {recording && <section aria-label={en ? 'Voice transcript' : 'Nội dung giọng nói'} className="voice-transcript">
      <div className="flex items-center gap-2 text-xs"><span className="voice-wave" aria-hidden="true">▂ ▅ ▃ ▇ ▂</span>{voice.phase === 'checking' ? en ? 'Checking microphone…' : 'Đang kiểm tra micro…' : en ? 'Listening…' : 'Đang nghe…'}</div>
      <p aria-live="polite" className="text-sm min-h-6 my-2 break-words">{voice.transcript || (en ? 'Say a place name or map command.' : 'Nói tên địa điểm hoặc lệnh bản đồ.')}</p>
      <div className="flex gap-2"><button type="button" className="community-secondary text-xs" onClick={voice.assistant.cancel}><X size={14} />{en ? 'Cancel' : 'Hủy'}</button><button type="button" disabled={!voice.transcript.trim()} className="community-primary text-xs" onClick={voice.assistant.finish}><Send size={14} />{en ? 'Send now' : 'Gửi ngay'}</button></div>
    </section>}
    {voice.notice && <p role="status" className="voice-notice">{voice.notice}</p>}
  </>;
}
