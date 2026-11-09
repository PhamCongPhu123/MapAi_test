import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { requestCurrentLocation } from './locationProvider.js';

export async function getDeviceLocation() {
  return requestCurrentLocation({ native: Capacitor.isNativePlatform(), plugin: Geolocation,
    browser: globalThis.navigator, secureContext: globalThis.isSecureContext });
}

export function locationErrorMessage(error) {
  if (error?.code === 'INSECURE_CONTEXT') {
    return 'Trình duyệt chỉ cho định vị trên HTTPS hoặc localhost. Hãy mở website bằng HTTPS; địa chỉ IP Wi-Fi qua HTTP không hỗ trợ định vị.';
  }
  if (error?.code === 'GEOLOCATION_UNSUPPORTED') return 'Trình duyệt này không hỗ trợ định vị. Hãy dùng trình duyệt khác hoặc tự nhập điểm xuất phát.';
  if (error?.code === 1 || error?.code === 'OS-PLUG-GLOC-0003') {
    return 'Bạn chưa cho phép truy cập vị trí. Hãy cấp quyền vị trí cho trình duyệt/ứng dụng trong Cài đặt rồi thử lại, hoặc tự nhập điểm xuất phát.';
  }
  if (error?.code === 2) return 'Không xác định được vị trí. Hãy bật Dịch vụ vị trí trên Windows/thiết bị, kiểm tra kết nối mạng rồi thử lại, hoặc tự nhập điểm xuất phát.';
  if (error?.code === 3 || error?.code === 'OS-PLUG-GLOC-0010') {
    return 'Định vị quá thời gian chờ. Hãy thử lại ở nơi có tín hiệu GPS tốt hơn.';
  }
  if (error?.code === 'OS-PLUG-GLOC-0007' || error?.code === 'OS-PLUG-GLOC-0009') {
    return 'Dịch vụ vị trí đang tắt. Hãy bật vị trí/GPS trên thiết bị.';
  }
  return 'Không thể lấy vị trí. Hãy kiểm tra GPS hoặc tự nhập điểm xuất phát.';
}
