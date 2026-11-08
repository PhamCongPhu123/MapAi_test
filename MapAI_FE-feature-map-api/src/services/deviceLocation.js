import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

export async function getDeviceLocation() {
  if (Capacitor.isNativePlatform()) {
    let permissions = await Geolocation.checkPermissions();
    if (permissions.location !== 'granted' && permissions.coarseLocation !== 'granted') {
      permissions = await Geolocation.requestPermissions({ permissions: ['location'] });
    }
    // Android 12+ may grant approximate location only. That is enough to show a marker.
    if (permissions.location !== 'granted' && permissions.coarseLocation !== 'granted') {
      const error = new Error('Location permission denied');
      error.code = 'OS-PLUG-GLOC-0003';
      throw error;
    }
  }
  return Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
}

export function locationErrorMessage(error) {
  if (error?.code === 1 || error?.code === 'OS-PLUG-GLOC-0003') {
    return 'Bạn chưa cho phép truy cập vị trí. Hãy cấp quyền trong Cài đặt hoặc tự nhập điểm xuất phát.';
  }
  if (error?.code === 3 || error?.code === 'OS-PLUG-GLOC-0010') {
    return 'Định vị quá thời gian chờ. Hãy thử lại ở nơi có tín hiệu GPS tốt hơn.';
  }
  if (error?.code === 'OS-PLUG-GLOC-0007' || error?.code === 'OS-PLUG-GLOC-0009') {
    return 'Dịch vụ vị trí đang tắt. Hãy bật vị trí/GPS trên thiết bị.';
  }
  return 'Không thể lấy vị trí. Hãy kiểm tra GPS hoặc tự nhập điểm xuất phát.';
}
