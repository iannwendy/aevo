/**
 * AEVO Hardware Review Sentiment Analysis Engine (Bilingual EN + VI)
 * Analyzes customer comments and star ratings for computer & PC component reviews,
 * extracting polarity (POSITIVE / NEUTRAL / NEGATIVE), normalized score (-1..+1),
 * confidence (0..1), and hardware-specific aspects (performance, thermals, display, etc.).
 */

const POSITIVE_LEXICON = [
  // English positive hardware terms
  { term: 'excellent', weight: 1.8 },
  { term: 'outstanding', weight: 1.9 },
  { term: 'amazing', weight: 1.8 },
  { term: 'fantastic', weight: 1.8 },
  { term: 'superb', weight: 1.8 },
  { term: 'awesome', weight: 1.6 },
  { term: 'perfect', weight: 1.9 },
  { term: 'great', weight: 1.4 },
  { term: 'good', weight: 1.1 },
  { term: 'solid', weight: 1.3 },
  { term: 'smooth', weight: 1.4 },
  { term: 'fast', weight: 1.3 },
  { term: 'blazing', weight: 1.7 },
  { term: 'snappy', weight: 1.4 },
  { term: 'quiet', weight: 1.4 },
  { term: 'silent', weight: 1.5 },
  { term: 'cool', weight: 1.2 },
  { term: 'crisp', weight: 1.4 },
  { term: 'sharp', weight: 1.3 },
  { term: 'vibrant', weight: 1.4 },
  { term: 'bright', weight: 1.1 },
  { term: 'premium', weight: 1.4 },
  { term: 'sturdy', weight: 1.3 },
  { term: 'reliable', weight: 1.4 },
  { term: 'worth', weight: 1.4 },
  { term: 'recommend', weight: 1.6 },
  { term: 'recommended', weight: 1.6 },
  { term: 'love', weight: 1.6 },
  { term: 'impressed', weight: 1.5 },
  { term: 'impressive', weight: 1.5 },
  { term: 'best', weight: 1.6 },
  { term: 'responsive', weight: 1.3 },
  { term: 'stable', weight: 1.3 },
  { term: 'powerful', weight: 1.4 },
  { term: 'efficient', weight: 1.3 },
  // Vietnamese positive hardware terms
  { term: 'tuyệt vời', weight: 1.9 },
  { term: 'xuất sắc', weight: 1.9 },
  { term: 'hoàn hảo', weight: 1.9 },
  { term: 'rất tốt', weight: 1.7 },
  { term: 'quá tốt', weight: 1.7 },
  { term: 'cực tốt', weight: 1.8 },
  { term: 'đáng tiền', weight: 1.8 },
  { term: 'đáng mua', weight: 1.7 },
  { term: 'hài lòng', weight: 1.7 },
  { term: 'ưng ý', weight: 1.6 },
  { term: 'mượt mà', weight: 1.6 },
  { term: 'mượt', weight: 1.4 },
  { term: 'nhanh', weight: 1.3 },
  { term: 'mạnh mẽ', weight: 1.5 },
  { term: 'mạnh', weight: 1.2 },
  { term: 'mát mẻ', weight: 1.5 },
  { term: 'mát', weight: 1.3 },
  { term: 'êm ái', weight: 1.5 },
  { term: 'êm', weight: 1.3 },
  { term: 'sắc nét', weight: 1.6 },
  { term: 'đẹp', weight: 1.3 },
  { term: 'chắc chắn', weight: 1.4 },
  { term: 'bền', weight: 1.3 },
  { term: 'ổn định', weight: 1.4 },
  { term: 'chất lượng', weight: 1.4 },
  { term: 'cao cấp', weight: 1.3 },
  { term: 'tốt', weight: 1.1 },
  { term: 'ngon', weight: 1.3 },
  { term: 'thích', weight: 1.2 },
];

