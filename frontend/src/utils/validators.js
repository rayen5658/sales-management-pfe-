// Email validation
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Password validation (min 6 chars)
export const isValidPassword = (password) => password.length >= 6;

// Phone validation — supports Tunisian 8-digit numbers and international formats
export const isValidPhone = (phone) => {
  const phoneRegex = /^\+?[0-9]{8,15}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
};

// Price validation (positive number)
export const isValidPrice = (price) => {
  const priceNum = parseFloat(price);
  return !isNaN(priceNum) && priceNum > 0;
};

// Quantity validation (positive integer)
export const isValidQuantity = (quantity) => {
  const qty = parseInt(quantity, 10);
  return !isNaN(qty) && qty > 0;
};

// URL validation
export const isValidURL = (url) => {
  try {
    new URL(url);
    return true;
  } catch (_) {
    return false;
  }
};

// UUID validation
export const isValidUUID = (uuid) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

// Validate form data
export const validateFormData = (data, rules) => {
  const errors = {};

  Object.keys(rules).forEach(field => {
    const rule = rules[field];
    const value = data[field];

    if (rule.required && (!value || value.toString().trim() === '')) {
      errors[field] = `${rule.label || field} is required`;
    } else if (value && rule.validate) {
      const isValid = rule.validate(value);
      if (!isValid) {
        errors[field] = rule.message || 'Invalid value';
      }
    }
  });

  return errors;
};

// Sanitize input
export const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  return input.trim().replace(/[<>]/g, '');
};
