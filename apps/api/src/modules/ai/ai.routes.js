const express = require('express');
const router = express.Router();
const {
  analyzeReviewSentiment,
  computeSentimentSummary,
} = require('../../utils/sentiment');
const {
  searchProductsWithElasticsearch,
  ensureIndexSynced,
} = require('../../utils/elasticsearch');
const prisma = require('../../utils/prisma');
const { rateLimit } = require('../../middleware/rateLimit');
const { optionalAuth } = require('../../middleware/auth');

const aiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many AI assistant requests, please try again later',
});

const CATEGORY_HINTS = [
  {
    slug: 'laptops',
    labelEn: 'Laptops & Ultrabooks',
    labelVi: 'Laptop & Máy tính xách tay',
    keywords: [
      'laptop', 'macbook', 'ultrabook', 'notebook', 'thinkpad', 'zenbook', 'xps', 'rog zephyrus', 'zephyrus', 'spectre', 'probook', 'surface',
      'máy tính xách tay', 'máy tính', 'laptop gaming', 'laptop văn phòng', 'laptop đồ họa', 'laptop lập trình', 'macbook pro', 'macbook air', 'macbook neo',
    ],
    visualLabels: ['Clamshell Laptop Chassis', '16:10 Retina/OLED Display', 'Backlit Keyboard Deck'],
  },
  {
    slug: 'monitors',
    labelEn: 'Studio & Gaming Monitors',
    labelVi: 'Màn hình máy tính',
    keywords: [
      'monitor', 'display', 'screen', 'ultrawide', 'oled', '4k', '5k', '6k', '144hz', '240hz', 'ips', 'odyssey', 'ultrasharp', 'proart', 'studio display', 'pro display',
      'màn hình', 'màn hình rời', 'màn hình đồ họa', 'màn hình gaming', 'màn hình 4k', 'màn hình 5k',
    ],
    visualLabels: ['Ultra-Thin Bezel Display', 'Ergonomic Monitor Stand', 'Wide Color Gamut Panel'],
  },
  {
    slug: 'components',
    labelEn: 'PC Components & Desktops (GPU, CPU, RAM, Mac Studio)',
    labelVi: 'Linh kiện PC & Máy bàn (Card đồ họa, CPU, RAM, Mac Studio)',
    keywords: [
      'gpu', 'rtx', 'radeon', 'graphics card', 'video card', 'cpu', 'processor', 'ryzen', 'intel', 'core i7', 'core i9', 'ultra 9',
      'motherboard', 'mainboard', 'ram', 'ddr5', 'memory', 'psu', 'power supply', 'cooler', 'noctua', 'fan', 'aio', 'component',
      'mac studio', 'mac mini', 'imac', 'mac pro', 'desktop', 'máy bàn',
      'linh kiện', 'card màn hình', 'card đồ họa', 'vi xử lý', 'bo mạch chủ', 'tản nhiệt', 'nguồn máy tính', 'nâng cấp pc',
    ],
    visualLabels: ['PCIe Hardware Component', 'Heatsink & Thermal Fins', 'Anodized PCB Shroud'],
  },
  {
    slug: 'storage',
    labelEn: 'NVMe SSDs & High-Speed Storage',
    labelVi: 'Ổ cứng SSD NVMe & Lưu trữ',
    keywords: [
      'ssd', 'nvme', 'm.2', 'pcie 4.0', 'pcie 5.0', 'hard drive', 'hdd', 'storage', 'portable ssd', '990 pro', 'wd black', 'crucial', 'seagate', 'sandisk',
      'ổ cứng', 'lưu trữ', 'ổ cứng di động', 'nâng cấp ssd', 'dung lượng',
    ],
    visualLabels: ['M.2 NVMe Form Factor', 'Aluminum Thermal Spreader', 'High-Speed Flash Storage'],
  },
  {
    slug: 'peripherals',
    labelEn: 'Keyboards, Mice & Audio Peripherals',
    labelVi: 'Bàn phím cơ, Chuột & Phụ kiện ngoại vi',
    keywords: [
      'keyboard', 'mechanical', 'keychron', 'magic keyboard', 'mouse', 'mice', 'magic mouse', 'magic trackpad', 'trackpad',
      'logitech', 'mx master', 'superlight', 'headset', 'microphone', 'webcam', 'stream deck', 'razer', 'hyperx',
      'bàn phím', 'bàn phím cơ', 'chuột', 'chuột không dây', 'chuột gaming', 'tai nghe', 'ngoại vi', 'bàn di',
    ],
    visualLabels: ['Mechanical Keycap Profile', 'Ergonomic Desktop Peripheral', 'CNC Wireless Housing'],
  },
  {
    slug: 'accessories',
    labelEn: 'Thunderbolt Docks, Hubs & Desk Stands',
    labelVi: 'Dock Thunderbolt, Hub USB-C & Giá đỡ',
    keywords: [
      'dock', 'docking', 'thunderbolt', 'hub', 'usb-c', 'magsafe', 'adapter', 'cable', 'displayport', 'hdmi', 'stand', 'riser', 'mount', 'caldigit', 'anker', 'lamicall', 'twelvesouth',
      'bộ chuyển đổi', 'giá đỡ', 'cáp', 'kết nối', 'phụ kiện', 'chân đế',
    ],
    visualLabels: ['Anodized Aluminum Hub/Dock', 'Multi-Port Thunderbolt I/O', 'Ergonomic Desk Stand'],
  },
];

const BRAND_NAMES = [
  'Apple', 'ASUS', 'Dell', 'Lenovo', 'HP', 'LG', 'Samsung', 'BenQ', 'NVIDIA', 'AMD',
  'Corsair', 'Crucial', 'Noctua', 'Western Digital', 'SanDisk', 'Seagate', 'Logitech',
  'Keychron', 'Razer', 'HyperX', 'Elgato', 'CalDigit', 'Anker', 'TwelveSouth', 'Lamicall',
];

function detectLanguage(text = '', explicitLocale = '') {
  const viPattern =
    /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]|\b(triệu|máy tính|màn hình|bàn phím|chuột|ổ cứng|linh kiện|tư vấn|dưới|khoảng|giá|so sánh|bảo hành|đơn hàng|mã giảm|xin chào|chào|cấu hình)\b/i;
  if (viPattern.test(text)) return 'vi';
  if (explicitLocale === 'vi' || explicitLocale === 'en') return explicitLocale;
  return 'en';
}

function parseBudgetFromText(text = '') {
  const lower = String(text || '').toLowerCase();
  let maxBudget = null;
  let minBudget = null;

  // 1. Match explicit range: "từ 25 đến 40 triệu", "20 - 35 triệu", "from 20m to 35m", "between 20 and 30tr"
  const rangeMatch = lower.match(
    /(?:từ|from|between|khoảng từ)?\s*(\d+(?:[.,]\d+)?)\s*(triệu|tr|m|million|củ)?\s*(?:đến|tới|to|and|-|–|~)\s*(\d+(?:[.,]\d+)?)\s*(triệu|tr|m|million|củ)/i
  );
  if (rangeMatch) {
    const rawMin = parseFloat(rangeMatch[1].replace(',', '.'));
    const rawMax = parseFloat(rangeMatch[3].replace(',', '.'));
    if (!Number.isNaN(rawMin) && !Number.isNaN(rawMax)) {
      minBudget = rawMin < 500 ? Math.round(rawMin * 1_000_000) : Math.round(rawMin);
      maxBudget = rawMax < 500 ? Math.round(rawMax * 1_000_000) : Math.round(rawMax);
      return { minBudget, maxBudget };
    }
  }

  // 2. Match "dưới 30 triệu", "under 25tr", "tối đa 40m", "< 20 triệu"
  const underMatch = lower.match(
    /(?:dưới|tối đa|max|under|below|<|<=|tầm|khoảng|quanh|around)\s*(\d+(?:[.,]\d+)?)\s*(triệu|tr|m|million|củ)?/i
  );
  if (underMatch) {
    const rawNum = parseFloat(underMatch[1].replace(',', '.'));
    const unit = (underMatch[2] || '').toLowerCase();
    const amount =
      unit || rawNum < 500 ? Math.round(rawNum * 1_000_000) : Math.round(rawNum);
    if (
      lower.includes('tầm') ||
      lower.includes('khoảng') ||
      lower.includes('quanh') ||
      lower.includes('around')
    ) {
      minBudget = Math.round(amount * 0.65);
      maxBudget = Math.round(amount * 1.25);
    } else {
      maxBudget = amount;
    }
  }

  // 3. Match "trên 20 triệu", "over 30m", "từ 15 triệu"
  const overMatch = lower.match(
    /(?:trên|từ|over|above|>|>=)\s*(\d+(?:[.,]\d+)?)\s*(triệu|tr|m|million|củ)?/i
  );
  if (overMatch && !minBudget && !maxBudget) {
    const rawNum = parseFloat(overMatch[1].replace(',', '.'));
    const unit = (overMatch[2] || '').toLowerCase();
    minBudget = unit || rawNum < 500 ? Math.round(rawNum * 1_000_000) : Math.round(rawNum);
  }

  // 4. Match standalone budget mention like "ngân sách 35 triệu", "budget 40m", "có 30 triệu"
  if (!minBudget && !maxBudget) {
    const standaloneMatch = lower.match(
      /(?:ngân sách|budget|với giá|mức giá|có)\s*(\d+(?:[.,]\d+)?)\s*(triệu|tr|m|million|củ)/i
    );
    if (standaloneMatch) {
      const rawNum = parseFloat(standaloneMatch[1].replace(',', '.'));
      if (!Number.isNaN(rawNum)) {
        maxBudget = rawNum < 500 ? Math.round(rawNum * 1_000_000) : Math.round(rawNum);
      }
    }
  }

  return { minBudget, maxBudget };
}