const NEGATIVE_LEXICON = [
  // English negative hardware terms
  { term: 'terrible', weight: -1.9 },
  { term: 'horrible', weight: -1.9 },
  { term: 'awful', weight: -1.8 },
  { term: 'worst', weight: -1.9 },
  { term: 'defective', weight: -2.0 },
  { term: 'broken', weight: -1.9 },
  { term: 'dead', weight: -1.8 },
  { term: 'crash', weight: -1.6 },
  { term: 'crashes', weight: -1.6 },
  { term: 'bsod', weight: -1.7 },
  { term: 'overheat', weight: -1.7 },
  { term: 'overheating', weight: -1.8 },
  { term: 'hot', weight: -1.1 },
  { term: 'noisy', weight: -1.4 },
  { term: 'loud', weight: -1.3 },
  { term: 'coil whine', weight: -1.5 },
  { term: 'slow', weight: -1.4 },
  { term: 'lag', weight: -1.5 },
  { term: 'laggy', weight: -1.5 },
  { term: 'stutter', weight: -1.4 },
  { term: 'expensive', weight: -0.9 },
  { term: 'overpriced', weight: -1.4 },
  { term: 'disappointed', weight: -1.7 },
  { term: 'disappointing', weight: -1.7 },
  { term: 'poor', weight: -1.5 },
  { term: 'bad', weight: -1.4 },
  { term: 'flimsy', weight: -1.4 },
  { term: 'flicker', weight: -1.5 },
  { term: 'bleed', weight: -1.2 },
  { term: 'waste', weight: -1.7 },
  { term: 'useless', weight: -1.8 },
  { term: 'avoid', weight: -1.7 },
  // Vietnamese negative hardware terms
  { term: 'thất vọng', weight: -1.8 },
  { term: 'tệ', weight: -1.7 },
  { term: 'quá tệ', weight: -1.9 },
  { term: 'kém', weight: -1.5 },
  { term: 'lỗi', weight: -1.7 },
  { term: 'hỏng', weight: -1.9 },
  { term: 'hư', weight: -1.8 },
  { term: 'nóng', weight: -1.3 },
  { term: 'quá nóng', weight: -1.7 },
  { term: 'ồn', weight: -1.3 },
  { term: 'kêu to', weight: -1.5 },
  { term: 'giật lag', weight: -1.7 },
  { term: 'giật', weight: -1.4 },
  { term: 'chậm', weight: -1.4 },
  { term: 'đắt', weight: -0.9 },
  { term: 'không đáng', weight: -1.7 },
  { term: 'phí tiền', weight: -1.8 },
  { term: 'hở sáng', weight: -1.3 },
  { term: 'nhấp nháy', weight: -1.4 },
  { term: 'yếu', weight: -1.3 },
  { term: 'chán', weight: -1.4 },
];

const NEGATION_WORDS = new Set([
  'not',
  'no',
  'never',
  'neither',
  'hardly',
  'barely',
  'without',
  "don't",
  "doesn't",
  "didn't",
  "isn't",
  "wasn't",
  "aren't",
  'không',
  'chẳng',
  'chưa',
  'đừng',
]);

