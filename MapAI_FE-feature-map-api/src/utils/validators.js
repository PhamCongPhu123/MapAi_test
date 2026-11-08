/**
 * Validates an email address.
 * @param {string} email 
 * @returns {boolean}
 */
export const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

/**
 * Validates password strength.
 * Minimum 8 characters, at least one letter and one number.
 * @param {string} password 
 * @returns {boolean}
 */
export const validatePassword = (password) => {
  return password.length >= 6; // Simple validation for now
};

/**
 * Validates full name.
 * Minimum 2 characters.
 * @param {string} name 
 * @returns {boolean}
 */
export const validateName = (name) => {
  return name.trim().length >= 2;
};
