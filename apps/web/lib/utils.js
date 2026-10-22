import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatPrice(amount) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount);
}

export function generateOrderNumber() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `AEVO-${timestamp}${random}`;
}

export function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .trim();
}

export const FALLBACK_PRODUCT_IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600" fill="none">' +
      '<rect width="800" height="600" fill="#FFFFFF"/>' +
      '<rect x="160" y="130" width="480" height="300" rx="20" fill="#F5F5F3" stroke="#171717" stroke-width="6"/>' +
      '<rect x="190" y="160" width="420" height="240" rx="10" fill="#FFFFFF" stroke="#E5E5E3" stroke-width="3"/>' +
      '<path d="M110 445H690L650 475H150L110 445Z" fill="#171717"/>' +
      '<text x="400" y="290" text-anchor="middle" fill="#171717" font-family="system-ui, sans-serif" font-size="28" font-weight="600" letter-spacing="4">AEVO STUDIO</text>' +
    '</svg>'
  );

export function handleImageError(event) {
  const img = event?.currentTarget || event?.target;
  if (img && img.src !== FALLBACK_PRODUCT_IMAGE) {
    img.src = FALLBACK_PRODUCT_IMAGE;
  }
}
