import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Clock3, Coffee, Database, Heart, LocateFixed, MapPin, Navigation, Search, Sparkles, Ticket, Utensils, Wifi, WifiOff, X } from 'lucide-react';
import { useOfflineData } from '../offline/presentation/useOfflineData';
import { useNetworkStatus } from '../offline/network';
import { usePwaStatus } from '../offline/pwa';
import { useCompactLayout } from '../offline/presentation/useCompactLayout';
import { CATEGORIES, CENTER, DISTRICTS, categoryLabel } from '../offline/application/constants';
import { createSearchEngine, distanceMeters, inBounds } from '../offline/application/searchEngine';
import { offlineService } from '../offline/compositionRoot';
const { recordVisit, toggleFavorite } = offlineService;
import OfflineMapCanvas from '../features/offline/OfflineMapCanvas';
import PlaceCard, { PlaceImage } from '../features/offline/PlaceCard';
import AdaptiveBottomSheet from '../features/offline/AdaptiveBottomSheet';
import OfflineDataModal from '../features/offline/OfflineDataModal';
import OfflineAssistant from '../features/offline/OfflineAssistant';
import OfflineRoutePanel from '../features/offline/OfflineRoutePanel';
import '../design-system/offline.css';

export default function OfflineMapPage() {
  const resource = useOfflineData();
  const { data, status, error, progress, personal } = resource;
  const network = useNetworkStatus();
  const pwa = usePwaStatus();
  const compact = useCompactLayout();
  const [params] = useSearchParams();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [district, setDistrict] = useState('Tất cả');
  const [collection, setCollection] = useState('all');
  const [center, setCenter] = useState(CENTER);
  const [selected, setSelected] = useState(null);
  const [sheetSize, setSheetSize] = useState(1);
  const [dataOpen, setDataOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(() => !window.matchMedia('(max-width: 1023px)').matches);
  const [directionsOpen, setDirectionsOpen] = useState(false);
  const [pickingOrigin, setPickingOrigin] = useState(false);
  const [origin, setOrigin] = useState(null);
  const [mode, setMode] = useState('foot');
  const [route, setRoute] = useState(null);
  const [routeBusy, setRouteBusy] = useState(false);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [routeError, setRouteError] = useState('');
  const [notice, setNotice] = useState('');
  const mapApi = useRef(null);
  const routeId = useRef(0);
  const gpsId = useRef(0);

  const search = useMemo(() => createSearchEngine(data?.places || []), [data]);
  const results = useMemo(() => {
    const ids = collection === 'favorites' ? personal.favorites : collection === 'history' ? new Set(personal.history.map(h => h.placeId)) : undefined;
    const found = search({ query, category, district, center, ids });
    if (collection === 'history' && !query) {
      const recent = new Map(personal.history.map((h, i) => [h.placeId, i]));
      found.sort((a, b) => recent.get(a.id) - recent.get(b.id));
    }
    return found;
  }, [search, query, category, district, center, collection, personal]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  const cancelPendingRoute = useCallback(() => { routeId.current++; setRouteBusy(false); setRoute(null); setRouteError(''); }, []);
  useEffect(() => {
    const onBack = event => {
      if (dataOpen) setDataOpen(false);
      else if (compact && assistantOpen) setAssistantOpen(false);
      else if (pickingOrigin) setPickingOrigin(false);
      else if (directionsOpen) { setDirectionsOpen(false); cancelPendingRoute(); }
      else if (selected) { setSelected(null); cancelPendingRoute(); }
      else return;
      event.preventDefault();
    };
    window.addEventListener('mapai:back', onBack);
    return () => window.removeEventListener('mapai:back', onBack);
  }, [dataOpen, compact, assistantOpen, pickingOrigin, directionsOpen, selected, cancelPendingRoute]);
  const flyTo = useCallback(place => {
    mapApi.current?.flyTo({ center: [place.lng, place.lat], zoom: 15.2,
      offset: compact ? [0, -75] : [-150, 0], duration: 650 });
  }, [compact]);
  const selectPlace = useCallback(place => {
    setSelected(place); setDirectionsOpen(false); setPickingOrigin(false); setSheetSize(compact ? 1 : 2);
    if (compact) setAssistantOpen(false);
    gpsId.current++; setGpsBusy(false); cancelPendingRoute();
    flyTo(place);
    recordVisit(place.id).catch(() => setNotice('Không lưu được lịch sử. Kiểm tra quyền lưu trữ của trình duyệt.'));
  }, [flyTo, cancelPendingRoute, compact]);

  useEffect(() => {
    if (!data) return;
    const id = params.get('place');
    const lat = Number(params.get('lat')), lng = Number(params.get('lng'));
    const place = id ? data.places.find(p => p.id === id) : params.has('lat') && params.has('lng') ?
      data.places.find(p => distanceMeters({ lat, lng }, p) < 200) : null;
    if (place) queueMicrotask(() => selectPlace(place));
  }, [data, params, selectPlace]);

  const saveFavorite = async id => {
    try { await toggleFavorite(id); }
    catch { setNotice('Không lưu được yêu thích. Kiểm tra dung lượng hoặc quyền lưu trữ của trình duyệt.'); }
  };
  const clearFilters = () => { setQuery(''); setCategory('all'); setDistrict('Tất cả'); setCollection('all'); setSheetSize(1); };
  const chooseOrigin = point => {
    gpsId.current++; setGpsBusy(false); setNotice(''); cancelPendingRoute();
    setOrigin(point); setPickingOrigin(false); setSheetSize(1);
  };
  const requestGps = () => {
    const report = message => { setRouteError(message); if (!directionsOpen) setNotice(message); };
    const id = ++gpsId.current;
    setGpsBusy(true); setRouteError('');
    offlineService.getLocation().then(position => {
      if (id !== gpsId.current) return;
      setGpsBusy(false);
      const point = { lng: position.coords.longitude, lat: position.coords.latitude, gps: true, name: 'Vị trí GPS của bạn' };
      if (!data || !inBounds(point, data.pkg.bounds)) {
        report('GPS đang ở ngoài gói Đà Nẵng. Chọn một mốc xuất phát bên dưới để khám phá.'); return;
      }
      chooseOrigin(point);
      flyTo(point);
      if (position.coords.accuracy > 100) setNotice(`GPS có sai số khoảng ${Math.round(position.coords.accuracy)} m. Bạn có thể chọn lại điểm trên bản đồ.`);
    }, () => {
      if (id !== gpsId.current) return;
      setGpsBusy(false); report('Không lấy được GPS. Chọn Cầu Rồng, Sân bay, Ga Đà Nẵng, Biển Mỹ Khê hoặc chạm bản đồ.');
    });
  };
  const startDirections = () => {
    cancelPendingRoute(); setDirectionsOpen(true); setSheetSize(1);
    if (!origin) requestGps();
  };
  const calculate = async () => {
    if (!data || !origin || !selected) return;
    setRoute(null); setRouteBusy(true); setRouteError('');
    const id = ++routeId.current;
    try {
      const result = await offlineService.calculateRoute(origin, selected, mode);
      if (id !== routeId.current) return;
      setRoute(result); setSheetSize(1);
    } catch (e) { if (id === routeId.current) setRouteError(e.message); }
    finally { if (id === routeId.current) setRouteBusy(false); }
  };
  const closeData = useCallback(() => setDataOpen(false), []);
  const closeAssistant = useCallback(() => setAssistantOpen(false), []);
  const readyLabel = data && pwa.ready ? 'Đà Nẵng sẵn sàng' : data ? 'Dữ liệu đã lưu' : status === 'installing' ? `Đang tải ${progress}%` : 'Chưa tải dữ liệu';

  return <main className={`offline-app ${assistantOpen ? 'has-assistant' : ''}`}>
    <div className="offline-map-workspace" aria-label="Không gian bản đồ">
    {data ? <OfflineMapCanvas key={data.pkg.installedAt} data={data} results={results} selected={selected} route={route} origin={origin} pickingOrigin={pickingOrigin}
      onSelect={selectPlace} onPickOrigin={chooseOrigin} onMove={setCenter} mapApiRef={mapApi} /> :
      <div className="offline-map-placeholder"><MapPin size={64} /><span>ĐÀ NẴNG</span><p>Thành phố trong tầm tay</p></div>}

    <div className="offline-topbar">
      <div className="offline-search-row">
        <Link to="/" className="offline-home-button" aria-label="Về trang chủ MapAI"><ArrowLeft size={24} /></Link>
        <div className="offline-search-box"><Search size={16} />
        <input aria-label="Tìm địa điểm Đà Nẵng" placeholder="Tìm địa điểm, địa chỉ..." value={query} maxLength={150}
          onChange={event => { setQuery(event.target.value); setSelected(null); setDirectionsOpen(false); cancelPendingRoute(); setSheetSize(1); }} />
        {query && <button aria-label="Xóa từ khóa" className="offline-icon-button" onClick={() => setQuery('')}><X size={17} /></button>}
        <button className="offline-ai-search-button" aria-label="Mở trợ lý AI" onClick={() => setAssistantOpen(true)} disabled={!data}><Sparkles size={19} /></button>
      </div><button className="offline-directions-shortcut" disabled={!data} onClick={() => {
        if (selected) startDirections();
        else { setNotice('Chọn một địa điểm trên bản đồ hoặc trong danh sách để chỉ đường.'); setSheetSize(1); }
      }}><Navigation size={14} />Chỉ đường</button></div>
      <div className="offline-filter-strip offline-category-strip" aria-label="Lọc theo loại hình">{CATEGORIES.map(c => <button key={c.id} className={`offline-chip ${category === c.id ? 'is-active' : ''}`} aria-pressed={category === c.id}
        onClick={() => { setCategory(c.id); setSelected(null); setDirectionsOpen(false); cancelPendingRoute(); setSheetSize(1); }}>
        {c.id === 'food' ? <Utensils size={14} /> : c.id === 'sightseeing' ? <Ticket size={14} /> : <MapPin size={14} />}{c.label}</button>)}
        <button className={`offline-chip ${query === 'ca phe' ? 'is-active' : ''}`} onClick={() => { setQuery('ca phe'); setCategory('food'); setSelected(null); setDirectionsOpen(false); cancelPendingRoute(); setSheetSize(1); }}><Coffee size={14} />Cà phê</button>
      </div>
      <div className="offline-filter-strip offline-district-strip" aria-label="Lọc theo khu vực">{DISTRICTS.map(d => <button key={d} className={`offline-chip ${district === d ? 'is-active' : ''}`} aria-pressed={district === d} onClick={() => { setDistrict(d); setSelected(null); setDirectionsOpen(false); cancelPendingRoute(); setSheetSize(1); }}>{d}</button>)}</div>
    </div>

    <div className="offline-map-tools"><button className="offline-icon-button" aria-label="Quản lý dữ liệu offline" onClick={() => setDataOpen(true)}><Database size={21} /></button>
      <button className="offline-icon-button" aria-label="Định vị GPS" onClick={requestGps} disabled={!data || gpsBusy}><LocateFixed size={21} /></button>
    </div>
    <div className="offline-context-bar">
      <button className={`offline-status-pill ${network.offline ? 'is-offline' : 'is-online'} ${!data ? 'is-missing' : ''}`} onClick={() => setDataOpen(true)}>
        {network.offline ? <WifiOff size={14} /> : <Wifi size={14} />}<span>{network.simulated ? 'Giả lập Offline' : network.offline ? 'Offline' : 'Online'}<span className="offline-status-detail"> • {readyLabel}</span></span><Database size={14} />
      </button>
      {!network.offline && <Link to="/map/online" className="offline-online-link">Bản đồ online <ArrowRight size={14} /></Link>}
    </div>
    {pickingOrigin && <div className="offline-pick-instruction" role="status"><MapPin size={18} />Chạm bản đồ để chọn điểm xuất phát<button onClick={() => { setPickingOrigin(false); setSheetSize(1); }}>Hủy</button></div>}
    {notice && <div className="offline-toast" role="status">{notice}<button aria-label="Đóng thông báo" onClick={() => setNotice('')}><X size={16} /></button></div>}

    <AdaptiveBottomSheet size={sheetSize} onSizeChange={setSheetSize} title={selected ? 'Chi tiết địa điểm' : 'Kết quả khám phá'} variant={selected ? directionsOpen ? 'route' : 'details' : 'results'}>
      {!data ? <div className="offline-empty-state"><Database size={30} /><h2>{status === 'installing' ? 'Đang chuẩn bị Đà Nẵng' : 'Tải một lần, khám phá mọi lúc'}</h2>
        <p>{network.offline ? 'Thiết bị chưa có gói offline. Hãy kết nối mạng, tắt giả lập và tải gói Đà Nẵng trước khi đi.' : 'Gói gồm bản đồ vector, địa điểm, ảnh minh họa và dữ liệu đường bộ. Không cần tài khoản.'}</p>
        {status === 'installing' && <progress value={progress} max="100" aria-label="Tiến độ tải gói dữ liệu" />}
        {error && <p className="offline-error" role="alert">{error}</p>}
        <button className="offline-button primary" onClick={() => setDataOpen(true)}><Database size={16} />Quản lý gói dữ liệu</button>
      </div> : selected ? <>
        <button className="offline-back-button" onClick={() => { setSelected(null); setDirectionsOpen(false); setPickingOrigin(false); gpsId.current++; setGpsBusy(false); cancelPendingRoute(); }}><ArrowLeft size={16} />Danh sách địa điểm</button>
        <div className="offline-sheet-scroll">
          {directionsOpen ? <OfflineRoutePanel destination={selected} origin={origin} mode={mode} onMode={value => { setMode(value); cancelPendingRoute(); }} onOrigin={chooseOrigin} onGps={requestGps}
            onMapPick={() => { gpsId.current++; setGpsBusy(false); setPickingOrigin(true); setSheetSize(0); }} onCalculate={calculate} route={route} busy={routeBusy} gpsBusy={gpsBusy} error={routeError}
            onCancel={() => { setDirectionsOpen(false); setPickingOrigin(false); gpsId.current++; setGpsBusy(false); cancelPendingRoute(); }} /> :
            <div className="offline-place-detail"><PlaceImage place={selected} large /><div className="offline-detail-heading"><div><span className={`offline-category category-${selected.category}`}>{categoryLabel(selected.category)} · {selected.district}</span><h1>{selected.name}</h1></div>
              <button className={`offline-icon-button ${personal.favorites.has(selected.id) ? 'is-saved' : ''}`} aria-label={personal.favorites.has(selected.id) ? 'Bỏ lưu địa điểm' : 'Lưu yêu thích offline'} aria-pressed={personal.favorites.has(selected.id)} onClick={() => saveFavorite(selected.id)}><Heart size={23} fill={personal.favorites.has(selected.id) ? 'currentColor' : 'none'} /></button></div>
              <p className="offline-detail-address"><MapPin size={15} />{selected.address}</p><p>{selected.description}</p>
              <dl className="offline-place-facts"><div><dt><Clock3 size={15} />Giờ mở cửa</dt><dd>{selected.hours}</dd></div><div><dt>Khoảng giá</dt><dd>{selected.price}</dd></div></dl>
              <p className="offline-note">Thông tin trong gói tham khảo; chưa xác nhận thay đổi thực tế. Yêu thích được lưu trên thiết bị và dùng được khi mất mạng.</p>
            </div>}
        </div>
        {!directionsOpen && <div className="offline-detail-actions"><button className="offline-button secondary" onClick={() => { flyTo(selected); setSheetSize(0); }}><MapPin size={16} />Xem trên bản đồ</button><button className="offline-button accent" onClick={startDirections}><Navigation size={16} />Chỉ đường tới đây</button></div>}
      </> : <>
        <div className="offline-results-header"><div><span className="offline-eyebrow">KHÁM PHÁ THEO CÁCH CỦA BẠN</span><h1>{results.length} địa điểm {collection === 'favorites' ? 'đã lưu' : collection === 'history' ? 'đã xem' : 'đang chờ bạn'}</h1></div><button className="offline-assistant-quick" aria-label="Hỏi trợ lý AI" onClick={() => setAssistantOpen(true)}><Sparkles size={21} /></button></div>
        <div className="offline-collection-tabs" aria-label="Bộ sưu tập">{[{ id: 'all', text: 'Khám phá', icon: MapPin }, { id: 'favorites', text: `Đã lưu (${personal.favorites.size})`, icon: Heart }, { id: 'history', text: 'Gần đây', icon: Clock3 }].map(tab => <button className={collection === tab.id ? 'is-active' : ''} key={tab.id} aria-pressed={collection === tab.id} onClick={() => { setCollection(tab.id); setSheetSize(1); }}><tab.icon size={14} />{tab.text}</button>)}</div>
        <div className="offline-sheet-scroll">
          <p className="offline-results-caption">Khoảng cách ước tính theo đường chim bay từ tâm bản đồ.</p>
          {results.length ? results.map(place => <PlaceCard key={place.id} place={place} favorite={personal.favorites.has(place.id)} onSelect={selectPlace} onFavorite={saveFavorite} />) :
            <div className="offline-empty-state"><Search size={28} /><h2>{collection === 'favorites' ? 'Chưa có địa điểm yêu thích phù hợp' : collection === 'history' ? 'Chưa có địa điểm đã xem phù hợp' : 'Chưa có kết quả trong gói Đà Nẵng'}</h2>
              <p>Thử từ khóa khác hoặc mở rộng khu vực. Gói cục bộ chỉ có một số địa điểm tuyển chọn.</p>
              <button className="offline-button primary" onClick={clearFilters}>Xóa bộ lọc · Mở rộng toàn thành phố</button><button className="offline-text-button" onClick={() => setAssistantOpen(true)}>Hỏi trợ lý gợi ý thay thế</button>
            </div>}
        </div>
      </>}
    </AdaptiveBottomSheet>
    </div>
    <button className="offline-chat-toggle" aria-label={assistantOpen ? 'Ẩn trợ lý AI' : 'Hiện trợ lý AI'} aria-expanded={assistantOpen}
      aria-controls={!compact && assistantOpen ? 'offline-assistant' : undefined} onClick={() => setAssistantOpen(open => !open)}>
      {assistantOpen ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
    </button>
    <OfflineAssistant places={data?.places || []} origin={origin} onSelect={selectPlace} onClose={closeAssistant} open={assistantOpen} available={Boolean(data)} />
    {dataOpen && <OfflineDataModal resource={resource} onClose={closeData} />}
  </main>;
}