function parseHardwareIntent(message = '', explicitLocale = '', history = []) {
  const lower = String(message || '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ');
  const language = detectLanguage(message, explicitLocale);
  const { minBudget, maxBudget } = parseBudgetFromText(message);

  let detectedCategory = null;
  let bestCatHits = 0;
  for (const cat of CATEGORY_HINTS) {
    const hits = cat.keywords.filter((kw) => lower.includes(kw)).length;
    if (hits > bestCatHits) {
      bestCatHits = hits;
      detectedCategory = cat.slug;
    }
  }

  let detectedBrand = null;
  for (const b of BRAND_NAMES) {
    if (lower.includes(b.toLowerCase())) {
      detectedBrand = b;
      break;
    }
  }
  if (!detectedBrand && /\b(macbook|imac|mac studio|mac mini|mac pro|studio display|magic keyboard|magic mouse|magic trackpad|m3|m4|m5)\b/i.test(lower)) {
    detectedBrand = 'Apple';
  }

  let useCase = 'general';
  if (/(gaming|game|fps|esports|rtx|chiến game|chơi game|240hz|144hz)/i.test(lower)) {
    useCase = 'gaming';
  } else if (/(render|3d|video|premiere|davinci|design|đồ họa|dựng phim|chỉnh ảnh|creator|studio|color|màu)/i.test(lower)) {
    useCase = 'creator';
  } else if (/(code|coding|dev|developer|programming|lập trình|kỹ sư|linux|docker|ai|machine learning|xcode)/i.test(lower)) {
    useCase = 'programming';
  } else if (/(office|work|student|ultrabook|lightweight|văn phòng|sinh viên|mỏng nhẹ|học tập|di chuyển)/i.test(lower)) {
    useCase = 'productivity';
  }

  // Classify high-level conversational action
  let actionType = 'product_recommendation';
  const orderCodeMatch = String(message || '').match(/\b(AEVO-[A-Z0-9-]+)\b/i);

  if (
    orderCodeMatch ||
    /(kiểm tra đơn|tra cứu đơn|tình trạng đơn|đơn hàng của tôi|theo dõi đơn|track.*order|order status|where is my order|my order)/i.test(lower)
  ) {
    actionType = 'order_tracking';
  } else if (
    /(mã giảm giá|voucher|coupon|khuyến mãi|code giảm|discount code|promo code|điểm thưởng|loyalty|tích điểm|ưu đãi)/i.test(lower) &&
    !detectedCategory
  ) {
    actionType = 'discount_loyalty';
  } else if (
    /(chính sách|bảo hành|đổi trả|hoàn tiền|vận chuyển|giao hàng|phí ship|free ship|thanh toán|trả góp|xuất hóa đơn|vat|warranty|shipping policy|return policy|payment method|refund)/i.test(lower) &&
    !detectedCategory
  ) {
    actionType = 'policy_support';
  } else if (
    /(so sánh|khác nhau|khác gì|đặt lên bàn cân|nên mua .* hay|nên chọn .* hay|\bvs\b|versus|compare|comparison|difference between|which is better)/i.test(lower)
  ) {
    actionType = 'comparison';
  } else if (
    /(combo|trọn bộ|bộ máy|góc làm việc|setup|build pc|build cấu hình|full bộ|hệ sinh thái)/i.test(lower)
  ) {
    actionType = 'setup_bundle';
  } else if (
    /^(xin chào|chào|chào bạn|chào shop|chào ad|hi|hello|hey|alo|bạn là ai|bạn làm được gì|giúp mình|help|what can you do)[\s!?.,]*$/i.test(
      String(message || '').trim()
    )
  ) {
    actionType = 'greeting_help';
  }

  // Contextual inheritance from conversation history when user asks a follow-up
  const isFollowUp =
    /(còn mẫu nào|rẻ hơn|cao hơn|tốt hơn|cái đầu|cái thứ|mẫu đầu|mẫu số|con đầu|con thứ|sản phẩm này|máy này|chiếc này|first one|second one|cheaper|other option|more expensive|what about|tell me more)/i.test(
      lower
    );

  if (!detectedCategory && Array.isArray(history) && history.length > 0 && isFollowUp) {
    for (let i = history.length - 1; i >= 0; i -= 1) {
      const turn = history[i];
      if (turn?.intent?.detectedCategory) {
        detectedCategory = turn.intent.detectedCategory;
        break;
      }
      if (Array.isArray(turn?.recommendations) && turn.recommendations[0]?.categorySlug) {
        detectedCategory = turn.recommendations[0].categorySlug;
        break;
      }
    }
  }

  // Extract clean search keywords (strip common filler words)
  const stopWords = new Set([
    'tư', 'vấn', 'cho', 'tôi', 'mình', 'cần', 'mua', 'tìm', 'loại', 'nào', 'tốt', 'nhất',
    'dưới', 'trên', 'khoảng', 'tầm', 'triệu', 'tr', 'vnd', 'với', 'để', 'làm', 'việc',
    'so', 'sánh', 'giữa', 'và', 'hay', 'khác', 'gì', 'nhau', 'nên', 'chọn', 'cái', 'con', 'mẫu',
    'recommend', 'suggest', 'best', 'good', 'for', 'under', 'over', 'around', 'need',
    'looking', 'want', 'buy', 'find', 'me', 'a', 'an', 'the', 'with', 'please', 'what', 'is',
    'compare', 'vs', 'versus', 'between', 'and', 'or', 'which', 'better',
  ]);
  const tokens = lower
    .replace(/[^\p{L}\p{N}\s.-]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !stopWords.has(w) && !/^\d+$/.test(w));

  return {
    language,
    actionType,
    isFollowUp,
    orderCode: orderCodeMatch ? orderCodeMatch[1].toUpperCase() : null,
    detectedCategory,
    detectedBrand,
    useCase,
    minBudget,
    maxBudget,
    keywords: tokens.slice(0, 6),
  };
}

function formatVndPrice(price) {
  return `${Math.round(Number(price) || 0).toLocaleString('vi-VN')} ₫`;
}

// Extract key hardware specs & best matching variant from a catalog product
function enrichProductForAdvisor(p, { targetMaxPrice, useCase, language, queryLower = '' }) {
  const activeVariants = Array.isArray(p.variants)
    ? p.variants.filter((v) => v.isActive !== false && (v.inventory === undefined || v.inventory > 0))
    : [];
  const allVariants = activeVariants.length > 0 ? activeVariants : p.variants || [];

  // Pick a variant that matches query tokens or fits well within targetMaxPrice
  let matchedVariant = allVariants[0] || null;
  if (allVariants.length > 1) {
    const withinBudget = targetMaxPrice
      ? allVariants.filter((v) => Number(v.price) <= targetMaxPrice)
      : allVariants;
    const pool = withinBudget.length > 0 ? withinBudget : allVariants;

    // Check if user mentioned a specific RAM/SSD/Chip token present in variant name
    const specToks = ['64gb', '48gb', '36gb', '32gb', '24gb', '16gb', '2tb', '1tb', '512gb', 'm5 max', 'm5 pro', 'm4 max', 'm3 max'];
    const requestedSpec = specToks.find((st) => queryLower.includes(st));
    if (requestedSpec) {
      const specHit = pool.find((v) => String(v.name || '').toLowerCase().includes(requestedSpec));
      if (specHit) matchedVariant = specHit;
    } else if (targetMaxPrice && withinBudget.length > 0) {
      // Pick the highest-spec variant that still fits within the customer's budget
      matchedVariant = withinBudget[withinBudget.length - 1];
    }
  }

  const basePrice = Number(p.price ?? matchedVariant?.price ?? 0);
  const comparePrice = Number(matchedVariant?.comparePrice ?? p.comparePrice ?? 0);
  const discountPercent =
    comparePrice > basePrice
      ? Math.round(((comparePrice - basePrice) / comparePrice) * 100)
      : 0;

  // Extract concise technical highlights from product description
  const descLines = String(p.description || '')
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const primarySpecLine = descLines[0] || '';
  const secondarySpecLine = descLines[1] || '';

  const reasonVi =
    useCase === 'gaming'
      ? `Hiệu năng đồ họa & tần số quét cao từ ${p.brand}, tối ưu chiến game AAA / Esports`
      : useCase === 'programming'
      ? `Đa nhiệm mượt mà, băng thông bộ nhớ lớn cho lập trình, Docker & AI/ML`
      : useCase === 'creator'
      ? `Chuẩn màu Studio & sức mạnh render 3D / dựng phim 4K–8K chuyên nghiệp`
      : useCase === 'productivity'
      ? `Thiết kế tinh gọn, pin bền bỉ & độ ổn định cao cho công việc di động`
      : `Sản phẩm ${p.brand} đầu bảng trong danh mục ${p.category}`;

  const reasonEn =
    useCase === 'gaming'
      ? `High-refresh performance by ${p.brand}, engineered for modern AAA & competitive gaming`
      : useCase === 'programming'
      ? `Sustained multi-core throughput & fast memory ideal for dev, Docker & AI workflows`
      : useCase === 'creator'
      ? `Reference color accuracy and hardware acceleration for 3D & 8K studio creation`
      : useCase === 'productivity'
      ? `Refined portability, all-day endurance, and whisper-quiet acoustics`
      : `Flagship ${p.brand} essential in ${p.category}`;

  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    brand: p.brand,
    category: p.category,
    categorySlug: p.categorySlug,
    price: basePrice,
    formattedPrice: formatVndPrice(basePrice),
    comparePrice: comparePrice > basePrice ? comparePrice : null,
    formattedComparePrice: comparePrice > basePrice ? formatVndPrice(comparePrice) : null,
    discountPercent,
    image: p.image,
    averageRating: p.averageRating || 4.8,
    reviewCount: p.reviewCount || 0,
    inStock: p.inStock !== false,
    totalInventory: p.totalInventory || 0,
    isBestSeller: Boolean(p.isBestSeller),
    isNewArrival: Boolean(p.isNewArrival),
    variantCount: allVariants.length,
    defaultVariantId: matchedVariant?.id || null,
    matchedVariantName: matchedVariant?.name || null,
    matchedVariantPrice: matchedVariant?.price ? Number(matchedVariant.price) : basePrice,
    formattedMatchedVariantPrice: formatVndPrice(matchedVariant?.price ?? basePrice),
    primarySpecLine,
    secondarySpecLine,
    matchReason: language === 'vi' ? reasonVi : reasonEn,
  };
}

// =============================================================================
// 0. Hybrid Google Gemini LLM + Vision Connector (with Auto-Fallback)
// =============================================================================
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';
let geminiCooldownUntil = 0;
let lastGeminiStatus = GEMINI_API_KEY ? 'configured' : 'unconfigured';
let lastGeminiNote = null;

