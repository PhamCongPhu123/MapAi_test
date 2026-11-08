import { useState } from 'react';
import { Crosshair, MapPin, X } from 'lucide-react';
import { communityApi } from '../../services/communityService';
import { getDeviceLocation, locationErrorMessage } from '../../services/deviceLocation';

export default function ContributionDialog({ initialName = '', coordinates, onCoordinatesChange, picking, onPick, onClose, onSubmitted }) {
  const [title, setTitle] = useState(initialName);
  const [address, setAddress] = useState('');
  const [category, setCategory] = useState('Cafe');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  async function locate() {
    setLocating(true);
    setError('');
    try {
      const position = await getDeviceLocation();
      onCoordinatesChange({ latitude: position.coords.latitude, longitude: position.coords.longitude });
    } catch (error) { setError(locationErrorMessage(error)); }
    finally { setLocating(false); }
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    const latitude = Number(coordinates.latitude);
    const longitude = Number(coordinates.longitude);
    if (!title.trim() || !address.trim() || coordinates.latitude === '' || coordinates.longitude === ''
      || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      setError('Vui lòng nhập tên, địa chỉ và tọa độ hợp lệ.');
      return;
    }
    setBusy(true);
    try {
      await communityApi.submit({ title: title.trim(), address: address.trim(), category, description: description.trim(), latitude, longitude });
      setSubmitted(true);
      onSubmitted();
    } catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }

  if (picking) return null;
  return (
    <div className="community-overlay" role="dialog" aria-modal="true" aria-labelledby="contribute-title">
      <div className="community-dialog">
        <header className="flex items-center justify-between gap-3">
          <h2 id="contribute-title" className="text-xl font-bold">Thêm địa điểm còn thiếu</h2>
          <button aria-label="Đóng thêm địa điểm" disabled={busy} onClick={onClose} className="p-3 rounded-xl bg-white/5"><X size={20} /></button>
        </header>
        {submitted ? <div className="space-y-4 mt-6" role="status">
          <p className="text-emerald-400 font-semibold">Đã gửi địa điểm, đang chờ quản trị viên duyệt.</p>
          <p className="text-slate-400">Địa điểm sẽ xuất hiện trên bản đồ MapAI sau khi được duyệt. Bạn có thể theo dõi ở “Đóng góp của tôi”.</p>
          <button className="community-primary" onClick={onClose}>Hoàn tất</button>
        </div> : <form onSubmit={submit} className="space-y-4 mt-4">
          <p className="text-sm text-slate-400">Chọn đúng vị trí và cung cấp thông tin thực tế. Đóng góp sẽ được kiểm tra trước khi hiển thị công khai.</p>
          <label className="community-field">Tên địa điểm<input autoFocus required minLength={2} maxLength={255} value={title} onChange={event => setTitle(event.target.value)} /></label>
          <label className="community-field">Danh mục<select value={category} onChange={event => setCategory(event.target.value)}>
            <option value="Cafe">Cà phê</option><option>Ăn uống</option><option>Du lịch</option><option value="Landmark">Địa danh</option><option>Khác</option>
            <option>Cây xăng</option><option>ATM</option><option>Nhà thuốc</option><option>Bệnh viện</option><option>Bãi đỗ xe</option><option>Trạm sạc</option>
          </select></label>
          <label className="community-field">Địa chỉ<input required maxLength={500} value={address} onChange={event => setAddress(event.target.value)} /></label>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={locating} className="community-secondary" onClick={locate}><Crosshair size={16} />{locating ? 'Đang định vị...' : 'Dùng vị trí hiện tại'}</button>
            <button type="button" disabled={locating} className="community-secondary" onClick={onPick}><MapPin size={16} />Chọn trên bản đồ</button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="community-field">Vĩ độ<input required type="number" min="-90" max="90" step="any" value={coordinates.latitude} onChange={event => onCoordinatesChange({ ...coordinates, latitude: event.target.value })} /></label>
            <label className="community-field">Kinh độ<input required type="number" min="-180" max="180" step="any" value={coordinates.longitude} onChange={event => onCoordinatesChange({ ...coordinates, longitude: event.target.value })} /></label>
          </div>
          <label className="community-field">Mô tả (không bắt buộc)<textarea maxLength={2000} rows={3} value={description} onChange={event => setDescription(event.target.value)} /></label>
          {error && <p role="alert" className="text-rose-400 text-sm">{error}</p>}
          <button type="submit" disabled={busy || locating} className="community-primary w-full">{busy ? 'Đang gửi...' : 'Gửi địa điểm chờ duyệt'}</button>
        </form>}
      </div>
    </div>
  );
}
