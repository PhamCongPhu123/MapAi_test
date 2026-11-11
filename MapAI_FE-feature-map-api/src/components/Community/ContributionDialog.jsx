import { useEffect, useState } from 'react';
import { Crosshair, ImagePlus, MapPin, X } from 'lucide-react';
import { communityApi } from '../../services/communityService';
import { getDeviceLocation, locationErrorMessage } from '../../services/deviceLocation';

export default function ContributionDialog({ initialName = '', coordinates, onCoordinatesChange, picking, onPick, onClose, onSubmitted }) {
  const [title, setTitle] = useState(initialName);
  const [address, setAddress] = useState('');
  const [category, setCategory] = useState('Cafe');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState(null);
  const [uploadedUrl, setUploadedUrl] = useState(null);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const [imageError, setImageError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const preview = photo?.preview;
    return () => { if (preview) URL.revokeObjectURL(preview); };
  }, [photo]);

  function selectPhoto(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
      setImageError('Chỉ chấp nhận ảnh JPG, PNG, GIF hoặc WebP.');
      return;
    }
    if (file.size === 0 || file.size > 5 * 1024 * 1024) {
      setImageError('Vui lòng chọn ảnh có dung lượng lớn hơn 0 và tối đa 5 MB.');
      return;
    }
    setImageError('');
    setUploadedUrl(null);
    setPhoto({ file, preview: URL.createObjectURL(file) });
  }

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
    if (busy || locating) return;
    setError('');
    const latitude = Number(coordinates.latitude);
    const longitude = Number(coordinates.longitude);
    if (!title.trim() || !address.trim() || coordinates.latitude === '' || coordinates.longitude === ''
      || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      setError('Vui lòng nhập tên, địa chỉ và tọa độ hợp lệ.');
      return;
    }
    setBusy(true);
    setImageError('');
    try {
      let thumbnail = uploadedUrl;
      if (photo && !thumbnail) {
        try {
          thumbnail = await communityApi.uploadImage(photo.file);
          setUploadedUrl(thumbnail);
        } catch (error) {
          setImageError(error.message);
          return;
        }
      }
      await communityApi.submit({ title: title.trim(), address: address.trim(), category, description: description.trim(), latitude, longitude, thumbnail });
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
          <fieldset disabled={busy} className="space-y-4">
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
          <section aria-labelledby="contribution-description-label" className="space-y-3 rounded-2xl border border-white/10 bg-slate-950/30 p-4">
            <h3 id="contribution-description-label" className="font-semibold text-slate-100">Mô tả địa điểm</h3>
            <p id="contribution-description-help" className="text-xs leading-5 text-slate-400">Không bắt buộc. Chia sẻ đặc điểm, giờ mở cửa hoặc thông tin hữu ích về địa điểm.</p>
            <textarea aria-labelledby="contribution-description-label" aria-describedby="contribution-description-help" maxLength={2000} rows={3} value={description} onChange={event => setDescription(event.target.value)} placeholder="Viết mô tả địa điểm tại đây…" className="w-full resize-y rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-slate-100 outline-none focus:border-blue-500" />
            <p className="text-right text-xs text-slate-500">{description.length}/2.000 ký tự</p>
          </section>
          <section aria-labelledby="contribution-photo-label" className="space-y-3 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4">
            <h3 id="contribution-photo-label" className="font-semibold text-slate-100">Ảnh địa điểm</h3>
            <p className="text-xs leading-5 text-slate-400">Không bắt buộc. Chọn một ảnh để quản trị viên dễ kiểm tra địa điểm của bạn.</p>
            {photo && <div className="relative overflow-hidden rounded-xl border border-white/10 bg-slate-950">
              <img src={photo.preview} alt="Ảnh địa điểm xem trước" className="max-h-48 w-full object-contain" />
              <button type="button" aria-label="Xóa ảnh" onClick={() => { setPhoto(null); setUploadedUrl(null); setImageError(''); }} className="absolute right-2 top-2 rounded-lg bg-slate-950/80 p-2 text-white"><X size={16} /></button>
              <p className="px-3 py-2 text-xs text-slate-400 break-all">{photo.file.name}</p>
            </div>}
            <label className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-slate-950 p-4 text-sm text-blue-300 focus-within:ring-2 focus-within:ring-blue-500 ${busy ? 'pointer-events-none opacity-60' : ''}`}>
              <ImagePlus size={20} /> {photo ? 'Chọn ảnh khác' : 'Chọn ảnh từ thiết bị'}
              <input type="file" aria-labelledby="contribution-photo-label" aria-describedby="contribution-photo-help" aria-invalid={Boolean(imageError)} accept="image/jpeg,image/png,image/gif,image/webp" onChange={selectPhoto} className="sr-only" />
            </label>
            <p id="contribution-photo-help" className="text-xs text-slate-400">JPG, PNG, GIF hoặc WebP, tối đa 5 MB. Ảnh được gửi cùng địa điểm để quản trị viên duyệt.</p>
            {imageError && <p role="alert" className="text-sm text-rose-400">{imageError}</p>}
          </section>
          {error && <p role="alert" className="text-rose-400 text-sm">{error}</p>}
          <button type="submit" disabled={busy || locating} className="community-primary w-full">{busy ? 'Đang gửi...' : 'Gửi địa điểm chờ duyệt'}</button>
          </fieldset>
        </form>}
      </div>
    </div>
  );
}
