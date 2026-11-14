import { useCallback, useEffect, useState } from 'react';
import { communityApi } from '../../services/communityService';

const statusLabels = ['Đã duyệt', 'Chờ duyệt', 'Đã từ chối'];

export default function ContributionList({ moderation = false, onView }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);
  const [notes, setNotes] = useState({});
  const load = useCallback(async (signal) => {
    try {
      const result = await (moderation ? communityApi.pending(page, signal) : communityApi.mine(page, signal));
      if (!signal?.aborted && page > 1 && result.items.length === 0) { setPage(Math.max(1, Math.ceil(result.totalCount / result.pageSize))); return; }
      if (!signal?.aborted) { setData(result); setError(''); }
    } catch (error) { if (!signal?.aborted) setError(error.message); }
  }, [page, moderation]);
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  async function moderate(id, status) {
    if (status === 2 && !notes[id]?.trim()) { setError('Vui lòng ghi lý do từ chối trước khi xác nhận.'); return; }
    setBusy(id);
    try {
      await communityApi.moderate(id, status, notes[id]?.trim() || null);
      await load();
      window.dispatchEvent(new Event('mapai:places-changed'));
    } catch (error) { setError(error.message); }
    finally { setBusy(null); }
  }

  return <div className="space-y-4">
    {error && <p role="alert" className="text-rose-400">{error}</p>}
    <button type="button" onClick={() => load()} className="community-secondary">Tải lại danh sách</button>
    {!data && !error && <p role="status">Đang tải đóng góp...</p>}
    {data?.items.length === 0 && <p className="text-slate-400">{moderation ? 'Không có địa điểm đang chờ duyệt.' : 'Bạn chưa gửi địa điểm nào.'}</p>}
    {data?.items.map(item => <article key={item.id} className="border border-white/10 bg-slate-900/70 rounded-2xl p-4 space-y-3">
      <div className="flex justify-between gap-3"><h3 className="font-semibold">{item.title}</h3><span className="text-sm text-blue-300">{statusLabels[item.status]}</span></div>
      {item.thumbnail && <a href={item.thumbnail} target="_blank" rel="noopener noreferrer" aria-label={`Xem ảnh ${item.title}`} className="block">
        <img src={item.thumbnail} alt={`Ảnh ${item.title}`} loading="lazy" className="max-h-60 w-full rounded-xl border border-white/10 bg-slate-950 object-contain" />
      </a>}
      <p className="text-sm text-slate-300">{item.address}</p>
      <p className="text-xs text-slate-400">{item.category} · {item.latitude}, {item.longitude}</p>
      {item.description && <p className="text-sm whitespace-pre-wrap break-words">{item.description}</p>}
      <p className="text-xs text-slate-500">{item.submittedByName && `${item.submittedByName} · `}{new Date(item.createdAt).toLocaleString('vi-VN')}</p>
      {item.moderationNote && <p className="text-sm text-amber-300">Phản hồi: {item.moderationNote}</p>}
      {onView && <button className="community-secondary" onClick={() => onView(item)}>Xem vị trí</button>}
      {moderation && <>
        <label className="community-field">{`Ghi chú cho ${item.title}`}<textarea maxLength={500} rows={2} value={notes[item.id] || ''} onChange={event => setNotes({ ...notes, [item.id]: event.target.value })} /></label>
        <div className="flex gap-3"><button disabled={busy !== null} className="community-primary" onClick={() => moderate(item.id, 0)}>Duyệt địa điểm</button>
          <button disabled={busy !== null} className="community-secondary text-rose-300" onClick={() => moderate(item.id, 2)}>Từ chối</button></div>
      </>}
    </article>)}
    {data && data.totalCount > data.pageSize && <nav aria-label="Phân trang đóng góp" className="flex gap-3 items-center">
      <button className="community-secondary" disabled={page <= 1 || busy !== null} onClick={() => setPage(page - 1)}>Trang trước</button><span>Trang {page}</span>
      <button className="community-secondary" disabled={page * data.pageSize >= data.totalCount || busy !== null} onClick={() => setPage(page + 1)}>Trang sau</button>
    </nav>}
  </div>;
}
