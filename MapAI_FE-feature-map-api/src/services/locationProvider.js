import { toLngLat } from '../utils/mapCoordinates.js';

function failure(code) {
  return Object.assign(new Error(code), { code });
}

// Separate platform adapters so browser failures cannot invoke native permission APIs.
export async function requestCurrentLocation({ native, plugin, browser, secureContext }) {
  let precise = true;
  let request;
  if (native) {
    let permission = await plugin.checkPermissions();
    if (permission.location !== 'granted' && permission.coarseLocation !== 'granted') {
      permission = await plugin.requestPermissions({ permissions: ['location'] });
    }
    if (permission.location !== 'granted' && permission.coarseLocation !== 'granted') throw failure('OS-PLUG-GLOC-0003');
    precise = permission.location === 'granted';
    request = options => plugin.getCurrentPosition(options);
  } else {
    if (secureContext === false) throw failure('INSECURE_CONTEXT');
    if (!browser?.geolocation) throw failure('GEOLOCATION_UNSUPPORTED');
    request = options => new Promise((resolve, reject) => browser.geolocation.getCurrentPosition(resolve, reject, options));
  }
  const validPosition = position => {
    if (!toLngLat(position?.coords)) throw failure('INVALID_POSITION');
    return position;
  };
  try {
    return validPosition(await request({ enableHighAccuracy: precise, timeout: 15000, maximumAge: 0 }));
  } catch (error) {
    // Desktop Wi-Fi/network location may succeed when a high-accuracy fix times out.
    // Never retry denied permission, disabled services, or use a guessed/cached position.
    if (!precise || ![2, 3, 'OS-PLUG-GLOC-0010'].includes(error?.code)) throw error;
    return validPosition(await request({ enableHighAccuracy: false, timeout: 15000, maximumAge: 0 }));
  }
}