async function callGeminiGenerateContent(parts, { systemInstruction, jsonMode = false, maxOutputTokens = 750, timeoutMs = 5500 } = {}) {
  if (!GEMINI_API_KEY || Date.now() < geminiCooldownUntil) {
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(
      GEMINI_API_KEY
    )}`;
    const body = {
      ...(systemInstruction
        ? { systemInstruction: { parts: [{ text: systemInstruction }] } }
        : {}),
      contents: [{ role: 'user', parts }],
      generationConfig: {
        temperature: 0.35,
        maxOutputTokens,
        ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
      },
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      const errMsg = errBody?.error?.message || `HTTP ${res.status}`;
      lastGeminiNote = errMsg;
      if (
        res.status === 400 ||
        res.status === 401 ||
        res.status === 402 ||
        res.status === 403 ||
        res.status === 429
      ) {
        lastGeminiStatus =
          res.status === 402 ? 'quota-depleted-fallback' : 'auth-or-rate-limit-fallback';
        geminiCooldownUntil = Date.now() + 300_000;
      }
      return null;
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) {
      lastGeminiStatus = 'active-live-llm';
      lastGeminiNote = null;
      return text.trim();
    }
    return null;
  } catch (err) {
    clearTimeout(timer);
    lastGeminiNote = err.message;
    return null;
  }
}

router.get('/status', (req, res) => {
  res.json({
    geminiConfigured: Boolean(GEMINI_API_KEY),
    geminiModel: GEMINI_MODEL,
    providerStatus: lastGeminiStatus,
    providerNote: lastGeminiNote,
    fallbackEngine: 'aevo-intelligence-v2 (Multi-Turn Agentic RAG + Elasticsearch BM25)',
    capabilities: [
      'multi-turn-chat-rag',
      'spec-comparison-matrix',
      'workspace-setup-builder',
      'live-order-tracking',
      'live-discount-loyalty-lookup',
      'vision-image-search',
      'bilingual-sentiment',
    ],
  });
});

// =============================================================================
// Specialized Domain Synthesis Builders (Big-Tech Executive Tone)
// =============================================================================

function buildGreetingReply(language, user) {
  const userGreetingVi = user?.fullName ? `Xin chào **${user.fullName}**!` : 'Xin chào!';
  const userGreetingEn = user?.fullName ? `Hello **${user.fullName}**!` : 'Hello!';

  if (language === 'vi') {
    return [
      `${userGreetingVi} Mình là **AEVO Intelligence** — Chuyên gia Tư vấn Phần cứng & Trợ lý Mua sắm của AEVO Store.`,
      '',
      'Mình có thể hỗ trợ bạn ngay lập tức với các tác vụ chuyên sâu:',
      '- **Tư vấn cấu hình chuẩn xác**: Lọc theo công việc (*Lập trình, AI/ML, Đồ họa 3D/Video 8K, Gaming 240Hz, Văn phòng*) và mức ngân sách của bạn.',
      '- **So sánh thông số trực diện**: Đặt lên bàn cân 2–3 sản phẩm (CPU/GPU, RAM/SSD, màn hình, giá bán theo từng phiên bản).',
      '- **Thiết kế trọn bộ Setup (Combo Builder)**: Phối ghép đồng bộ *Laptop / Mac Studio + Màn hình Đồ họa + Bàn phím cơ & Dock Thunderbolt*.',
      '- **Mã giảm giá & Điểm thưởng Loyalty**: Tra cứu các voucher đang hoạt động và tích lũy **10% điểm thưởng** trên mọi đơn hàng.',
      '- **Tra cứu đơn hàng thời gian thực**: Nhập mã đơn (VD: `AEVO-10001`) để kiểm tra tiến trình giao nhận.',
      '',
      '> 💡 **Bắt đầu nhanh:** Hãy cho mình biết nhu cầu sử dụng hoặc ngân sách dự kiến của bạn (ví dụ: *"Laptop lập trình dưới 45 triệu"* hoặc *"So sánh MacBook Pro M5 và MacBook Air M5"*).',
    ].join('\n');
  }

  return [
    `${userGreetingEn} I am **AEVO Intelligence** — your AI Hardware Specialist & Store Concierge.`,
    '',
    'Here is how I can help you today:',
    '- **Precision Hardware Consultation**: Tailored picks for *Software Engineering, AI/ML, 3D & 8K Video Creation, High-Refresh Gaming, or Ultrabook Mobility* within your budget.',
    '- **Head-to-Head Spec Comparisons**: Side-by-side comparison tables covering variants, display tech, compute performance, and pricing.',
    '- **Complete Workspace Setup Builder**: Multi-category bundles (*Workstation + Studio Display + Mechanical Peripherals & Thunderbolt 5 Docks*).',
    '- **Live Promo Codes & Loyalty Rewards**: Check active 5-character discount codes and our **10% Loyalty Points** program.',
    '- **Real-Time Order Tracking**: Enter your order code (e.g., `AEVO-10001`) for instant fulfillment status.',
    '',
    '> 💡 **Quick Start:** Tell me your workflow or target budget (e.g., *"Laptop for coding under 35M"* or *"Compare MacBook Pro M5 vs MacBook Air M5"*).',
  ].join('\n');
}

async function buildOrderTrackingReply(language, orderCode, user) {
  if (orderCode) {
    let order = null;
    try {
      order = await prisma.order.findUnique({
        where: { orderNumber: orderCode },
        include: {
          items: true,
          statusHistory: {
            orderBy: { createdAt: 'desc' },
            take: 3,
          },
        },
      });
    } catch {
      order = null;
    }

    if (!order) {
      return language === 'vi'
        ? [
            `### 📦 Tra cứu đơn hàng \`${orderCode}\``,
            `Mình chưa tìm thấy đơn hàng nào khớp với mã **\`${orderCode}\`** trên hệ thống.`,
            '',
            '- Vui lòng kiểm tra lại chính xác định dạng mã đơn (ví dụ: `AEVO-...` trong email xác nhận đơn hàng).',
            '- Bạn cũng có thể truy cập trực tiếp trang **[Lịch sử đơn hàng](/account/orders)** để tra cứu nhanh.',
          ].join('\n')
        : [
            `### 📦 Order Lookup \`${orderCode}\``,
            `I could not find an order matching **\`${orderCode}\`** in our system.`,
            '',
            '- Please double-check the order reference from your confirmation email.',
            '- You can also track orders directly on the **[Order History](/account/orders)** page.',
          ].join('\n');
    }

    const statusMapVi = {
      PENDING: '⏳ Đang chờ xác nhận (PENDING)',
      CONFIRMED: '✅ Đã xác nhận & giữ hàng (CONFIRMED)',
      SHIPPING: '🚚 Đang vận chuyển có bảo hiểm (SHIPPING)',
      DELIVERED: '🎉 Đã giao hàng thành công (DELIVERED)',
      CANCELLED: '❌ Đã hủy (CANCELLED)',
    };
    const statusMapEn = {
      PENDING: '⏳ Pending Confirmation (PENDING)',
      CONFIRMED: '✅ Confirmed & Reserved (CONFIRMED)',
      SHIPPING: '🚚 In Insured Transit (SHIPPING)',
      DELIVERED: '🎉 Delivered (DELIVERED)',
      CANCELLED: '❌ Cancelled (CANCELLED)',
    };

    const itemsLines = (order.items || [])
      .map(
        (it) =>
          `- **${it.quantity}× ${it.productName}** (${it.variantName}) — ${formatVndPrice(
            it.price * it.quantity
          )}`
      )
      .join('\n');

    const latestHistory = order.statusHistory?.[0];
    const latestNote = latestHistory?.note ? ` — *${latestHistory.note}*` : '';

    if (language === 'vi') {
      return [
        `### 📦 Thông tin đơn hàng \`${order.orderNumber}\``,
        `- **Trạng thái hiện tại:** ${statusMapVi[order.status] || order.status}`,
        `- **Tổng thanh toán:** **${formatVndPrice(order.totalAmount)}** (Phương thức: \`${String(order.paymentMethod || 'cod').toUpperCase()}\`)`,
        `- **Ngày đặt hàng:** ${new Date(order.createdAt).toLocaleDateString('vi-VN')}`,
        '',
        '#### Danh sách thiết bị:',
        itemsLines || '- Đang cập nhật danh sách thiết bị',
        '',
        latestHistory
          ? `> 🕒 **Cập nhật mới nhất:** ${new Date(latestHistory.createdAt).toLocaleString('vi-VN')}${latestNote}`
          : '> 💡 Bạn có thể xem chi tiết hóa đơn tại mục **Tài khoản → Lịch sử đơn hàng**.',
      ].join('\n');
    }

    return [
      `### 📦 Order Status: \`${order.orderNumber}\``,
      `- **Current Status:** ${statusMapEn[order.status] || order.status}`,
      `- **Total Amount:** **${formatVndPrice(order.totalAmount)}** (Payment: \`${String(order.paymentMethod || 'cod').toUpperCase()}\`)`,
      `- **Placed On:** ${new Date(order.createdAt).toLocaleDateString('en-US')}`,
      '',
      '#### Ordered Hardware:',
      itemsLines || '- Hardware items recorded on invoice',
      '',
      latestHistory
        ? `> 🕒 **Latest Update:** ${new Date(latestHistory.createdAt).toLocaleString('en-US')}${latestNote}`
        : '> 💡 View full invoice details anytime under **Account → Order History**.',
    ].join('\n');
  }

  // No explicit order code in message: check if user is logged in and has recent orders
  if (user?.id) {
    let recentOrders = [];
    try {
      recentOrders = await prisma.order.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 3,
        include: { items: true },
      });
    } catch {
      recentOrders = [];
    }

    if (recentOrders.length > 0) {
      const listVi = recentOrders
        .map(
          (o) =>
            `- **\`${o.orderNumber}\`** · Trạng thái: **${o.status}** · Tổng: **${formatVndPrice(
              o.totalAmount
            )}** (${o.items.length} sản phẩm)`
        )
        .join('\n');
      const listEn = recentOrders
        .map(
          (o) =>
            `- **\`${o.orderNumber}\`** · Status: **${o.status}** · Total: **${formatVndPrice(
              o.totalAmount
            )}** (${o.items.length} item(s))`
        )
        .join('\n');

      return language === 'vi'
        ? [
            `### 📦 Đơn hàng gần đây của ${user.fullName}`,
            listVi,
            '',
            '> 💡 Nhập trực tiếp mã đơn (VD: `' +
              recentOrders[0].orderNumber +
              '`) vào khung chat để xem chi tiết từng mốc vận chuyển, hoặc mở trang **[Lịch sử đơn hàng](/account/orders)**.',
          ].join('\n')
        : [
            `### 📦 Recent Orders for ${user.fullName}`,
            listEn,
            '',
            '> 💡 Type an order number (e.g. `' +
              recentOrders[0].orderNumber +
              '`) here to inspect full item breakdown and tracking history.',
          ].join('\n');
    }
  }

  return language === 'vi'
    ? [
        '### 📦 Tra cứu tiến trình đơn hàng AEVO',
        'Để kiểm tra trạng thái đơn hàng theo thời gian thực, bạn hãy:',
        '1. **Gửi mã đơn hàng** ngay tại khung chat này (ví dụ: `AEVO-10001`).',
        '2. Hoặc truy cập mục **[Tài khoản → Lịch sử đơn hàng](/account/orders)** để xem toàn bộ lịch sử mua sắm và điểm thưởng.',
        '',
        '> 💡 Mọi đơn hàng từ **20.000.000 ₫** đều được vận chuyển nhanh có bảo hiểm miễn phí toàn quốc.',
      ].join('\n')
    : [
        '### 📦 Real-Time Order Tracking',
        'To check your live order fulfillment status:',
        '1. **Reply with your AEVO order number** right here in the chat (e.g., `AEVO-10001`).',
        '2. Or visit **[Account → Order History](/account/orders)** to view all past orders and loyalty points.',
        '',
        '> 💡 All orders over **20,000,000 ₫** include complimentary insured express shipping.',
      ].join('\n');
}

