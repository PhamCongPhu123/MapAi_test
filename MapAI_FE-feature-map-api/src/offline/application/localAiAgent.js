import { normalize, distanceMeters, createSearchEngine } from './searchEngine.js';
import { LANDMARKS, CENTER } from './constants.js';

const AREAS = [
  { phrases: ['cau rong'], district: null, center: LANDMARKS[0], label: 'Cầu Rồng' },
  { phrases: ['my khe'], district: null, center: LANDMARKS[3], label: 'Biển Mỹ Khê' },
  { phrases: ['song han'], district: 'Hải Châu', center: { lng: 108.225, lat: 16.07 }, label: 'sông Hàn' },
  { phrases: ['hai chau', 'trung tam'], district: 'Hải Châu', label: 'Hải Châu' },
  { phrases: ['son tra'], district: 'Sơn Trà', label: 'Sơn Trà' },
  { phrases: ['ngu hanh son', 'non nuoc'], district: 'Ngũ Hành Sơn', label: 'Ngũ Hành Sơn' },
  { phrases: ['cam le', 'hoa xuan'], district: 'Cẩm Lệ', label: 'Cẩm Lệ' },
  { phrases: ['toan thanh pho', 'da nang'], label: 'Đà Nẵng' },
];
export const AREA_CHOICES = ['Quanh Cầu Rồng', 'Biển Mỹ Khê', 'Trung tâm Hải Châu', 'Toàn thành phố'];
export const PROMPTS = ['Tìm quán ăn tối ngon', 'Cà phê gần sông Hàn', 'Vui chơi buổi chiều ở Sơn Trà'];

export function askLocalAssistant(input, places, context = {}) {
  const text = normalize(input);
  if (!text) return { message: 'Bạn muốn khám phá điều gì ở Đà Nẵng?', places: [] };
  if (/\b(hue|ha noi|sai gon|ho chi minh|hoi an|nha trang|da lat)\b/.test(text)) {
    return { message: 'Gói cục bộ hiện chỉ có dữ liệu Đà Nẵng. Bạn có thể thử một khu vực trong thành phố.', places: [], choices: AREA_CHOICES, context: {} };
  }
  const currentArea = AREAS.find(a => a.phrases.some(p => text.includes(p)));
  const combined = context.pending && AREA_CHOICES.some(choice => normalize(choice) === text) ? `${context.pending} ${text}` : text;
  let area = currentArea;
  if (!area && /\b(gan day|quanh day)\b/.test(text) && context.origin) area = { center: context.origin, label: 'vị trí đã chọn' };
  const has = (...terms) => terms.some(t => combined.includes(t));
  const cafe = has('ca phe', 'cafe', 'coffee');
  const food = cafe || /\ban\b/.test(combined) || has('quan an', 'dac san', 'mi quang', 'my quang', 'banh', 'bun', 'hai san', 'mon');
  const fun = has('vui choi', 'giai tri', 'mua sam', 'cho dem');
  const sightseeing = has('tham quan', 'bao tang', 'bien', 'check in', 'di dao', 'cong vien');
  const category = food ? 'food' : fun ? 'entertainment' : sightseeing ? 'sightseeing' : null;
  if (!area) return { message: 'Bạn muốn tìm ở khu vực nào? Chọn một nơi để tôi gợi ý trong dữ liệu đã tải.',
    places: [], choices: AREA_CHOICES, context: { pending: combined } };
  let candidates = places.filter(p => !area.district || p.district === area.district);
  if (!category && !has('goi y', 'kham pha', 'dia diem', 'di dau', 'toan thanh pho')) {
    let namedQuery = combined;
    for (const a of AREAS) for (const phrase of a.phrases) namedQuery = namedQuery.replaceAll(phrase, '');
    namedQuery = namedQuery.replace(/\b(tim|xem|gan|quanh|tai|cho|minh|toi|o|di)\b/g, '').trim();
    if (namedQuery) {
      const matches = new Set(createSearchEngine(places)({ query: namedQuery }).map(p => p.id));
      candidates = candidates.filter(p => matches.has(p.id));
    } else if (currentArea?.center?.id) candidates = candidates.filter(p => p.id === currentArea.center.id);
  }
  if (category) candidates = candidates.filter(p => p.category === category);
  if (cafe) candidates = candidates.filter(p => p.tags.some(t => ['ca phe', 'cafe', 'coffee'].includes(t)));
  else if (food) candidates = candidates.filter(p => !p.tags.includes('ca phe'));
  const specific = ['mi quang', 'my quang', 'banh xeo', 'banh mi', 'banh trang', 'hai san', 'bun cha ca', 'banh cuon', 'bun bo', 'com ga', 'sushi', 'pizza', 'chay', 'vegan'].find(t => combined.includes(t));
  if (specific) candidates = candidates.filter(p => normalize(p.tags.join(' ')).includes(specific));
  const anchor = area.center || CENTER;
  if (area.center) candidates = candidates.filter(p => distanceMeters(anchor, p) < 4500);
  const words = combined.split(' ').filter(w => w.length > 2);
  candidates = candidates.map(p => ({ ...p, distance: distanceMeters(anchor, p),
    relevance: words.filter(w => normalize(`${p.name} ${p.tags.join(' ')}`).includes(w)).length }))
    .sort((a, b) => b.relevance - a.relevance || a.distance - b.distance).slice(0, 3);
  if (!candidates.length) return { message: `Chưa có địa điểm phù hợp quanh ${area.label} trong gói này. Hãy mở rộng toàn thành phố hoặc đổi nhu cầu.`,
    places: [], choices: AREA_CHOICES, context: { pending: combined } };
  return { message: `Tôi gợi ý ${candidates.length} địa điểm quanh ${area.label} từ dữ liệu đã tải. Giờ mở cửa và giá chỉ để tham khảo, chưa được xác nhận trực tiếp.`,
    places: candidates, context: {} };
}