const ASPECT_PATTERNS = [
  {
    aspect: 'performance',
    keywords: [
      'performance', 'speed', 'fast', 'slow', 'fps', 'render', 'benchmark', 'cpu', 'gpu', 'ram', 'multitask', 'snappy', 'lag',
      'hiệu năng', 'tốc độ', 'nhanh', 'chậm', 'mượt', 'xử lý', 'cấu hình', 'render', 'chiến game',
    ],
  },
  {
    aspect: 'thermals',
    keywords: [
      'thermal', 'thermals', 'temperature', 'temp', 'cool', 'cooling', 'hot', 'overheat', 'fan', 'quiet', 'silent', 'noisy', 'airflow',
      'nhiệt độ', 'tản nhiệt', 'mát', 'nóng', 'quạt', 'êm', 'ồn',
    ],
  },
  {
    aspect: 'display',
    keywords: [
      'screen', 'display', 'panel', 'oled', 'ips', 'color', 'brightness', 'hdr', 'refresh', 'hz', 'resolution', '4k', 'pixel', 'crisp',
      'màn hình', 'hiển thị', 'màu sắc', 'độ sáng', 'sắc nét', 'tần số quét', 'hở sáng',
    ],
  },
  {
    aspect: 'build_quality',
    keywords: [
      'build', 'quality', 'chassis', 'aluminum', 'cnc', 'sturdy', 'solid', 'design', 'keyboard', 'trackpad', 'hinge', 'finish', 'durable',
      'thiết kế', 'hoàn thiện', 'vỏ nhôm', 'chắc chắn', 'bền', 'bàn phím', 'ngoại hình',
    ],
  },
  {
    aspect: 'value',
    keywords: [
      'price', 'value', 'worth', 'money', 'budget', 'expensive', 'cheap', 'deal', 'cost',
      'giá', 'đáng tiền', 'đáng mua', 'rẻ', 'đắt', 'chi phí', 'hợp lý',
    ],
  },
  {
    aspect: 'battery',
    keywords: [
      'battery', 'charge', 'charging', 'power', 'adapter', 'endurance',
      'pin', 'thời lượng pin', 'sạc', 'tiết kiệm điện',
    ],
  },
];