async function buildDiscountLoyaltyReply(language, user) {
  let availableDiscounts = [];
  try {
    const discounts = await prisma.discount.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      take: 8,
    });
    availableDiscounts = discounts.filter((d) => d.usedCount < d.maxUses).slice(0, 5);
  } catch {
    availableDiscounts = [];
  }

  let userPoints = null;
  if (user?.id) {
    try {
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { loyaltyPoints: true, fullName: true },
      });
      if (dbUser) userPoints = dbUser.loyaltyPoints;
    } catch {
      userPoints = null;
    }
  }

  if (language === 'vi') {
    const codeLines =
      availableDiscounts.length > 0
        ? availableDiscounts
            .map((d) => {
              const valStr =
                d.discountType === 'percentage'
                  ? `Giảm **${d.discountValue}%**`
                  : `Giảm trực tiếp **${formatVndPrice(d.discountValue)}**`;
              const remaining = Math.max(0, d.maxUses - d.usedCount);
              return `- Mã **\`${d.code}\`**: ${valStr} *(Còn ${remaining}/${d.maxUses} lượt dùng)*${
                d.description ? ` — ${d.description}` : ''
              }`;
            })
            .join('\n')
        : '- Hiện tại các mã giới hạn lượt dùng trong đợt đang tạm hết, bạn vẫn được tích và dùng **10% Loyalty Points** trực tiếp!';

    const pointsLine =
      userPoints !== null
        ? `- **Số dư điểm của bạn:** **${userPoints.toLocaleString('vi-VN')} điểm** (Tương đương **${formatVndPrice(
            userPoints * 1000
          )}** giảm trực tiếp ở bước Thanh toán).`
        : '- **Quy đổi tức thì:** `100 điểm = 100.000 ₫` trừ trực tiếp vào tổng hóa đơn ở bước Thanh toán (dùng kết hợp được cùng mã giảm giá).';

    return [
      '### 🎁 Mã Giảm Giá Đang Hoạt Động & Chương Trình Loyalty',
      '#### 1. Mã giảm giá (5 ký tự) sẵn sàng áp dụng:',
      codeLines,
      '',
      '#### 2. Đặc quyền Khách hàng Thân thiết (AEVO Loyalty 10%):',
      '- **Tích lũy tự động:** Mọi đơn hàng thành công đều được hoàn **10% giá trị thành điểm thưởng** (`1.000.000 ₫ = 100 điểm`).',
      pointsLine,
      '',
      '> 💡 **Mẹo tiết kiệm tối đa:** Ở bước **Thanh toán (Checkout)**, bạn có thể nhập mã 5 ký tự ở trên **VÀ** áp dụng điểm thưởng Loyalty cùng lúc!',
    ].join('\n');
  }

  const codeLinesEn =
    availableDiscounts.length > 0
      ? availableDiscounts
          .map((d) => {
            const valStr =
              d.discountType === 'percentage'
                ? `**${d.discountValue}% OFF**`
                : `**${formatVndPrice(d.discountValue)} OFF**`;
            const remaining = Math.max(0, d.maxUses - d.usedCount);
            return `- Code **\`${d.code}\`**: ${valStr} *(${remaining}/${d.maxUses} uses left)*${
              d.description ? ` — ${d.description}` : ''
            }`;
          })
          .join('\n')
      : '- Limited-use promo codes are currently claimed, but you automatically earn **10% in AEVO Loyalty Points** on every order!';

  const pointsLineEn =
    userPoints !== null
      ? `- **Your Available Balance:** **${userPoints.toLocaleString('en-US')} pts** (Redeemable for **${formatVndPrice(
          userPoints * 1000
        )}** off at Checkout).`
      : '- **Instant Redemption:** `100 points = 100,000 ₫` off your next purchase, stackable with promo codes at Checkout.';

  return [
    '### 🎁 Active Promo Codes & AEVO Loyalty Program',
    '#### 1. Live 5-Character Discount Codes:',
    codeLinesEn,
    '',
    '#### 2. AEVO 10% Loyalty Rewards:',
    '- **Automatic Earning:** Earn **10% back in points** on every order (`1,000,000 ₫ = 100 points`).',
    pointsLineEn,
    '',
    '> 💡 **Pro Tip:** At **Checkout**, you can stack an active 5-character discount code **AND** your Loyalty Points on the same order.',
  ].join('\n');
}

function buildPolicySupportReply(language) {
  if (language === 'vi') {
    return [
      '### 🛡️ Chính sách Bảo hành, Vận chuyển & Thanh toán tại AEVO',
      '',
      '- **Bảo hành chính hãng 24 tháng:** Toàn bộ máy trạm, MacBook, màn hình Studio và linh kiện tại AEVO đều nguyên seal chính hãng, bảo hành phần cứng **24 tháng** và hỗ trợ kỹ thuật trọn đời.',
      '- **Vận chuyển nhanh có bảo hiểm (Miễn phí từ 20 Triệu ₫):**',
      '  - **Miễn phí 100%** phí vận chuyển bảo hiểm cho mọi đơn hàng từ **20.000.000 ₫**.',
      '  - Đơn dưới 20 triệu: Giao tiêu chuẩn 2–4 ngày (`150.000 ₫`) hoặc Giao hỏa tốc ưu tiên trong ngày (`350.000 ₫`).',
      '- **4 Phương thức thanh toán linh hoạt & bảo mật:**',
      '  1. **COD (Thanh toán khi nhận hàng):** Kiểm tra ngoại quan & niêm phong phần cứng trước khi thanh toán.',
      '  2. **VietQR:** Chuyển khoản liên ngân hàng tức thời tự động điền nội dung đơn hàng.',
      '  3. **Thẻ Quốc tế (Visa / Mastercard / JCB):** Bảo mật chuẩn 3D Secure.',
      '  4. **Ví điện tử MoMo:** Quét mã QR thanh toán siêu tốc.',
      '- **Hóa đơn & Thuế:** Giá minh bạch, hỗ trợ xuất hóa đơn điện tử GTGT (10% VAT) đầy đủ.',
      '',
      '> 💡 Cần mình tư vấn dòng sản phẩm cụ thể hay kiểm tra mã giảm giá cho đơn hàng sắp tới của bạn không?',
    ].join('\n');
  }

  return [
    '### 🛡️ AEVO Official Warranty, Shipping & Payment Policies',
    '',
    '- **24-Month Official Hardware Warranty:** Every workstation, MacBook, display, and component is factory-sealed and backed by our comprehensive **24-month hardware warranty**.',
    '- **Insured Express Delivery (Free Over 20,000,000 ₫):**',
    '  - **Complimentary (Free)** insured courier shipping on all orders over **20,000,000 ₫**.',
    '  - Orders under 20M ₫: Insured Standard Courier 2–4 days (`150,000 ₫`) or Priority Same-Day/Next-Day Air (`350,000 ₫`).',
    '- **4 Secure Payment Options:**',
    '  1. **Cash on Delivery (COD):** Inspect hardware seal upon delivery.',
    '  2. **Instant Bank Transfer (VietQR):** Direct interbank transfer with order reference.',
    '  3. **Credit / Debit Card:** Visa, Mastercard, and JCB with 3D Secure verification.',
    '  4. **MoMo E-Wallet:** Instant QR wallet checkout.',
    '- **VAT & Loyalty:** Full 10% VAT invoice support plus **10% Loyalty Points** earned on every purchase.',
    '',
    '> 💡 Would you like product recommendations for your workflow or active discount codes for checkout?',
  ].join('\n');
}

