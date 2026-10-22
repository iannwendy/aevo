const crypto = require('crypto');

// Generate unique order number using CSPRNG entropy
function generateOrderNumber() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `AEVO-${timestamp}${random}`;
}

// Format price to VND
function formatPrice(amount) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount);
}

// Generate slug from string
function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .trim();
}

module.exports = {
  generateOrderNumber,
  formatPrice,
  slugify,
};
