import { useRef } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

const heights = ['18dvh', '48dvh', '90dvh'];
export default function AdaptiveBottomSheet({ size, onSizeChange, children, title, variant = 'results' }) {
  const startY = useRef(null);
  const dragged = useRef(false);
  return <section className={`offline-bottom-sheet is-${variant}`} style={{ '--sheet-height': heights[size] }} aria-label={title}>
    <div className="offline-sheet-grabber">
      <button className="offline-grab-handle" aria-label="Thay đổi chiều cao bảng" title="Kéo hoặc bấm để đổi chiều cao"
        onPointerDown={e => { dragged.current = false; startY.current = e.clientY; e.currentTarget.setPointerCapture(e.pointerId); }}
        onPointerUp={e => {
          if (startY.current === null) return;
          const delta = startY.current - e.clientY;
          dragged.current = Math.abs(delta) > 25;
          if (dragged.current) onSizeChange(Math.max(0, Math.min(2, size + (delta > 0 ? 1 : -1))));
          startY.current = null;
        }}
        onPointerCancel={() => { startY.current = null; dragged.current = false; }}
        onKeyDown={e => {
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault(); onSizeChange(Math.max(0, Math.min(2, size + (e.key === 'ArrowUp' ? 1 : -1))));
          }
        }}
        onClick={() => { if (!dragged.current) onSizeChange((size + 1) % 3); dragged.current = false; }}><span /></button>
      <div className="offline-sheet-size-controls">
        <button aria-label="Thu gọn bảng" disabled={size === 0} onClick={() => onSizeChange(size - 1)}><ChevronDown size={17} /></button>
        <button aria-label="Mở rộng bảng" disabled={size === 2} onClick={() => onSizeChange(size + 1)}><ChevronUp size={17} /></button>
      </div>
    </div>
    {children}
  </section>;
}