function normalizeText(text = '') {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function analyzeReviewSentiment(comment = '', rating = null) {
  const normalized = normalizeText(comment);
  const words = normalized ? normalized.split(' ') : [];

  let lexScore = 0;
  let matchCount = 0;
  const positiveTokens = [];
  const negativeTokens = [];

  if (normalized) {
    // Check phrase & word matches
    const checkList = (lexicon, isPositive) => {
      for (const entry of lexicon) {
        const { term, weight } = entry;
        const idx = normalized.indexOf(term);
        if (idx === -1) continue;

        // Ensure word boundary around term
        const beforeChar = idx > 0 ? normalized[idx - 1] : ' ';
        const afterIdx = idx + term.length;
        const afterChar = afterIdx < normalized.length ? normalized[afterIdx] : ' ';
        if (beforeChar !== ' ' || afterChar !== ' ') continue;

        // Check preceding 1-2 words for negation (e.g. "không nóng", "not bad")
        const prefixWords = normalized.slice(0, idx).trim().split(' ').filter(Boolean);
        const prevWord = prefixWords[prefixWords.length - 1] || '';
        const prevPrevWord = prefixWords[prefixWords.length - 2] || '';
        const isNegated = NEGATION_WORDS.has(prevWord) || NEGATION_WORDS.has(prevPrevWord);

        if (isNegated) {
          // Negating a negative word ("không nóng", "không lỗi", "not bad") makes it mildly positive
          // Negating a positive word ("không tốt", "not great") makes it negative
          const invertedWeight = isPositive ? -Math.abs(weight) * 0.85 : Math.abs(weight) * 0.65;
          lexScore += invertedWeight;
          matchCount += 1;
          if (invertedWeight > 0) {
            positiveTokens.push(`${prevWord} ${term}`.trim());
          } else {
            negativeTokens.push(`${prevWord} ${term}`.trim());
          }
        } else {
          lexScore += weight;
          matchCount += 1;
          if (isPositive) {
            positiveTokens.push(term);
          } else {
            negativeTokens.push(term);
          }
        }
      }
    };

    checkList(POSITIVE_LEXICON, true);
    checkList(NEGATIVE_LEXICON, false);
  }

  // Normalize text score to [-1, 1]
  let textScore = 0;
  if (matchCount > 0) {
    textScore = Math.max(-1, Math.min(1, lexScore / (Math.sqrt(matchCount) * 1.8)));
  }

  // Factor in star rating if provided (1..5 -> -1..+1)
  const hasValidRating = typeof rating === 'number' && rating >= 1 && rating <= 5;
  const ratingScore = hasValidRating ? (rating - 3) / 2 : null;

  let finalScore = textScore;
  if (hasValidRating && normalized.length > 0) {
    // If text had explicit sentiment matches, blend 65% text + 35% rating; otherwise rely on rating
    finalScore = matchCount > 0 ? textScore * 0.65 + ratingScore * 0.35 : ratingScore;
  } else if (hasValidRating) {
    finalScore = ratingScore;
  }

  finalScore = Number(Math.max(-1, Math.min(1, finalScore)).toFixed(2));

  let label = 'NEUTRAL';
  if (finalScore >= 0.2) {
    label = 'POSITIVE';
  } else if (finalScore <= -0.2) {
    label = 'NEGATIVE';
  }

  // Detect mentioned hardware aspects
  const aspects = [];
  if (normalized) {
    for (const group of ASPECT_PATTERNS) {
      if (group.keywords.some((kw) => normalized.includes(kw))) {
        aspects.push(group.aspect);
      }
    }
  }

  const confidence = Number(
    Math.min(
      0.99,
      Math.max(
        0.55,
        0.6 + Math.min(0.3, Math.abs(finalScore) * 0.3) + (matchCount > 0 ? 0.08 : 0)
      )
    ).toFixed(2)
  );

  return {
    label,
    score: finalScore,
    confidence,
    aspects,
    positiveTokens: positiveTokens.slice(0, 5),
    negativeTokens: negativeTokens.slice(0, 5),
    wordCount: words.length,
  };
}

function enrichReviewWithSentiment(review) {
  if (!review) return review;
  const sentiment = review.sentiment || analyzeReviewSentiment(review.comment, review.rating);
  return {
    ...review,
    sentiment,
  };
}

function computeSentimentSummary(reviews = []) {
  const enriched = reviews.map(enrichReviewWithSentiment);
  const totalAnalyzed = enriched.length;

  if (totalAnalyzed === 0) {
    return {
      totalAnalyzed: 0,
      positiveCount: 0,
      neutralCount: 0,
      negativeCount: 0,
      positiveRate: 0,
      neutralRate: 0,
      negativeRate: 0,
      averageSentimentScore: 0,
      overallSentiment: 'NEUTRAL',
      topAspects: [],
    };
  }

  let positiveCount = 0;
  let neutralCount = 0;
  let negativeCount = 0;
  let scoreSum = 0;
  const aspectMap = new Map();

  for (const rev of enriched) {
    const s = rev.sentiment;
    scoreSum += s.score;
    if (s.label === 'POSITIVE') positiveCount += 1;
    else if (s.label === 'NEGATIVE') negativeCount += 1;
    else neutralCount += 1;

    for (const aspect of s.aspects || []) {
      const prev = aspectMap.get(aspect) || {
        aspect,
        count: 0,
        positiveCount: 0,
        negativeCount: 0,
      };
      prev.count += 1;
      if (s.label === 'POSITIVE') prev.positiveCount += 1;
      if (s.label === 'NEGATIVE') prev.negativeCount += 1;
      aspectMap.set(aspect, prev);
    }
  }

  const avgScore = Number((scoreSum / totalAnalyzed).toFixed(2));
  let overallSentiment = 'NEUTRAL';
  if (avgScore >= 0.2 || positiveCount > negativeCount + neutralCount) {
    overallSentiment = 'POSITIVE';
  } else if (avgScore <= -0.2 || negativeCount > positiveCount) {
    overallSentiment = 'NEGATIVE';
  }

  const topAspects = Array.from(aspectMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    totalAnalyzed,
    positiveCount,
    neutralCount,
    negativeCount,
    positiveRate: Math.round((positiveCount / totalAnalyzed) * 100),
    neutralRate: Math.round((neutralCount / totalAnalyzed) * 100),
    negativeRate: Math.round((negativeCount / totalAnalyzed) * 100),
    averageSentimentScore: avgScore,
    overallSentiment,
    topAspects,
  };
}

module.exports = {
  analyzeReviewSentiment,
  enrichReviewWithSentiment,
  computeSentimentSummary,
};