function buildComparisonReply(recommendations, language) {
  const items = recommendations.slice(0, 3);
  if (items.length < 2) {
    return null;
  }

  const [a, b, c] = items;
  if (language === 'vi') {
    const colsHeader = c
      ? `| Tiêu chí | ${a.name} | ${b.name} | ${c.name} |`
      : `| Tiêu chí | ${a.name} | ${b.name} |`;
    const colsSep = c ? '| :--- | :--- | :--- | :--- |' : '| :--- | :--- | :--- |';
    const rowBrand = c
      ? `| **Thương hiệu / Danh mục** | ${a.brand} · ${a.category} | ${b.brand} · ${b.category} | ${c.brand} · ${c.category} |`
      : `| **Thương hiệu / Danh mục** | ${a.brand} · ${a.category} | ${b.brand} · ${b.category} |`;
    const rowPrice = c
      ? `| **Giá khởi điểm** | **${a.formattedPrice}** | **${b.formattedPrice}** | **${c.formattedPrice}** |`
      : `| **Giá khởi điểm** | **${a.formattedPrice}** | **${b.formattedPrice}** |`;
    const rowVariant = c
      ? `| **Cấu hình tiêu biểu** | ${a.matchedVariantName || 'Tiêu chuẩn'} | ${b.matchedVariantName || 'Tiêu chuẩn'} | ${c.matchedVariantName || 'Tiêu chuẩn'} |`
      : `| **Cấu hình tiêu biểu** | ${a.matchedVariantName || 'Tiêu chuẩn'} | ${b.matchedVariantName || 'Tiêu chuẩn'} |`;
    const rowRating = c
      ? `| **Đánh giá & Tồn kho** | ★ ${a.averageRating} (${a.variantCount} bản) | ★ ${b.averageRating} (${b.variantCount} bản) | ★ ${c.averageRating} (${c.variantCount} bản) |`
      : `| **Đánh giá & Tồn kho** | ★ ${a.averageRating} (${a.variantCount} phiên bản) | ★ ${b.averageRating} (${b.variantCount} phiên bản) |`;

    const cheaper = a.price <= b.price ? a : b;
    const premium = a.price <= b.price ? b : a;
    const priceDiff = Math.abs(premium.price - cheaper.price);

    return [
      `### ⚖️ Đặt lên bàn cân: **${a.name}** vs **${b.name}**${c ? ` vs **${c.name}**` : ''}`,
      '',
      colsHeader,
      colsSep,
      rowBrand,
      rowPrice,
      rowVariant,
      rowRating,
      '',
      '#### 🔍 Phân tích & Khuyến nghị từ Chuyên gia AEVO:',
      `- **Chọn ${premium.name} (${premium.formattedPrice}):** ${
        premium.primarySpecLine || premium.matchReason
      } Phù hợp nhất nếu bạn ưu tiên hiệu năng đỉnh cao, dư địa cấu hình dài hạn cho tác vụ nặng.`,
      `- **Chọn ${cheaper.name} (${cheaper.formattedPrice}):** ${
        cheaper.primarySpecLine || cheaper.matchReason
      } Giải pháp tối ưu chi phí${
        priceDiff > 0 ? ` (tiết kiệm **${formatVndPrice(priceDiff)}**)` : ''
      } mà vẫn đáp ứng xuất sắc nhu cầu thực tế.`,
      '',
      '> 💡 Bạn có thể nhấn **"+ Giỏ hàng"** hoặc mở từng thẻ sản phẩm bên dưới để xem chi tiết tồn kho theo từng phiên bản cấu hình.',
    ].join('\n');
  }

  const colsHeaderEn = c
    ? `| Spec / Metric | ${a.name} | ${b.name} | ${c.name} |`
    : `| Spec / Metric | ${a.name} | ${b.name} |`;
  const colsSepEn = c ? '| :--- | :--- | :--- | :--- |' : '| :--- | :--- | :--- |';
  const rowBrandEn = c
    ? `| **Brand / Category** | ${a.brand} · ${a.category} | ${b.brand} · ${b.category} | ${c.brand} · ${c.category} |`
    : `| **Brand / Category** | ${a.brand} · ${a.category} | ${b.brand} · ${b.category} |`;
  const rowPriceEn = c
    ? `| **Starting Price** | **${a.formattedPrice}** | **${b.formattedPrice}** | **${c.formattedPrice}** |`
    : `| **Starting Price** | **${a.formattedPrice}** | **${b.formattedPrice}** |`;
  const rowVariantEn = c
    ? `| **Featured Config** | ${a.matchedVariantName || 'Base Config'} | ${b.matchedVariantName || 'Base Config'} | ${c.matchedVariantName || 'Base Config'} |`
    : `| **Featured Config** | ${a.matchedVariantName || 'Base Config'} | ${b.matchedVariantName || 'Base Config'} |`;
  const rowRatingEn = c
    ? `| **Rating & Options** | ★ ${a.averageRating} (${a.variantCount} configs) | ★ ${b.averageRating} (${b.variantCount} configs) | ★ ${c.averageRating} (${c.variantCount} configs) |`
    : `| **Rating & Options** | ★ ${a.averageRating} (${a.variantCount} configs) | ★ ${b.averageRating} (${b.variantCount} configs) |`;

  const cheaper = a.price <= b.price ? a : b;
  const premium = a.price <= b.price ? b : a;
  const priceDiff = Math.abs(premium.price - cheaper.price);

  return [
    `### ⚖️ Head-to-Head Comparison: **${a.name}** vs **${b.name}**${c ? ` vs **${c.name}**` : ''}`,
    '',
    colsHeaderEn,
    colsSepEn,
    rowBrandEn,
    rowPriceEn,
    rowVariantEn,
    rowRatingEn,
    '',
    '#### 🔍 AEVO Specialist Verdict:',
    `- **Go with ${premium.name} (${premium.formattedPrice}):** ${
      premium.primarySpecLine || premium.matchReason
    } Best if you want maximum compute headroom and top-tier specifications.`,
    `- **Go with ${cheaper.name} (${cheaper.formattedPrice}):** ${
      cheaper.primarySpecLine || cheaper.matchReason
    } Ideal if you want exceptional value${
      priceDiff > 0 ? ` (saving **${formatVndPrice(priceDiff)}**)` : ''
    } with balanced everyday performance.`,
    '',
    '> 💡 Click **"+ Add"** on any product card below or open the product page to configure individual variants.',
  ].join('\n');
}

function buildSetupBundleReply(recommendations, language, targetMaxPrice) {
  const totalBundlePrice = recommendations.reduce((sum, r) => sum + (Number(r.price) || 0), 0);
  const earnedPoints = Math.floor(totalBundlePrice / 10000);

  if (language === 'vi') {
    const bulletLines = recommendations
      .map(
        (r, idx) =>
          `${idx + 1}. **[${r.category}] ${r.name}** — **${r.formattedPrice}**\n   - *Cấu hình:* \`${
            r.matchedVariantName || 'Tiêu chuẩn'
          }\` · ${r.primarySpecLine || r.matchReason}`
      )
      .join('\n');

    return [
      `### 🖥️ Đề xuất Trọn bộ Góc làm việc AEVO Studio${
        targetMaxPrice ? ` (Mục tiêu ngân sách: ${formatVndPrice(targetMaxPrice)})` : ''
      }`,
      'Dưới đây là cấu hình phối ghép đồng bộ từ các danh mục phần cứng đang sẵn hàng:',
      '',
      bulletLines,
      '',
      `- **Tổng giá trị trọn bộ:** **${formatVndPrice(totalBundlePrice)}**`,
      `- **Ưu đãi đi kèm:** Tích lũy ngay **+${earnedPoints.toLocaleString('vi-VN')} điểm Loyalty** (tương đương **${formatVndPrice(
        earnedPoints * 1000
      )}**) + **Miễn phí vận chuyển bảo hiểm toàn quốc**.`,
    ].join('\n');
  }

  const bulletLinesEn = recommendations
    .map(
      (r, idx) =>
        `${idx + 1}. **[${r.category}] ${r.name}** — **${r.formattedPrice}**\n   - *Config:* \`${
          r.matchedVariantName || 'Base'
        }\` · ${r.primarySpecLine || r.matchReason}`
    )
    .join('\n');

  return [
    `### 🖥️ AEVO Curated Workspace Setup${
      targetMaxPrice ? ` (Target Budget: ${formatVndPrice(targetMaxPrice)})` : ''
    }`,
    'Here is a synchronized multi-category hardware setup from our in-stock catalog:',
    '',
    bulletLinesEn,
    '',
    `- **Estimated Setup Total:** **${formatVndPrice(totalBundlePrice)}**`,
    `- **Included Perks:** Earn **+${earnedPoints.toLocaleString('en-US')} Loyalty Points** (worth **${formatVndPrice(
      earnedPoints * 1000
    )}**) + **Complimentary Insured Express Shipping**.`,
  ].join('\n');
}

