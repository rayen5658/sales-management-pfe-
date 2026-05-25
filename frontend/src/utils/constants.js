export const API_ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  COMMERCIAL: 'commercial',
};

export const ORDER_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
};

export const CLIENT_TYPES = {
  INDIVIDUAL: 'particulier',
  BUSINESS: 'entreprise',
};

export const PAYMENT_METHODS = {
  CASH: 'cash',
  CARD: 'card',
  CHECK: 'check',
  TRANSFER: 'transfer',
};

export const ERROR_MESSAGES = {
  INVALID_EMAIL: 'Invalid email address',
  INVALID_PASSWORD: 'Password must be at least 6 characters',
  INVALID_PHONE: 'Invalid phone number',
  INVALID_PRICE: 'Price must be a positive number',
  INVALID_QUANTITY: 'Quantity must be a positive number',
  REQUIRED_FIELD: 'This field is required',
  NETWORK_ERROR: 'Server connection error',
  UNAUTHORIZED: 'Unauthorized access',
  NOT_FOUND: 'Resource not found',
  SERVER_ERROR: 'Server error',
};

export const SUCCESS_MESSAGES = {
  LOGIN_SUCCESS: 'Login successful',
  REGISTER_SUCCESS: 'Registration successful',
  CREATE_SUCCESS: 'Creation successful',
  UPDATE_SUCCESS: 'Update successful',
  DELETE_SUCCESS: 'Deletion successful',
};

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  DEFAULT_SORT: 'createdAt',
};

export const DATE_FORMAT = 'DD/MM/YYYY';
export const DATE_TIME_FORMAT = 'DD/MM/YYYY HH:mm:ss';

export const CURRENCY = {
  SYMBOL: 'TND',
  DECIMAL_PLACES: 2,
};
