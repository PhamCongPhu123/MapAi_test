import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle, ArrowUpRight, Check, CheckCheck, ChevronLeft, ChevronRight,
  Clock3, ImageIcon, Inbox, ListFilter, Loader2, MapPin, RefreshCw, Search,
  ShieldCheck, UserRound, X,
} from 'lucide-react';
import { communityApi } from '../../services/communityService';
import { useToast } from '../../hooks/useToast';

const controlClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-slate-900 px-4 text-xs font-bold text-slate-300 transition hover:border-blue-500/30 hover:bg-slate-800 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 disabled:cursor-not-allowed disabled:opacity-50';
const inputClass = 'min-h-11 w-full min-w-0 rounded-xl border border-white/10 bg-slate-950/60 px-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10';
const normalize = text => (text || '').toLocaleLowerCase('vi').normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/đ/g, 'd').trim();
const dateLabel = value => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Chưa có thời gian gửi' : date.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
};
const coordinate = value => Number.isFinite(value) ? value.toFixed(6) : '—';
const mapLink = place => `/map?${new URLSearchParams({ lat: place.latitude, lng: place.longitude })}`;

function PlaceImage({ place, className = '' }) {
  const [failed, setFailed] = useState(false);
  return <div className={`flex shrink-0 items-center justify-center overflow-hidden border border-white/10 bg-slate-800 ${className}`}>
    {place.thumbnail && !failed
      ? <img src={place.thumbnail} alt={`Ảnh ${place.title}`} onError={() => setFailed(true)} loading="lazy" className="h-full w-full object-cover" />
      : <ImageIcon aria-hidden="true" className="h-5 w-5 text-slate-500" />}
  </div>;
}

function PendingBadge() {
  return <span className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-lg border border-amber-500/15 bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-300">
    <Clock3 aria-hidden="true" size={12} />Chờ duyệt
  </span>;
}

function Submitter({ place }) {
  return <div className="flex min-w-0 items-center gap-2.5">
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-slate-800 text-slate-400"><UserRound aria-hidden="true" size={14} /></div>
    <div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-200">{place.submittedByName || 'Thành viên MapAI'}</p>
      <p className="mt-1 text-[11px] text-slate-500">{dateLabel(place.createdAt)}</p></div>
  </div>;
}