function buildExpertConsultationReply(recommendations, intent, targetCategory, targetMaxPrice) {
  const { language, useCase, detectedBrand } = intent;

  if (!recommendations || recommendations.length === 0) {
    return language === 'vi'
      ? 'AEVO hiện có đầy đủ các dòng **MacBook M5, Laptop Workstation, Màn hình Đồ họa 4K/5K/6K, Linh kiện RTX & Ổ cứng NVMe**. Hãy cho mình biết mức ngân sách hoặc nhu cầu sử dụng cụ thể để mình lọc cấu hình chuẩn xác nhất nhé!'
      : 'I can help you configure the ideal **MacBook M5, Workstation Laptop, 4K/5K/6K Studio Monitor, RTX GPU, or NVMe SSD**. Let me know your target budget or workflow!';
  }

  const useCaseLabelVi = {
    programming: 'Lập trình, Kỹ thuật phần mềm & AI/ML',
    creator: 'Đồ họa 3D, Dựng phim 4K/8K & Sáng tạo nội dung',
    gaming: 'Chiến game AAA & Esports tần số quét cao',
    productivity: 'Làm việc văn phòng, Doanh nhân & Di chuyển linh hoạt',
    general: 'Hiệu năng cao & Đa nhiệm chuyên nghiệp',
  }[useCase] || 'Hiệu năng cao';

  const useCaseLabelEn = {
    programming: 'Software Engineering, DevOps & AI/ML',
    creator: '3D Rendering, 8K Video Editing & Studio Creation',
    gaming: 'High-Refresh AAA & Competitive Gaming',
    productivity: 'Executive Mobility & All-Day Productivity',
    general: 'High-Performance Computing',
  }[useCase] || 'Pro Computing';

  const tipByCategoryVi = {
    laptops:
      'Với nhu cầu dài hạn trong 3–5 năm tới, bạn nên ưu tiên phiên bản từ **16GB–36GB RAM Unified/DDR5** để đảm bảo đa nhiệm mượt mà khi mở nhiều ứng dụng nặng.',
    monitors:
      'Các dòng màn hình chuẩn Studio tại AEVO đều hỗ trợ kết nối **Thunderbolt / USB-C/DisplayPort** băng thông cao, giúp truyền hình ảnh 4K/5K/6K và sạc ngược cho laptop chỉ bằng 1 sợi cáp duy nhất.',
    components:
      'Mọi hệ thống máy bàn và linh kiện PC cao cấp tại AEVO đều được bảo hành chính hãng **24 tháng** kèm hỗ trợ tư vấn tương thích nguồn & tản nhiệt.',
    storage:
      'Nâng cấp ổ cứng **NVMe PCIe 4.0 / Thunderbolt** giúp rút ngắn tới 65% thời gian build project lớn, khởi động game và xuất file video RAW.',
    peripherals:
      'Kết hợp bàn phím cơ/Magic Keyboard cùng chuột công thái học giúp tăng tốc độ thao tác phím tắt và bảo vệ cổ tay khi làm việc trên 8 giờ/ngày.',
    accessories:
      'Sử dụng Dock Thunderbolt chính hãng giúp mở rộng toàn bộ cổng màn hình rời, LAN Gigabit và thẻ nhớ SDXC mà không làm suy hao băng thông.',
  };

  const tipByCategoryEn = {
    laptops:
      'For 3–5 years of headroom, we recommend prioritizing configurations with **16GB–36GB Unified/DDR5 RAM** for heavy multitasking and container workloads.',
    monitors:
      'Our studio displays feature high-bandwidth **Thunderbolt / USB-C / DisplayPort** connectivity for single-cable video + power delivery.',
    components:
      'All desktop systems and flagship PC components include our **24-month official hardware warranty** and insured express shipping.',
    storage:
      'High-speed **PCIe 4.0 NVMe & Thunderbolt SSDs** drastically cut compile times, asset loading, and 8K ProRes scrubbing.',
    peripherals:
      'Pairing precision mechanical or Force Touch peripherals reduces wrist fatigue across extended 8+ hour studio sessions.',
    accessories:
      'Thunderbolt 5 docks expand your workstation into a single-cable desktop hub supporting dual 6K displays and 240W power delivery.',
  };

  const activeCatKey = targetCategory || recommendations[0]?.categorySlug || 'laptops';

  if (language === 'vi') {
    const filterNotes = [];
    if (detectedBrand) filterNotes.push(`thương hiệu **${detectedBrand}**`);
    if (targetMaxPrice) filterNotes.push(`ngân sách **dưới ${formatVndPrice(targetMaxPrice)}**`);
    const contextPhrase = filterNotes.length > 0 ? ` (${filterNotes.join(' · ')})` : '';

    const itemBlocks = recommendations
      .slice(0, 3)
      .map((r, idx) => {
        const discountBadge =
          r.discountPercent > 0
            ? ` *(Đang giảm ${r.discountPercent}% từ ${r.formattedComparePrice})*`
            : '';
        const configLine = r.matchedVariantName
          ? `\n   - **Phiên bản đề xuất:** \`${r.matchedVariantName}\` (${r.formattedMatchedVariantPrice})`
          : '';
        const specText = r.primarySpecLine ? `\n   - **Điểm mạnh kỹ thuật:** ${r.primarySpecLine}` : '';
        return `${idx + 1}. **${r.name}** — **${r.formattedPrice}**${discountBadge}${configLine}${specText}\n   - **Phù hợp vì:** ${r.matchReason} · Đánh giá: **★ ${r.averageRating}** (${r.variantCount} tùy chọn cấu hình sẵn hàng).`;
      })
      .join('\n\n');

    return [
      `### 🎯 Tư vấn Cấu hình cho **${useCaseLabelVi}**${contextPhrase}`,
      `Dựa trên dữ liệu kho hàng thời gian thực của AEVO, mình chọn lọc **${recommendations.length} đề xuất tối ưu nhất** dành cho bạn:`,
      '',
      itemBlocks,
      '',
      `> 💡 **Lời khuyên chuyên gia:** ${
        tipByCategoryVi[activeCatKey] || tipByCategoryVi.laptops
      } Bạn có thể bấm **"So sánh 2 mẫu đầu tiên"** bên dưới nếu đang phân vân giữa các lựa chọn!`,
    ].join('\n');
  }

  const filterNotesEn = [];
  if (detectedBrand) filterNotesEn.push(`brand **${detectedBrand}**`);
  if (targetMaxPrice) filterNotesEn.push(`budget **under ${formatVndPrice(targetMaxPrice)}**`);
  const contextPhraseEn = filterNotesEn.length > 0 ? ` (${filterNotesEn.join(' · ')})` : '';

  const itemBlocksEn = recommendations
    .slice(0, 3)
    .map((r, idx) => {
      const discountBadge =
        r.discountPercent > 0
          ? ` *(Save ${r.discountPercent}% off ${r.formattedComparePrice})*`
          : '';
      const configLine = r.matchedVariantName
        ? `\n   - **Recommended Config:** \`${r.matchedVariantName}\` (${r.formattedMatchedVariantPrice})`
        : '';
      const specText = r.primarySpecLine ? `\n   - **Technical Highlight:** ${r.primarySpecLine}` : '';
      return `${idx + 1}. **${r.name}** — **${r.formattedPrice}**${discountBadge}${configLine}${specText}\n   - **Why it fits:** ${r.matchReason} · Rating: **★ ${r.averageRating}** (${r.variantCount} in-stock configurations).`;
    })
    .join('\n\n');

  return [
    `### 🎯 Curated Hardware for **${useCaseLabelEn}**${contextPhraseEn}`,
    `Based on real-time AEVO inventory and specifications, here are the **top ${recommendations.length} recommendations** for your workflow:`,
    '',
    itemBlocksEn,
    '',
    `> 💡 **Specialist Tip:** ${
      tipByCategoryEn[activeCatKey] || tipByCategoryEn.laptops
    } Click **"Compare top 2 models"** below for a side-by-side spec table!`,
  ].join('\n');
}

function buildContextualSuggestedPrompts(intent, recommendations) {
  const { language, actionType, detectedCategory } = intent;
  const hasTwoRecs = Array.isArray(recommendations) && recommendations.length >= 2;

  if (language === 'vi') {
    if (actionType === 'order_tracking') {
      return [
        'Xem mã giảm giá đang hoạt động',
        'Chính sách bảo hành & vận chuyển',
        'Laptop lập trình dưới 40 triệu',
        'Tư vấn màn hình đồ họa 4K/5K',
      ];
    }
    if (actionType === 'discount_loyalty' || actionType === 'policy_support') {
      return [
        'Laptop lập trình dưới 35 triệu',
        'So sánh MacBook Pro M5 và MacBook Air M5',
        'Màn hình 4K đồ họa tốt nhất',
        'Tư vấn combo góc làm việc 50 triệu',
      ];
    }
    if (actionType === 'comparison') {
      return [
        'Xem mã giảm giá áp dụng được',
        'Chính sách bảo hành 24 tháng & Free Ship',
        'Tư vấn thêm phụ kiện Dock & Phím chuột đi kèm',
        'Tìm phương án tương tự giá mềm hơn',
      ];
    }
    if (hasTwoRecs) {
      return [
        `So sánh ${recommendations[0].name} và ${recommendations[1].name}`,
        detectedCategory === 'laptops'
          ? 'Gợi ý màn hình rời & phụ kiện đi kèm'
          : 'Tìm lựa chọn giá mềm hơn trong danh mục này',
        'Xem mã giảm giá & ưu đãi Loyalty hiện có',
        'Chính sách bảo hành & giao hàng AEVO',
      ];
    }
    return [
      'Laptop lập trình dưới 35 triệu',
      'So sánh MacBook Pro M5 và MacBook Air M5',
      'Màn hình 4K đồ họa tốt nhất',
      'Xem mã giảm giá đang hoạt động',
    ];
  }

  if (actionType === 'order_tracking') {
    return [
      'Show active discount codes',
      'Warranty & free shipping policy',
      'Best laptop for coding under 35M VND',
      '4K OLED monitor for creators',
    ];
  }
  if (actionType === 'discount_loyalty' || actionType === 'policy_support') {
    return [
      'Best laptop for coding under 35M VND',
      'Compare MacBook Pro M5 vs MacBook Air M5',
      '4K OLED monitor for creators',
      'Build a complete workspace setup',
    ];
  }
  if (actionType === 'comparison') {
    return [
      'Show active promo codes for checkout',
      'Warranty & insured shipping details',
      'Recommend matching accessories & docks',
      'Show more affordable alternatives',
    ];
  }
  if (hasTwoRecs) {
    return [
      `Compare ${recommendations[0].name} vs ${recommendations[1].name}`,
      detectedCategory === 'laptops'
        ? 'Recommend an external monitor & dock for this'
        : 'Show more affordable options in this category',
      'Check active discount codes & loyalty perks',
      'Warranty & free shipping policy',
    ];
  }
  return [
    'Best laptop for coding under 35M VND',
    'Compare MacBook Pro M5 vs MacBook Air M5',
    '4K OLED monitor for creators',
    'Check active discount codes',
  ];
}

