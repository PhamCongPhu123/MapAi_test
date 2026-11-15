import { useState } from 'react';
import { syncService } from '../compositionRoot';
export default function QueuedChangeEditor({ job }) {
  const [editing, setEditing] = useState(false), [payload, setPayload] = useState(job.payload), [error, setError] = useState('');
  if (!job.blocked || job.kind === 'favorite' || job.kind === 'review-delete') return null;
  if (!editing) return <button className="community-secondary" onClick={() => setEditing(true)}>Sửa nội dung chờ gửi</button>;
  async function save(event) {
    event.preventDefault();
    try { await syncService.editJob(job.key, payload); setEditing(false); }
    catch (error) { setError(error.message); }
  }
  return <form className="space-y-2 mt-3" onSubmit={save}>
    {job.kind === 'contribution' ? <>
      <label className="community-field">Tên địa điểm<input required minLength={2} maxLength={255} value={payload.title} onChange={e => setPayload({ ...payload, title: e.target.value })} /></label>
      <label className="community-field">Địa chỉ<input required maxLength={500} value={payload.address} onChange={e => setPayload({ ...payload, address: e.target.value })} /></label>
      <label className="community-field">Vĩ độ<input type="number" step="any" min={-90} max={90} required value={payload.latitude} onChange={e => setPayload({ ...payload, latitude: Number(e.target.value) })} /></label>
      <label className="community-field">Kinh độ<input type="number" step="any" min={-180} max={180} required value={payload.longitude} onChange={e => setPayload({ ...payload, longitude: Number(e.target.value) })} /></label>
    </> : <>
      <label className="community-field">Số sao<input type="number" min={1} max={5} required value={payload.rating} onChange={e => setPayload({ ...payload, rating: Number(e.target.value) })} /></label>
      <label className="community-field">Nội dung<textarea maxLength={2000} value={payload.comment} onChange={e => setPayload({ ...payload, comment: e.target.value })} /></label>
    </>}
    {error && <p role="alert">{error}</p>}
    <button className="community-primary">Lưu thay đổi</button><button type="button" className="community-secondary ml-2" onClick={() => setEditing(false)}>Hủy chỉnh sửa</button>
  </form>;
}
