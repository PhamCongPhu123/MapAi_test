import { useEffect, useRef, useState } from 'react';
import { Search, Send, Sparkles, User, X } from 'lucide-react';
import { askLocalAssistant, PROMPTS } from '../../offline/application/localAiAgent';
import PlaceCard from './PlaceCard';
import Dialog from './Dialog';
import { useCompactLayout } from '../../offline/presentation/useCompactLayout';

export default function OfflineAssistant({ places, origin, onSelect, onClose, open, available }) {
  const compact = useCompactLayout();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([{ role: 'assistant', message: 'Chào bạn! Tôi tìm và gợi ý trong gói Đà Nẵng đã tải, không cần Internet. Bạn muốn khám phá điều gì?', places: [] }]);
  const context = useRef({});
  const end = useRef(null);
  const send = text => {
    const question = text.trim();
    if (!question || !available) return;
    const reply = askLocalAssistant(question, places, { ...context.current, origin });
    context.current = reply.context || {};
    setMessages(previous => [...previous, { role: 'user', message: question }, { role: 'assistant', ...reply }]);
    setInput('');
  };
  useEffect(() => { if (open) end.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [messages, open]);
  const content = <>
    {compact && <div className="offline-assistant-subtitle"><Sparkles size={15} /><span>Chạy cục bộ · Gợi ý từ gói Đà Nẵng đã tải</span></div>}
    <div className="offline-chat-messages" role="log" aria-label="Hội thoại với trợ lý" aria-live="polite">
      {messages.map((message, i) => <div key={i} className={`offline-chat-message ${message.role === 'user' ? 'is-user' : ''}`}>
        <span className="offline-chat-avatar" aria-hidden="true">{message.role === 'user' ? <User size={14} /> : <Sparkles size={14} />}</span>
        <div className="offline-chat-bubble">
        <p>{message.message}</p>
        {message.places?.map(place => <div key={place.id} className="offline-ai-place"><PlaceCard place={place} compact onSelect={onSelect} /><button className="offline-text-button" onClick={() => onSelect(place)}>Mở trên bản đồ →</button></div>)}
        {i === messages.length - 1 && message.choices && <div className="offline-clarification" aria-label="Chọn khu vực">{message.choices.map(choice => <button key={choice} className="offline-chip" onClick={() => send(choice)}>{choice}</button>)}</div>}
        </div>
      </div>)}
      <div className="offline-prompt-chips">{PROMPTS.map(prompt => <button key={prompt} className="offline-chip" onClick={() => send(prompt)} disabled={!available}>{prompt}</button>)}</div>
      <div ref={end} />
    </div>
    <div className="offline-chat-footer">
      <form onSubmit={event => { event.preventDefault(); send(input); }}>
        <Search className="offline-chat-input-icon" size={16} aria-hidden="true" />
        <input aria-label="Hỏi trợ lý MapAI" placeholder={available ? 'Hỏi trợ lý MapAI...' : 'Đang chuẩn bị dữ liệu địa phương…'} value={input} onChange={event => setInput(event.target.value)} maxLength={500} disabled={!available} />
        <button aria-label="Gửi câu hỏi" className="offline-button accent" disabled={!input.trim() || !available}><Send size={18} /></button>
      </form>
    </div>
  </>;
  if (!open) return null;
  if (compact) return <Dialog title="Trợ lý khám phá MapAI" onClose={onClose} className="offline-assistant-backdrop">{content}</Dialog>;
  return <aside id="offline-assistant" className="offline-assistant-panel" aria-label="Trợ lý khám phá MapAI">
    <header className="offline-assistant-header">
      <span className="offline-assistant-logo"><Sparkles size={20} /></span>
      <div><h2>MapAI Assistant</h2><p><span className={available ? 'is-ready' : ''} />{available ? 'Trợ lý cục bộ sẵn sàng' : 'Đang chuẩn bị dữ liệu'}</p></div>
      <button className="offline-icon-button" aria-label="Đóng trợ lý" onClick={onClose}><X size={18} /></button>
    </header>
    {content}
  </aside>;
}
