import { useCallback, useEffect, useRef, useState } from 'react';
import { Star } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { communityApi } from '../../services/communityService';

export default function LocationReviews({ locationId }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const initialized = useRef(false);
  const load = useCallback(async (signal, resetForm = false) => {
    try {
      const result = await communityApi.reviews(locationId, page, signal);
      if (signal?.aborted) return;
      if (page > 1 && result.items.length === 0) { setPage(Math.max(1, Math.ceil(result.totalCount / result.pageSize))); return; }
      setData(result);
      if (!initialized.current || resetForm) {
        setRating(result.myReview?.rating || 0);
        setComment(result.myReview?.comment || '');
        initialized.current = true;
      }
      setError('');
    } catch (error) { if (!signal?.aborted) setError(error.message); }
  }, [locationId, page]);
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  async function save(event) {
    event.preventDefault();
    if (!rating) { setError('Vui lòng chọn từ 1 đến 5 sao.'); return; }
    setBusy(true);
    setNotice('');
    try {
      await communityApi.saveReview(locationId, { rating, comment: comment.trim() });
      await load(undefined, true);
      setNotice('Đã lưu đánh giá của bạn.');
      window.dispatchEvent(new Event('mapai:places-changed'));
    } catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }

  async function remove() {
    setBusy(true);
    setNotice('');
    try {
      await communityApi.deleteReview(locationId);
      setConfirmDelete(false);
      setRating(0);
      setComment('');
      if (page !== 1) setPage(1);
      else await load(undefined, true);
      setNotice('Đã xóa đánh giá của bạn.');
      window.dispatchEvent(new Event('mapai:places-changed'));
    } catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }

  return <section aria-label="Đánh giá cộng đồng MapAI" className="space-y-4">
    <h3 className="text-base font-bold">Đánh giá cộng đồng MapAI</h3>
    {data && <p className="text-amber-300 font-semibold">{data.totalCount ? `${Number(data.averageRating).toFixed(1)}/5 · ${data.totalCount} đánh giá` : 'Chưa có đánh giá. Hãy chia sẻ trải nghiệm đầu tiên!'}</p>}
    {!data && !error && <p role="status">Đang tải đánh giá...</p>}
    {error && <div><p role="alert" className="text-rose-400 text-sm">{error}</p><button className="community-secondary mt-2" onClick={() => load()}>Thử tải lại đánh giá</button></div>}
    {notice && <p role="status" className="text-emerald-400 text-sm">{notice}</p>}
    {user && data && <form onSubmit={save} className="space-y-3 border border-white/10 rounded-xl p-3">
      <p className="text-sm font-semibold">{data.myReview ? 'Sửa đánh giá của bạn' : 'Đánh giá của bạn'}</p>
      <div role="group" aria-label="Chọn số sao" className="flex gap-1">
        {[1, 2, 3, 4, 5].map(value => <button key={value} type="button" aria-label={`${value} sao`} aria-pressed={rating === value} disabled={busy} onClick={() => setRating(value)} className="p-2 text-amber-400"><Star size={24} fill={value <= rating ? 'currentColor' : 'none'} /></button>)}
      </div>
      <label className="community-field">Chia sẻ trải nghiệm<textarea maxLength={2000} rows={3} value={comment} disabled={busy} onChange={event => setComment(event.target.value)} placeholder="Chất lượng món ăn, phục vụ, giá cả..." /></label>
      <button type="submit" disabled={busy} className="community-primary w-full">{busy ? 'Đang lưu...' : data.myReview ? 'Cập nhật đánh giá' : 'Gửi đánh giá'}</button>
      {data.myReview && !confirmDelete && <button type="button" disabled={busy} className="text-sm text-rose-300 p-2" onClick={() => setConfirmDelete(true)}>Xóa đánh giá của tôi</button>}
      {confirmDelete && <div className="space-y-2"><p className="text-sm">Bạn muốn xóa đánh giá này?</p><button type="button" disabled={busy} className="community-secondary text-rose-300" onClick={remove}>Xác nhận xóa đánh giá</button><button type="button" disabled={busy} className="community-secondary ml-2" onClick={() => setConfirmDelete(false)}>Giữ lại</button></div>}
    </form>}
    {data?.items.map(review => <article key={review.id} className="border-b border-white/10 pb-3 space-y-1">
      <div className="flex justify-between gap-2 text-sm"><strong>{review.authorName}{review.isMine ? ' (Bạn)' : ''}</strong><span className="text-amber-300">{review.rating}/5 ★</span></div>
      <p className="text-xs text-slate-500">{new Date(review.createdAt).toLocaleDateString('vi-VN')}{review.updatedAt ? ' · Đã chỉnh sửa' : ''}</p>
      <p className="text-sm text-slate-300 whitespace-pre-wrap break-words">{review.comment}</p>
    </article>)}
    {data && data.totalCount > data.pageSize && <nav aria-label="Phân trang đánh giá" className="flex items-center gap-2 text-sm">
      <button disabled={page <= 1 || busy} className="community-secondary" onClick={() => setPage(page - 1)}>Trang trước</button><span>{page}</span>
      <button disabled={page * data.pageSize >= data.totalCount || busy} className="community-secondary" onClick={() => setPage(page + 1)}>Trang sau</button>
    </nav>}
  </section>;
}