function ReviewDialog({ place, note, onNoteChange, onClose, onModerate, busy }) {
  const dialog = useRef(null);
  const noteInput = useRef(null);
  const errorMessage = useRef(null);
  const [error, setError] = useState('');
  const [noteError, setNoteError] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    const returnFocus = document.activeElement;
    element.showModal();
    return () => {
      element.close();
      if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    if (error) errorMessage.current?.scrollIntoView({ block: 'nearest' });
  }, [error]);

  async function submit(status) {
    if (status === 2 && !note.trim()) {
      setError('Vui lòng ghi lý do từ chối trước khi xác nhận.');
      setNoteError(true);
      noteInput.current?.focus();
      return;
    }
    setError('');
    setNoteError(false);
    try { await onModerate(place, status); }
    catch (failure) { setError(failure.message); }
  }

  return <dialog ref={dialog} aria-labelledby="moderation-dialog-title" aria-describedby="moderation-dialog-description"
    onCancel={event => { event.preventDefault(); if (busy === null) onClose(); }}
    onClick={event => { if (event.target === event.currentTarget && busy === null) onClose(); }}
    className="m-auto w-[calc(100%-2rem)] max-w-3xl overflow-hidden rounded-3xl border border-white/10 bg-slate-900 p-0 text-slate-100 shadow-2xl backdrop:bg-slate-950/80 backdrop:backdrop-blur-sm">
    <form onSubmit={event => { event.preventDefault(); submit(0); }} className="flex max-h-[calc(100dvh-2rem)] flex-col">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-5 py-5 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-2.5 text-blue-400"><ShieldCheck aria-hidden="true" size={20} /></div>
          <div><h2 id="moderation-dialog-title" className="text-lg font-black tracking-tight text-white">Duyệt địa điểm</h2>
            <p id="moderation-dialog-description" className="mt-1 text-xs text-slate-400">Kiểm tra thông tin trước khi công bố.</p></div>
        </div>
        <button type="button" aria-label="Đóng biểu mẫu duyệt" onClick={onClose} disabled={busy !== null} className="rounded-xl p-2.5 text-slate-400 transition hover:bg-white/5 hover:text-white disabled:opacity-40"><X size={20} /></button>
      </header>

      <div className="min-h-0 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-4">
            <PlaceImage key={place.thumbnail} place={place} className="h-48 w-full rounded-2xl" />
            {place.thumbnail && <a href={place.thumbnail} target="_blank" rel="noopener noreferrer" aria-label={`Xem ảnh ${place.title}`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300">Mở ảnh gốc<ArrowUpRight aria-hidden="true" size={14} /></a>}
            <section className="rounded-2xl border border-white/5 bg-slate-950/40 p-4" aria-label="Người gửi đóng góp"><Submitter place={place} /></section>
          </div>
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2"><PendingBadge /><span className="rounded-lg border border-blue-500/15 bg-blue-500/10 px-2.5 py-1 text-[11px] font-bold text-blue-300">{place.category || 'Chưa phân loại'}</span></div>
            <h3 className="break-words text-xl font-black tracking-tight text-white">{place.title}</h3>
            <div className="flex items-start gap-2 text-sm leading-relaxed text-slate-300"><MapPin aria-hidden="true" size={16} className="mt-0.5 shrink-0 text-blue-400" /><p className="break-words">{place.address || 'Chưa có địa chỉ'}</p></div>
            <dl className="grid grid-cols-2 gap-3 rounded-2xl border border-white/5 bg-slate-950/50 p-4">
              <div><dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Vĩ độ</dt><dd className="mt-1 font-mono text-xs text-slate-200">{coordinate(place.latitude)}</dd></div>
              <div><dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Kinh độ</dt><dd className="mt-1 font-mono text-xs text-slate-200">{coordinate(place.longitude)}</dd></div>
            </dl>
            <Link to={mapLink(place)} target="_blank" rel="noopener noreferrer" className={`${controlClass} w-full`}><MapPin aria-hidden="true" size={15} />Xem vị trí<ArrowUpRight aria-hidden="true" size={14} /></Link>
          </div>
        </div>

        <section className="space-y-2" aria-label="Mô tả địa điểm">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Mô tả địa điểm</h4>
          <p className="whitespace-pre-wrap break-words rounded-xl border border-white/5 bg-slate-950/40 p-4 text-sm leading-relaxed text-slate-300">{place.description || 'Người gửi chưa bổ sung mô tả.'}</p>
        </section>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3"><label htmlFor="moderation-note" className="text-xs font-bold text-slate-200">Ghi chú cho {place.title}</label><span className="shrink-0 text-[11px] tabular-nums text-slate-500">{note.length}/500</span></div>
          <textarea ref={noteInput} id="moderation-note" value={note} onChange={event => onNoteChange(event.target.value)} maxLength={500} rows={3} disabled={busy !== null}
            aria-invalid={noteError} aria-describedby={noteError ? 'moderation-note-hint moderation-review-error' : 'moderation-note-hint'}
            placeholder="Nhập nhận xét hoặc lý do cần điều chỉnh..." className={`${inputClass} resize-y p-3 ${noteError ? 'border-rose-400/60' : ''}`} />
          <p id="moderation-note-hint" className="text-xs leading-relaxed text-slate-500">Không bắt buộc khi duyệt. Cần ghi rõ lý do nếu từ chối để người gửi có thể điều chỉnh.</p>
        </div>
        {error && <p ref={errorMessage} role="alert" id="moderation-review-error" className="flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-300"><AlertCircle aria-hidden="true" size={16} className="mt-0.5 shrink-0" />{error}</p>}
      </div>

      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-slate-950/30 px-5 py-4 sm:px-6">
        <div className="hidden sm:block"><button type="button" onClick={onClose} disabled={busy !== null} className={controlClass}>Đóng</button></div>
        <div className="flex w-full gap-2 sm:w-auto">
          <button type="button" onClick={() => submit(2)} disabled={busy !== null} className={`${controlClass} flex-1 whitespace-nowrap border-rose-500/20 text-rose-300 hover:border-rose-400/40 hover:bg-rose-500/10 hover:text-rose-200 sm:flex-none`}>{busy === 2 ? <Loader2 aria-hidden="true" size={15} className="animate-spin" /> : <X aria-hidden="true" size={15} />}Từ chối</button>
          <button type="submit" disabled={busy !== null} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-blue-600 px-4 text-xs font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none">{busy === 0 ? <Loader2 aria-hidden="true" size={15} className="animate-spin" /> : <Check aria-hidden="true" size={15} />}Duyệt địa điểm</button>
        </div>
      </footer>
    </form>
  </dialog>;
}

export default function ContributionModeration() {
  const { addToast } = useToast();
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [selected, setSelected] = useState(null);
  const [notes, setNotes] = useState({});
  const [busy, setBusy] = useState(null);
  const [processed, setProcessed] = useState(0);
  const requestId = useRef(0);

  const load = useCallback(async signal => {
    const current = ++requestId.current;
    setLoading(true);
    setError('');
    try {
      const result = await communityApi.pending(page, signal);
      if (signal?.aborted || current !== requestId.current) return;
      if (page > 1 && result.items.length === 0) { setPage(Math.max(1, Math.ceil(result.totalCount / result.pageSize))); return; }
      setData(result);
      setCategory(current => result.items.some(item => item.category === current) ? current : '');
    } catch (failure) { if (!signal?.aborted && current === requestId.current) setError(failure.message); }
    finally { if (!signal?.aborted && current === requestId.current) setLoading(false); }
  }, [page]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  async function moderate(place, status) {
    setBusy(status);
    try {
      await communityApi.moderate(place.id, status, notes[place.id]?.trim() || null);
      setSelected(null);
      setProcessed(count => count + 1);
      setNotes(current => { const next = { ...current }; delete next[place.id]; return next; });
      addToast(status === 0 ? 'Đã duyệt địa điểm và công bố trên MapAI.' : 'Đã từ chối địa điểm.', 'success');
      window.dispatchEvent(new Event('mapai:places-changed'));
      await load();
    } finally { setBusy(null); }
  }

  function changePage(next) { setQuery(''); setCategory(''); setPage(next); }
  const items = data?.items || [];
  const categories = [...new Set(items.map(item => item.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi'));
  const visible = items.filter(item => (!category || item.category === category)
    && normalize(`${item.title} ${item.address || ''} ${item.submittedByName || ''}`).includes(normalize(query)));
  const pageCount = Math.max(1, Math.ceil((data?.totalCount || 0) / (data?.pageSize || 10)));
  const reviewButton = place => <button type="button" onClick={() => setSelected(place)} aria-label={`Xem và duyệt ${place.title}`} className="inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-blue-500/15 bg-blue-500/10 px-3 text-xs font-bold text-blue-300 transition hover:border-blue-400/40 hover:bg-blue-500/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"><ShieldCheck aria-hidden="true" size={15} />Xem & duyệt<ChevronRight aria-hidden="true" size={14} /></button>;

  return <section className="space-y-5 pb-12" aria-labelledby="moderation-page-title">
    <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
      <div><h1 id="moderation-page-title" className="text-xl font-black tracking-tight text-white">Duyệt địa điểm cộng đồng</h1>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-400">Kiểm tra và duyệt những địa điểm được cộng đồng đóng góp.</p></div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Link to="/map" target="_blank" rel="noopener noreferrer" className={controlClass}><MapPin aria-hidden="true" size={15} />Mở bản đồ<ArrowUpRight aria-hidden="true" size={14} /></Link>
        <button type="button" onClick={() => load()} disabled={loading || busy !== null} className={controlClass}><RefreshCw aria-hidden="true" size={15} className={loading ? 'animate-spin' : ''} />Tải lại danh sách</button>
      </div>
    </header>

    <div className="grid grid-cols-3 gap-2 sm:gap-4">
      <div className="glass-card flex min-w-0 items-center justify-between gap-2 rounded-2xl border border-white/5 p-3 sm:p-5"><div><p className="min-h-8 text-[10px] font-bold text-slate-400 sm:min-h-0 sm:text-[11px]">Đang chờ duyệt</p><p className="mt-2 text-2xl font-black tabular-nums text-white">{data?.totalCount ?? '—'}</p></div><span className="hidden rounded-xl bg-amber-500/10 p-3 text-amber-400 lg:block"><Clock3 aria-hidden="true" size={20} /></span></div>
      <div className="glass-card flex min-w-0 items-center justify-between gap-2 rounded-2xl border border-white/5 p-3 sm:p-5"><div><p className="min-h-8 text-[10px] font-bold text-slate-400 sm:min-h-0 sm:text-[11px]">Địa điểm trên trang</p><p className="mt-2 text-2xl font-black tabular-nums text-white">{data ? items.length : '—'}</p></div><span className="hidden rounded-xl bg-blue-500/10 p-3 text-blue-400 lg:block"><MapPin aria-hidden="true" size={20} /></span></div>
      <div className="glass-card flex min-w-0 items-center justify-between gap-2 rounded-2xl border border-white/5 p-3 sm:p-5"><div><p className="min-h-8 text-[10px] font-bold text-slate-400 sm:min-h-0 sm:text-[11px]">Đã xử lý trong phiên</p><p className="mt-2 text-2xl font-black tabular-nums text-white">{processed}</p></div><span className="hidden rounded-xl bg-emerald-500/10 p-3 text-emerald-400 lg:block"><CheckCheck aria-hidden="true" size={20} /></span></div>
    </div>

    <div className="glass-card overflow-hidden rounded-3xl border border-white/5 shadow-2xl" aria-busy={loading}>
      <div className="flex flex-col justify-between gap-4 border-b border-white/5 p-5 lg:flex-row lg:items-center">
        <div><h2 className="flex items-center gap-2 text-sm font-bold text-white"><Inbox aria-hidden="true" size={17} className="text-blue-400" />Danh sách chờ duyệt</h2>
          <p className="mt-1 text-[11px] text-slate-500">Tìm kiếm và lọc trong trang hiện tại</p></div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative sm:w-64"><Search aria-hidden="true" size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /><input type="search" aria-label="Tìm đóng góp trong trang" value={query} onChange={event => setQuery(event.target.value)} placeholder="Tên, địa chỉ hoặc người gửi..." className={`${inputClass} pl-9 text-xs`} /></div>
          <div className="relative sm:w-44"><ListFilter aria-hidden="true" size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /><select aria-label="Lọc danh mục trong trang" value={category} onChange={event => setCategory(event.target.value)} className={`${inputClass} pl-9 text-xs`}><option value="">Tất cả danh mục</option>{categories.map(value => <option key={value}>{value}</option>)}</select></div>
        </div>
      </div>

      {loading ? <div role="status" className="flex min-h-80 flex-col items-center justify-center gap-3 p-6"><Loader2 aria-hidden="true" className="h-8 w-8 animate-spin text-blue-500" /><p className="text-sm text-slate-400">Đang tải đóng góp...</p></div>
        : error ? <div role="alert" className="flex min-h-80 flex-col items-center justify-center gap-3 p-6 text-center"><AlertCircle aria-hidden="true" className="h-9 w-9 text-rose-400" /><h3 className="font-bold text-white">Chưa tải được danh sách</h3><p className="max-w-md text-sm text-slate-400">{error}</p><button type="button" onClick={() => load()} className={controlClass}>Thử lại</button></div>
          : visible.length === 0 ? <div className="flex min-h-80 flex-col items-center justify-center px-6 py-12 text-center">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-blue-500/15 bg-blue-500/10 text-blue-400">{items.length ? <Search aria-hidden="true" size={28} /> : <ShieldCheck aria-hidden="true" size={28} />}</div>
            <h3 className="text-base font-bold text-white">{items.length ? 'Không tìm thấy đóng góp phù hợp' : 'Không có địa điểm đang chờ duyệt.'}</h3>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-400">{items.length ? 'Thử từ khóa khác hoặc bỏ bộ lọc để xem các đóng góp trong trang này.' : 'Các đóng góp mới sẽ xuất hiện tại đây. Chỉ địa điểm đã được duyệt mới hiển thị công khai.'}</p>
            {items.length > 0 && <button type="button" onClick={() => { setQuery(''); setCategory(''); }} className={`${controlClass} mt-5`}>Xóa bộ lọc</button>}
          </div> : <>
            <div className="hidden overflow-x-auto md:block"><table className="w-full border-collapse text-left"><caption className="sr-only">Danh sách địa điểm cộng đồng chờ duyệt</caption>
              <thead className="border-b border-white/5 bg-white/[.03] text-[10px] font-bold uppercase tracking-wider text-slate-500"><tr><th scope="col" className="px-5 py-4">Địa điểm</th><th scope="col" className="px-4 py-4">Người đóng góp</th><th scope="col" className="px-4 py-4">Trạng thái</th><th scope="col" className="px-5 py-4 text-right">Thao tác</th></tr></thead>
              <tbody className="divide-y divide-white/5">{visible.map(place => <tr key={place.id} className="group transition hover:bg-white/[.03]">
                <td className="max-w-xs px-5 py-4"><div className="flex items-center gap-3"><PlaceImage key={`${place.id}:${place.thumbnail}`} place={place} className="h-12 w-14 rounded-xl" /><div className="min-w-0"><p className="truncate text-xs font-bold text-white group-hover:text-blue-300" title={place.title}>{place.title}</p><p className="mt-1 truncate text-[11px] text-slate-500" title={place.address}>{place.address || 'Chưa có địa chỉ'}</p><span className="mt-1.5 inline-block text-[10px] font-semibold text-blue-400">{place.category || 'Chưa phân loại'}</span></div></div></td>
                <td className="px-4 py-4"><Submitter place={place} /></td><td className="px-4 py-4"><PendingBadge /></td><td className="px-5 py-4 text-right">{reviewButton(place)}</td>
              </tr>)}</tbody>
            </table></div>
            <div className="divide-y divide-white/5 md:hidden">{visible.map(place => <article key={place.id} className="space-y-4 p-5">
              <div className="flex items-start gap-3"><PlaceImage key={`${place.id}:${place.thumbnail}`} place={place} className="h-16 w-16 rounded-xl" /><div className="min-w-0 flex-1"><h3 className="break-words text-sm font-bold text-white">{place.title}</h3><p className="mt-1 break-words text-xs leading-relaxed text-slate-400">{place.address || 'Chưa có địa chỉ'}</p><p className="mt-2 text-[11px] font-semibold text-blue-400">{place.category || 'Chưa phân loại'}</p></div></div>
              <Submitter place={place} /><div className="flex flex-wrap items-center justify-between gap-3"><PendingBadge />{reviewButton(place)}</div>
            </article>)}</div>
          </>}

      {!loading && !error && data && <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 px-5 py-4">
        <p className="text-xs text-slate-500">Hiển thị <span className="font-bold text-slate-300">{visible.length}/{items.length}</span> địa điểm trong trang</p>
        {pageCount > 1 && <nav aria-label="Phân trang đóng góp" className="flex items-center gap-2"><button type="button" aria-label="Trang trước" disabled={page <= 1} onClick={() => changePage(page - 1)} className={`${controlClass} px-3`}><ChevronLeft aria-hidden="true" size={16} /></button><span className="text-xs text-slate-400">Trang {page}/{pageCount}</span><button type="button" aria-label="Trang sau" disabled={page >= pageCount} onClick={() => changePage(page + 1)} className={`${controlClass} px-3`}><ChevronRight aria-hidden="true" size={16} /></button></nav>}
      </footer>}
    </div>

    {selected && <ReviewDialog key={selected.id} place={selected} note={notes[selected.id] || ''} onNoteChange={value => setNotes(current => ({ ...current, [selected.id]: value }))} onClose={() => setSelected(null)} onModerate={moderate} busy={busy} />}
  </section>;
}