// =============================================================================
// 1. Smart Product Recommendation & Concierge Chatbot: POST /api/ai/chat
// =============================================================================
router.post('/chat', aiRateLimiter, optionalAuth, async (req, res) => {
  try {
    const {
      message,
      locale,
      category: explicitCategory,
      maxPrice: explicitMaxPrice,
      history: rawHistory,
      pageContext,
    } = req.body || {};
    const cleanMessage = String(message || '').trim();

    if (!cleanMessage) {
      return res.status(400).json({ error: 'Message is required' });
    }
    if (cleanMessage.length > 1000) {
      return res.status(400).json({ error: 'Message must not exceed 1000 characters' });
    }

    const safeHistory = Array.isArray(rawHistory) ? rawHistory.slice(-8) : [];
    const intent = parseHardwareIntent(cleanMessage, locale, safeHistory);
    const targetCategory = explicitCategory || intent.detectedCategory;
    const targetMaxPrice = explicitMaxPrice ?? intent.maxBudget;
    const targetMinPrice = intent.minBudget;
    const lowerMsg = cleanMessage.toLowerCase();

    // -------------------------------------------------------------------------
    // Branch A: Non-catalog Concierge Intents (Order Tracking, Discounts, Policies, Greeting)
    // -------------------------------------------------------------------------
    if (intent.actionType === 'greeting_help') {
      const reply = buildGreetingReply(intent.language, req.user);
      return res.json({
        reply,
        intent,
        actionBadge: intent.language === 'vi' ? 'Trợ lý AEVO Intelligence' : 'AEVO Concierge',
        recommendations: [],
        suggestedPrompts: buildContextualSuggestedPrompts(intent, []),
        engine: 'aevo-intelligence-v2',
        providerStatus: lastGeminiStatus,
        timestamp: new Date().toISOString(),
      });
    }

    if (intent.actionType === 'order_tracking') {
      const reply = await buildOrderTrackingReply(intent.language, intent.orderCode, req.user);
      return res.json({
        reply,
        intent,
        actionBadge: intent.language === 'vi' ? 'Tra cứu Đơn hàng' : 'Order Tracking',
        recommendations: [],
        suggestedPrompts: buildContextualSuggestedPrompts(intent, []),
        engine: 'aevo-intelligence-v2',
        providerStatus: lastGeminiStatus,
        timestamp: new Date().toISOString(),
      });
    }

    if (intent.actionType === 'discount_loyalty') {
      const reply = await buildDiscountLoyaltyReply(intent.language, req.user);
      return res.json({
        reply,
        intent,
        actionBadge: intent.language === 'vi' ? 'Mã giảm giá & Loyalty' : 'Promos & Loyalty',
        recommendations: [],
        suggestedPrompts: buildContextualSuggestedPrompts(intent, []),
        engine: 'aevo-intelligence-v2',
        providerStatus: lastGeminiStatus,
        timestamp: new Date().toISOString(),
      });
    }

    if (intent.actionType === 'policy_support') {
      const reply = buildPolicySupportReply(intent.language);
      return res.json({
        reply,
        intent,
        actionBadge: intent.language === 'vi' ? 'Chính sách & Bảo hành' : 'Store Policies',
        recommendations: [],
        suggestedPrompts: buildContextualSuggestedPrompts(intent, []),
        engine: 'aevo-intelligence-v2',
        providerStatus: lastGeminiStatus,
        timestamp: new Date().toISOString(),
      });
    }

    // -------------------------------------------------------------------------
    // Branch B: Multi-Category Setup / Bundle Builder
    // -------------------------------------------------------------------------
    let rawProducts = [];
    if (intent.actionType === 'setup_bundle') {
      const laptopBudget = targetMaxPrice ? Math.round(targetMaxPrice * 0.62) : undefined;
      const monitorBudget = targetMaxPrice ? Math.round(targetMaxPrice * 0.28) : undefined;
      const periphBudget = targetMaxPrice ? Math.round(targetMaxPrice * 0.12) : undefined;

      const [lapRes, monRes, perRes] = await Promise.all([
        searchProductsWithElasticsearch({
          category: 'laptops',
          brand: intent.detectedBrand || undefined,
          maxPrice: laptopBudget,
          inStock: 'true',
          sort: 'best-selling',
          limit: 2,
        }),
        searchProductsWithElasticsearch({
          category: 'monitors',
          maxPrice: monitorBudget,
          inStock: 'true',
          sort: 'best-selling',
          limit: 1,
        }),
        searchProductsWithElasticsearch({
          category: 'peripherals',
          maxPrice: periphBudget,
          inStock: 'true',
          sort: 'best-selling',
          limit: 1,
        }),
      ]);

      rawProducts = [
        ...(lapRes.products || []).slice(0, 1),
        ...(monRes.products || []).slice(0, 1),
        ...(perRes.products || []).slice(0, 1),
      ];
    }

    // -------------------------------------------------------------------------
    // Branch C: Head-to-Head Comparison Resolution
    // -------------------------------------------------------------------------
    if (intent.actionType === 'comparison' && rawProducts.length === 0) {
      // Check if user is asking to compare previous recommendations ("so sánh 2 mẫu đầu", "compare top 2")
      const lastTurnWithRecs = [...safeHistory]
        .reverse()
        .find((t) => Array.isArray(t?.recommendations) && t.recommendations.length >= 2);

      if (
        lastTurnWithRecs &&
        /(2 mẫu|hai mẫu|2 máy|hai máy|2 cái|2 sản phẩm|top 2|first two|these two|cả hai|2 con)/i.test(
          lowerMsg
        )
      ) {
        const slugs = lastTurnWithRecs.recommendations.slice(0, 2).map((r) => r.slug);
        const matchedFromHistory = [];
        for (const s of slugs) {
          const r = await searchProductsWithElasticsearch({ q: s, limit: 1 });
          if (r.products?.[0]) matchedFromHistory.push(r.products[0]);
        }
        if (matchedFromHistory.length >= 2) {
          rawProducts = matchedFromHistory;
        }
      }

      // Otherwise split comparison query by "và", "vs", "versus", "với", "hay"
      if (rawProducts.length < 2) {
        const cleanedCompare = cleanMessage
          .replace(/^(so sánh|compare|đặt lên bàn cân|khác nhau giữa|difference between)\s+/i, '')
          .trim();
        const parts = cleanedCompare
          .split(/\s+(?:và|với|vs\.?|versus|hay|and)\s+/i)
          .map((s) => s.trim())
          .filter((s) => s.length >= 2);

        if (parts.length >= 2) {
          const [resA, resB] = await Promise.all([
            searchProductsWithElasticsearch({ q: parts[0], inStock: 'true', limit: 2 }),
            searchProductsWithElasticsearch({ q: parts[1], inStock: 'true', limit: 2 }),
          ]);
          const prodA = resA.products?.[0];
          const prodB =
            resB.products?.find((p) => p.id !== prodA?.id) || resB.products?.[0];
          if (prodA && prodB && prodA.id !== prodB.id) {
            rawProducts = [prodA, prodB];
          }
        }
      }
    }

    // -------------------------------------------------------------------------
    // Branch D: Current Product Page Inquiry ("sản phẩm này", "máy này", "this product")
    // -------------------------------------------------------------------------
    if (
      rawProducts.length === 0 &&
      pageContext?.productSlug &&
      /(sản phẩm này|máy này|chiếc này|màn hình này|cấu hình này|this product|this laptop|this monitor|this item)/i.test(
        lowerMsg
      )
    ) {
      const currentProdRes = await searchProductsWithElasticsearch({
        q: String(pageContext.productSlug).replace(/-/g, ' '),
        limit: 4,
      });
      if (currentProdRes.products?.length > 0) {
        rawProducts = currentProdRes.products.slice(0, 4);
      }
    }

    // -------------------------------------------------------------------------
    // Branch E: Standard 3-Pass Elasticsearch Hardware RAG Search
    // -------------------------------------------------------------------------
    if (rawProducts.length === 0) {
      const searchQuery = intent.keywords.join(' ');
      let esResult = await searchProductsWithElasticsearch({
        q: searchQuery,
        category: targetCategory || undefined,
        brand: intent.detectedBrand || undefined,
        minPrice: targetMinPrice || undefined,
        maxPrice: targetMaxPrice || undefined,
        inStock: 'true',
        limit: 6,
      });

      // 2nd pass fallback: broaden if strict keyword + filter combination returned 0 hits
      if (!esResult.products || esResult.products.length === 0) {
        esResult = await searchProductsWithElasticsearch({
          category: targetCategory || undefined,
          brand: intent.detectedBrand || undefined,
          maxPrice: targetMaxPrice || undefined,
          inStock: 'true',
          sort: 'best-selling',
          limit: 6,
        });
      }

      // 3rd pass fallback: relax brand filter while strictly respecting maxPrice if provided
      if (!esResult.products || esResult.products.length === 0) {
        esResult = await searchProductsWithElasticsearch({
          category: targetCategory || undefined,
          maxPrice: targetMaxPrice || undefined,
          inStock: 'true',
          sort: 'best-selling',
          limit: 4,
        });
      }

      // 4th pass fallback: top best-sellers in catalog
      if (!esResult.products || esResult.products.length === 0) {
        esResult = await searchProductsWithElasticsearch({
          inStock: 'true',
          sort: 'best-selling',
          limit: 4,
        });
      }

      rawProducts = esResult.products || [];
    }

    const recommendations = rawProducts.slice(0, 4).map((p) =>
      enrichProductForAdvisor(p, {
        targetMaxPrice,
        useCase: intent.useCase,
        language: intent.language,
        queryLower: lowerMsg,
      })
    );

    let reply = null;
    let activeEngine = 'aevo-intelligence-v2';

    // Specialized deterministic builders for Comparison & Setup Bundle so tables are always crisp
    if (intent.actionType === 'comparison' && recommendations.length >= 2) {
      reply = buildComparisonReply(recommendations, intent.language);
    } else if (intent.actionType === 'setup_bundle' && recommendations.length >= 2) {
      reply = buildSetupBundleReply(recommendations, intent.language, targetMaxPrice);
    }

    // Try live Gemini RAG synthesis if GEMINI_API_KEY is active and not already built as a table
    if (!reply && GEMINI_API_KEY && recommendations.length > 0 && Date.now() >= geminiCooldownUntil) {
      const catalogContext = recommendations
        .map(
          (r, i) =>
            `${i + 1}. ${r.name} (Brand: ${r.brand}, Category: ${r.category}) - Starting Price: ${
              r.formattedPrice
            } | Recommended Variant: ${r.matchedVariantName || 'Standard'} (${
              r.formattedMatchedVariantPrice
            }) | Rating: ★${r.averageRating} | Specs: ${r.primarySpecLine}`
        )
        .join('\n');

      const historyContext =
        safeHistory.length > 0
          ? safeHistory
              .slice(-4)
              .map((h) => `${h.role === 'user' ? 'Customer' : 'AEVO Advisor'}: ${h.text}`)
              .join('\n')
          : '';

      const systemInstruction =
        intent.language === 'vi'
          ? 'Bạn là AEVO Intelligence — Chuyên gia Tư vấn Phần cứng cao cấp của AEVO Store (phong cách chuyên nghiệp như Apple Specialist / Perplexity). Trả lời bằng tiếng Việt, sử dụng Markdown rõ ràng (in đậm tên sản phẩm, giá tiền, thông số kỹ thuật, gạch đầu dòng súc tích). Chỉ tư vấn dựa trên danh sách sản phẩm thật đang sẵn hàng được cung cấp.'
          : 'You are AEVO Intelligence — Senior Hardware Specialist at AEVO Store (Apple Specialist / Perplexity caliber). Respond in English using clean Markdown (bold product names, prices, specs, concise bullet points). Base your recommendations strictly on the provided in-stock catalog context.';

      const ragPrompt =
        intent.language === 'vi'
          ? `${historyContext ? `Lịch sử hội thoại:\n${historyContext}\n\n` : ''}Khách hàng hỏi: "${cleanMessage}"\n\nDữ liệu kho hàng thực tế từ Elasticsearch:\n${catalogContext}\n\nHãy phân tích nhu cầu của khách, tư vấn chi tiết các sản phẩm trên (nêu rõ cấu hình đề xuất, giá bán, điểm mạnh kỹ thuật) và đưa ra 1 lời khuyên chọn mua chuyên sâu.`
          : `${historyContext ? `Conversation History:\n${historyContext}\n\n` : ''}Customer asked: "${cleanMessage}"\n\nLive Elasticsearch Catalog Data:\n${catalogContext}\n\nProvide an expert, structured consultation highlighting the best matching configurations, prices, technical strengths, and a concise buying tip.`;

      const geminiReply = await callGeminiGenerateContent([{ text: ragPrompt }], {
        systemInstruction,
        maxOutputTokens: 750,
      });
      if (geminiReply) {
        reply = geminiReply;
        activeEngine = `gemini-rag (${GEMINI_MODEL})`;
      }
    }

    // Fallback to AEVO Expert Consultation Synthesis v2
    if (!reply) {
      reply = buildExpertConsultationReply(
        recommendations,
        intent,
        targetCategory,
        targetMaxPrice
      );
    }

    const actionBadgeMapVi = {
      comparison: 'So sánh Thông số',
      setup_bundle: 'Thiết kế Góc làm việc',
      product_recommendation: 'Tư vấn Cấu hình Chuyên sâu',
    };
    const actionBadgeMapEn = {
      comparison: 'Spec Comparison',
      setup_bundle: 'Workspace Builder',
      product_recommendation: 'Hardware Consultation',
    };

    const suggestedPrompts = buildContextualSuggestedPrompts(intent, recommendations);

    res.json({
      reply,
      intent,
      actionBadge:
        intent.language === 'vi'
          ? actionBadgeMapVi[intent.actionType] || 'Tư vấn Cấu hình'
          : actionBadgeMapEn[intent.actionType] || 'Hardware Advisor',
      recommendations,
      suggestedPrompts,
      engine: activeEngine,
      providerStatus: lastGeminiStatus,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('AI chat error:', error);
    res.status(500).json({ error: 'Failed to process AI chat request' });
  }
});

// =============================================================================
// 2. Product Search by Image Upload: POST /api/ai/image-search
// =============================================================================
function extractImageBinaryMetadata(imageBase64 = '') {
  const raw = String(imageBase64 || '').trim();
  let mimeType = 'image/png';
  let base64Payload = raw;

  const dataUrlMatch = raw.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
  if (dataUrlMatch) {
    mimeType = dataUrlMatch[1].toLowerCase();
    base64Payload = dataUrlMatch[2];
  }

  let buffer;
  try {
    buffer = Buffer.from(base64Payload, 'base64');
  } catch {
    buffer = Buffer.alloc(0);
  }

  let width = 0;
  let height = 0;
  let format = mimeType.split('/')[1] || 'unknown';

  // Parse PNG IHDR dimensions if valid PNG signature
  if (
    buffer.length >= 24 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    format = 'png';
    width = buffer.readUInt32BE(16);
    height = buffer.readUInt32BE(20);
  } else if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    format = 'jpeg';
  } else if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    format = 'webp';
  }

  // Compute deterministic visual checksum / brightness signature from pixel bytes
  let byteSum = 0;
  const sampleStep = Math.max(1, Math.floor(buffer.length / 64));
  let samples = 0;
  for (let i = 0; i < buffer.length; i += sampleStep) {
    byteSum += buffer[i];
    samples += 1;
  }
  const avgByte = samples > 0 ? Math.round(byteSum / samples) : 128;

  return {
    format,
    mimeType,
    byteSize: buffer.length,
    width: width || 800,
    height: height || 600,
    aspectRatio: width && height ? Number((width / height).toFixed(2)) : 1.33,
    luminanceProfile: avgByte > 170 ? 'high-key-studio' : avgByte < 85 ? 'low-key-matte' : 'balanced-studio',
    signatureSeed: avgByte,
  };
}

