export const voiceLanguage = value => value === 'en-US' ? 'en-US' : 'vi-VN';
export function speechText(value, language = 'vi-VN') {
  const en = language === 'en-US';
  let text = String(value || '').replace(/```[\s\S]*?```/g, ' ').replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/https?:\/\/\S+/g, ' ')
    .replace(/-?\d{1,3}\.\d{4,}\s*[,;]\s*-?\d{1,3}\.\d{4,}/g, ' ')
    .replace(/[*#`_~>|]/g, '').replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, ' ')
    .replace(/^\s*[-+]\s+/gm, '').replace(/\bOSM\b/g, en ? 'OpenStreetMap' : 'bản đồ mở')
    .replace(/\b(\d+(?:[.,]\d+)?)\s*km\b/gi, (_, n) => `${n.replace(',', '.').replace('.', en ? ' point ' : ' phẩy ')} ${en ? 'kilometers' : 'ki lô mét'}`)
    .replace(/\b(\d+)\s*k\b/gi, en ? '$1 thousand dong' : '$1 nghìn đồng')
    .replace(/\s+/g, ' ').trim();
  text = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.slice(0, 3).join(' ').trim() || text;
  if (text.length > 480) text = text.slice(0, 480).replace(/\s+\S*$/, '') + (en ? '. Read the chat for details.' : '. Xem thêm trong khung chat.');
  return text;
}
export const voiceMessages = {
  'vi-VN': {
    permission: 'Micro đang bị chặn. Hãy cho phép quyền micro trong cài đặt trình duyệt hoặc ứng dụng rồi thử lại.',
    unsupported: 'Thiết bị hoặc trình duyệt chưa hỗ trợ nhận giọng nói. Bạn có thể nhập câu hỏi bằng bàn phím.',
    insecure: 'Micro cần HTTPS hoặc localhost. Hãy mở địa chỉ HTTPS của ứng dụng.',
    offline: 'Nhận dạng giọng nói offline chưa khả dụng cho ngôn ngữ này. Bạn vẫn có thể nhập để tìm kiếm và chỉ đường từ dữ liệu đã tải.',
    noSpeech: 'Chưa nghe rõ. Bạn chạm micro để nói lại hoặc nhập bằng bàn phím nhé.',
    network: 'Dịch vụ nhận giọng nói chưa kết nối được. Bạn có thể nhập câu hỏi để tiếp tục.',
    voiceMissing: 'Chưa có giọng đọc phù hợp. Hãy tải giọng tiếng Việt trong cài đặt chuyển văn bản thành giọng nói của thiết bị.',
    playback: 'Chưa phát được âm thanh. Bạn có thể nhấn Nghe lại hoặc đọc câu trả lời trong chat.',
  },
  'en-US': {
    permission: 'Microphone access is blocked. Allow it in browser or app settings, then try again.',
    unsupported: 'Speech recognition is unavailable on this device or browser. You can type your question.',
    insecure: 'Microphone access requires HTTPS or localhost. Open the HTTPS address of this app.',
    offline: 'Offline speech recognition is unavailable for this language. Type to search downloaded places and get offline directions.',
    noSpeech: 'I could not hear clearly. Tap the microphone to try again, or type your question.',
    network: 'The speech recognition service could not connect. You can type to continue.',
    voiceMissing: 'A matching voice is unavailable. Install an English voice in your device text-to-speech settings.',
    playback: 'Audio could not play. Tap Replay or read the response in the chat.',
  },
};
