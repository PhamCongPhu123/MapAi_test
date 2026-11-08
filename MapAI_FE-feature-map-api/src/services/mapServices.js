import { request } from './api';

/**
 * MapServices - Gộp các dịch vụ liên quan đến bản đồ (OSM và Foursquare)
 * Sử dụng Backend MapAI làm Proxy/Wrapper
 */

/**
 * 1. Tìm kiếm địa điểm chung (OSM Nominatim qua Backend)
 * @param {string} query - Tên địa điểm cần tìm
 */
export const searchLocations = async (query) => {
  try {
    const response = await request(`/map/search?q=${encodeURIComponent(query)}`);
    
    if (!response.ok) {
      throw new Error(`Search error: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (err) {
    console.error("Error searching through backend:", err);
    return [];
  }
};

/**
 * 2. Tìm kiếm địa điểm lân cận (Qua Backend /map/nearby)
 * @param {number} lat - Vĩ độ
 * @param {number} lng - Kinh độ
 * @param {string} query - Từ khóa (VD: cafe, hospital)
 * @param {number} radius - Bán kính (mét)
 */
export const searchNearbyPlaces = async (lat, lng, query = '', radius = 1000) => {
  try {
    const params = new URLSearchParams({
      lat: lat,
      lng: lng,
      query: query,
      radius: radius
    });

    const response = await request(`/map/nearby?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Nearby search error: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (err) {
    console.error("Error searching nearby through backend:", err);
    return [];
  }
};

/**
 * 2c. Tìm kiếm địa điểm toàn thành phố (OSM ưu tiên, Foursquare dự phòng)
 * @param {string} query - Từ khóa tìm kiếm (VD: coffee, restaurant)
 */
export const searchCityWidePlaces = async (query = '') => {
  try {
    const params = new URLSearchParams();
    if (query) params.append('query', query);

    console.log('--- FE sending to BE (/map/city-wide) ---');
    const response = await request(`/map/city-wide?${params.toString()}`, {
      method: 'GET'
    });

    if (!response.ok) {
      throw new Error(`Backend API error: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('--- City-wide response received ---', data.length);
    return data;
  } catch (error) {
    console.error('Error fetching city-wide places:', error);
    return [];
  }
};

/**
 * 3. Lấy dữ liệu tuyến đường (OSRM qua Backend)
 * @param {Object} origin - {lat, lng}
 * @param {Object} destination - {lat, lng}
 * @param {string} mode - 'driving', 'bicycle', 'foot'
 */
export const fetchRoute = async (origin, destination, mode = 'driving') => {
  try {
    const response = await request('/map/direction', {
      method: 'POST',
      body: JSON.stringify({
        startLat: origin.lat,
        startLng: origin.lng,
        endLat: destination.lat,
        endLng: destination.lng,
        mode: mode
      })
    });
    
    // Kiểm tra lỗi TRƯỚC khi parse JSON
    if (!response.ok) {
      let errorMsg = 'Không tìm thấy tuyến đường.';
      const clone = response.clone(); // Clone để tránh 'body stream already read'
      try {
        const errorData = await clone.json();
        errorMsg = errorData.message || errorMsg;
      } catch (e) {
        const text = await response.text();
        errorMsg = text || errorMsg;
      }
      throw new Error(errorMsg);
    }
    
    // Nếu OK thì mới parse dữ liệu
    return await response.json();
  } catch (error) {
    console.error("Error fetching route from backend:", error);
    throw error;
  }
};
