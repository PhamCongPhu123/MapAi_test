import { request } from './api';

/**
 * Admin API Service
 */
export const adminApi = {
  /**
   * Get list of users
   * GET /api/v1/admin/users
   */
  getUsers: async () => {
    const response = await request('/admin/users');
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to fetch users');
    }
    return await response.json();
  },

  /**
   * Delete a user
   * DELETE /api/v1/admin/users/{userId}
   */
  deleteUser: async (userId) => {
    const response = await request(`/admin/users/${userId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to delete user');
    }
    return true;
  },

  /**
   * Lock/Unlock user account
   * PATCH /api/v1/admin/users/{userId}/toggle-status
   */
  toggleUserStatus: async (userId) => {
    const response = await request(`/admin/users/${userId}/toggle-status`, {
      method: 'PATCH',
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to toggle user status');
    }
    return await response.json();
  },

  /**
   * Change user role
   * PATCH /api/v1/admin/users/{userId}/role?role={role}
   * @param {string} userId
   * @param {number} role 0: Admin, 1: User
   */
  changeUserRole: async (userId, role) => {
    const response = await request(`/admin/users/${userId}/role?role=${role}`, {
      method: 'PATCH',
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to change user role');
    }
    return await response.json();
  },

  /**
   * Get dashboard statistics
   */
  getDashboardStats: async () => {
    const response = await request('/admin/stats');
    if (!response.ok) return { totalUsers: 0, totalLocations: 0, activeUsers: 0 };
    return await response.json();
  },

  /**
   * Location Management APIs
   */

  /**
   * Upload image for location
   * POST /api/v1/location/upload-thumbnail
   */
  uploadLocationImage: async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'https://localhost:7028/api/v1'}/location/upload-thumbnail`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
      },
      body: formData
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to upload image');
    }
    return await response.json();
  },

  /**
   * Create new location
   * POST /api/v1/location
   */
  createLocation: async (locationData) => {
    const response = await request('/location', {
      method: 'POST',
      body: JSON.stringify(locationData)
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to create location');
    }
    return await response.json();
  },

  /**
   * Update existing location
   * PUT /api/v1/location/{id}
   */
  updateLocation: async (id, locationData) => {
    const response = await request(`/location/${id}`, {
      method: 'PUT',
      body: JSON.stringify(locationData)
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to update location');
    }
    return await response.json();
  },

  /**
   * Delete location
   * DELETE /api/v1/location/{id}
   */
  deleteLocation: async (id) => {
    const response = await request(`/location/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to delete location');
    }
    return true;
  }
};
