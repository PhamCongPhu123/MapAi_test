import { request } from './api';

/**
 * LocationService - Quản lý danh sách và chi tiết các địa điểm từ database
 */

/**
 * 1. Lấy danh sách tất cả các địa điểm
 * @returns {Promise<Array>} Danh sách địa điểm
 */
export const getAllLocations = async () => {
  try {
    const response = await request('/location');
    
    if (!response.ok) {
      throw new Error(`Error fetching locations: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Mapping dữ liệu từ Backend sang format FE đang dùng
    return data.map(loc => ({
      ...loc, // Keep original fields for admin/detail use
      id: loc.id,
      name: loc.title,
      address: loc.address,
      lat: loc.latitude,
      lng: loc.longitude,
      image: loc.thumbnail,
      rating: loc.rating,
      type: loc.category,
      phone: loc.phoneNumber,
      tags: typeof loc.tags === 'string' 
        ? loc.tags.replace(/[{}]/g, '').split(',') 
        : (Array.isArray(loc.tags) ? loc.tags : []),
      distance: "Đang tính...",
      isFeatured: loc.rating >= 4.7
    }));
  } catch (error) {
    console.error("Error in getAllLocations:", error);
    return [];
  }
};

/**
 * 3. Tìm kiếm chi tiết một địa điểm dựa trên tên gọi và vị trí địa lý (Tọa độ)
 * @param {string} title - Tên địa điểm
 * @param {Array} coordinates - [lng, lat]
 * @returns {Promise<Object>} Chi tiết địa điểm duy nhất phù hợp nhất
 */
export const searchLocation = async (title, coordinates) => {
  try {
    const [lng, lat] = coordinates;
    console.log(`Searching for location: ${title} at coordinates: [${lat}, ${lng}]`);
    const response = await request(`/location/search?title=${encodeURIComponent(title)}&lat=${lat}&lng=${lng}`);
    
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Error searching location: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Mapping dữ liệu trả về sang format UI đang dùng
    return {
      ...data,
      name: data.title,
      lat: data.latitude,
      lng: data.longitude,
      image: data.thumbnail,
      reviews: data.totalReviews,
      type: data.category,
      phone: data.phoneNumber,
      // Map tags từ string sang array nếu cần
      tags: typeof data.tags === 'string' 
        ? data.tags.replace(/[{}]/g, '').split(',') 
        : (Array.isArray(data.tags) ? data.tags : [])
    };
  } catch (error) {
    console.error(`Error in searchLocation for ${title}:`, error);
    return null;
  }
};