router.post('/image-search', aiRateLimiter, async (req, res) => {
  try {
    const {
      imageBase64,
      fileName = '',
      categoryHint = '',
      queryHint = '',
      limit = 8,
    } = req.body || {};

    if (!imageBase64 && !fileName && !queryHint && !categoryHint) {
      return res.status(400).json({
        error: 'An uploaded image (imageBase64) or visual metadata is required',
      });
    }

    if (imageBase64 && String(imageBase64).length > 95000) {
      return res.status(400).json({
        error: 'Uploaded image payload exceeds maximum allowed size',
      });
    }

    if (
      String(fileName || '').length > 200 ||
      String(categoryHint || '').length > 100 ||
      String(queryHint || '').length > 200
    ) {
      return res.status(400).json({
        error: 'Image search metadata fields exceed maximum allowed length',
      });
    }

    const imageMeta = extractImageBinaryMetadata(imageBase64);
    const combinedCue = `${fileName} ${categoryHint} ${queryHint}`
      .toLowerCase()
      .replace(/\.(png|jpg|jpeg|webp|gif|svg)\b/gi, ' ')
      .replace(/[_-]+/g, ' ')
      .trim();

    let visionEngine = 'aevo-vision-search-v1';
    let geminiVisionData = null;

    // Try live Gemini Multimodal Vision classification when imageBase64 and GEMINI_API_KEY are available
    if (imageBase64 && GEMINI_API_KEY && Date.now() >= geminiCooldownUntil) {
      const raw = String(imageBase64).trim();
      const dataUrlMatch = raw.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
      const mimeType = dataUrlMatch ? dataUrlMatch[1].toLowerCase() : imageMeta.mimeType || 'image/png';
      const base64Payload = dataUrlMatch ? dataUrlMatch[2] : raw;

      const visionPrompt = `Analyze this computer hardware product image (context/filename hint: "${combinedCue}"). Return a JSON object with:
{
  "category": one of ["laptops", "monitors", "components", "storage", "peripherals", "accessories"],
  "brand": detected brand name (e.g. "Apple", "ASUS", "Dell", "LG", "Samsung", "NVIDIA", "Logitech", "Keychron") or null,
  "keywords": space-separated hardware model/type keywords,
  "visualLabels": array of 3 short descriptive hardware tags
}`;
      const geminiJsonStr = await callGeminiGenerateContent(
        [
          { text: visionPrompt },
          { inlineData: { mimeType, data: base64Payload } },
        ],
        { jsonMode: true, timeoutMs: 5000 }
      );
      if (geminiJsonStr) {
        try {
          geminiVisionData = JSON.parse(geminiJsonStr);
          visionEngine = `gemini-vision (${GEMINI_MODEL})`;
        } catch {
          geminiVisionData = null;
        }
      }
    }

    // Classify category from Gemini Vision, visual cues, filename metadata, or aspect ratio / byte signature
    let matchedCatObj = null;
    if (categoryHint) {
      matchedCatObj = CATEGORY_HINTS.find((c) => c.slug === categoryHint.toLowerCase()) || null;
    }
    if (!matchedCatObj && geminiVisionData?.category) {
      matchedCatObj =
        CATEGORY_HINTS.find((c) => c.slug === String(geminiVisionData.category).toLowerCase()) || null;
    }
    if (!matchedCatObj) {
      let bestHits = 0;
      for (const cat of CATEGORY_HINTS) {
        const hits = cat.keywords.filter((kw) => combinedCue.includes(kw)).length;
        if (hits > bestHits) {
          bestHits = hits;
          matchedCatObj = cat;
        }
      }
    }

    if (!matchedCatObj) {
      // Deterministic visual classification based on aspect ratio & image signature
      if (imageMeta.aspectRatio >= 1.7) {
        matchedCatObj = CATEGORY_HINTS.find((c) => c.slug === 'monitors');
      } else if (imageMeta.aspectRatio >= 1.35) {
        matchedCatObj = CATEGORY_HINTS.find((c) => c.slug === 'laptops');
      } else {
        const idx = imageMeta.signatureSeed % CATEGORY_HINTS.length;
        matchedCatObj = CATEGORY_HINTS[idx];
      }
    }

    // Detect brand cue if present in Gemini Vision, filename, or hint
    let detectedBrand = geminiVisionData?.brand || null;
    if (!detectedBrand) {
      for (const b of BRAND_NAMES) {
        if (combinedCue.includes(b.toLowerCase())) {
          detectedBrand = b;
          break;
        }
      }
    }

    await ensureIndexSynced();
    const safeLimit = Math.max(1, Math.min(24, parseInt(limit, 10) || 8));

    // Search Elasticsearch with detected category + optional brand/query cue
    const cleanKeywords = (geminiVisionData?.keywords || combinedCue)
      .replace(/\.(png|jpg|jpeg|webp|gif|svg)$/i, '')
      .replace(/[_-]+/g, ' ')
      .trim();

    let searchRes = await searchProductsWithElasticsearch({
      q: cleanKeywords || undefined,
      category: matchedCatObj.slug,
      brand: detectedBrand || undefined,
      limit: safeLimit,
    });

    if (!searchRes.products || searchRes.products.length === 0) {
      searchRes = await searchProductsWithElasticsearch({
        category: matchedCatObj.slug,
        limit: safeLimit,
      });
    }

    const scoredProducts = (searchRes.products || []).map((prod, idx) => {
      const similarityScore = Number(Math.max(0.74, 0.96 - idx * 0.03).toFixed(2));
      return {
        ...prod,
        similarityScore,
        visualMatchCategory: matchedCatObj.slug,
      };
    });

    res.json({
      engine: visionEngine,
      providerStatus: lastGeminiStatus,
      detectedCategory: matchedCatObj.slug,
      detectedCategoryName: matchedCatObj.labelEn,
      detectedCategoryNameVi: matchedCatObj.labelVi,
      detectedBrand,
      confidence: scoredProducts.length > 0 ? 0.92 : 0.75,
      visualLabels: Array.isArray(geminiVisionData?.visualLabels) && geminiVisionData.visualLabels.length >= 2
        ? geminiVisionData.visualLabels
        : [
            ...matchedCatObj.visualLabels,
            ...(detectedBrand ? [`Brand Cue: ${detectedBrand}`] : []),
            `Studio Profile: ${imageMeta.luminanceProfile}`,
          ],
      imageMeta,
      totalMatches: scoredProducts.length,
      products: scoredProducts,
    });
  } catch (error) {
    console.error('AI image search error:', error);
    res.status(500).json({ error: 'Failed to process image search' });
  }
});

// =============================================================================
// 3. Review Sentiment Analysis: POST /api/ai/sentiment & GET /api/ai/sentiment/product/:productId
// =============================================================================
router.post('/sentiment', aiRateLimiter, async (req, res) => {
  try {
    const { comment, text, rating, reviews } = req.body || {};

    if (Array.isArray(reviews)) {
      if (reviews.length > 50) {
        return res.status(400).json({
          error: 'Batch sentiment analysis cannot exceed 50 reviews per request',
        });
      }
      const analyzedReviews = reviews.map((r) => ({
        ...r,
        sentiment: analyzeReviewSentiment(
          String(r?.comment || r?.text || '').slice(0, 2000),
          r?.rating
        ),
      }));
      const summary = computeSentimentSummary(analyzedReviews);
      return res.json({
        summary,
        reviews: analyzedReviews,
      });
    }

    const inputComment = String(comment ?? text ?? '').trim();
    if (!inputComment && (rating === undefined || rating === null)) {
      return res.status(400).json({ error: 'Comment text or rating is required' });
    }
    if (inputComment.length > 2000) {
      return res.status(400).json({ error: 'Comment text must not exceed 2000 characters' });
    }

    const sentiment = analyzeReviewSentiment(
      inputComment,
      rating !== undefined && rating !== null ? Number(rating) : null
    );
    res.json({
      comment: inputComment,
      rating: rating ?? null,
      sentiment,
    });
  } catch (error) {
    console.error('AI sentiment analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze sentiment' });
  }
});

router.get('/sentiment/product/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const reviews = await prisma.review.findMany({
      where: { productId },
      orderBy: { createdAt: 'desc' },
    });
    const summary = computeSentimentSummary(reviews);
    res.json({
      productId,
      ...summary,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to compute product sentiment summary' });
  }
});

module.exports = router;
