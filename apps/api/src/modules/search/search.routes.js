const express = require('express');
const router = express.Router();
const {
  checkEsClusterHealth,
  syncAllProductsToElasticsearch,
  searchProductsWithElasticsearch,
  suggestProductsWithElasticsearch,
  runSearchBenchmark,
} = require('../../utils/elasticsearch');
const { rateLimit } = require('../../middleware/rateLimit');

const heavySearchOpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Too many search reindex or benchmark requests, please try again later',
});

// GET /api/search/health — Elasticsearch cluster health & index status
router.get('/health', async (req, res) => {
  try {
    const health = await checkEsClusterHealth();
    res.json(health);
  } catch (error) {
    res.status(500).json({ error: 'Failed to check Elasticsearch health' });
  }
});

// GET /api/search or GET /api/search/elasticsearch — Elasticsearch BM25 + Fuzzy Search
async function handleEsSearch(req, res) {
  try {
    const rawQ = String(req.query.q || req.query.search || '');
    if (rawQ.length > 200) {
      return res.status(400).json({ error: 'Search query must not exceed 200 characters' });
    }
    const result = await searchProductsWithElasticsearch(req.query);
    res.json(result);
  } catch (error) {
    console.error('Elasticsearch search error:', error);
    res.status(500).json({ error: 'Failed to execute Elasticsearch query' });
  }
}

router.get('/', handleEsSearch);
router.get('/elasticsearch', handleEsSearch);

// GET /api/search/suggest — Instant autocomplete suggestions
router.get('/suggest', async (req, res) => {
  try {
    const q = String(req.query.q || req.query.search || '').trim();
    if (q.length > 200) {
      return res.status(400).json({ error: 'Search suggestion query must not exceed 200 characters' });
    }
    const limit = Math.max(1, Math.min(20, parseInt(req.query.limit, 10) || 6));
    const suggestions = await suggestProductsWithElasticsearch(q, limit);
    res.json({
      query: q,
      suggestions,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch search suggestions' });
  }
});

// POST /api/search/reindex — Synchronize all PostgreSQL products into Elasticsearch
router.post('/reindex', heavySearchOpLimiter, async (req, res) => {
  try {
    const stats = await syncAllProductsToElasticsearch();
    res.json({
      status: 'ok',
      message: 'Products synchronized with Elasticsearch index',
      ...stats,
    });
  } catch (error) {
    console.error('Elasticsearch reindex error:', error);
    res.status(500).json({ error: 'Failed to reindex products' });
  }
});

// GET /api/search/benchmark & POST /api/search/benchmark — Elasticsearch vs PostgreSQL comparison
async function handleBenchmark(req, res) {
  try {
    if (Array.isArray(req.body?.queries) && req.body.queries.length > 10) {
      return res.status(400).json({ error: 'Benchmark queries array cannot exceed 10 items' });
    }
    const queries = req.body?.queries || (req.query.q ? [String(req.query.q)] : undefined);
    const iterations = req.body?.iterations || req.query.iterations || 8;
    const report = await runSearchBenchmark({ queries, iterations });
    res.json(report);
  } catch (error) {
    console.error('Search benchmark error:', error);
    res.status(500).json({ error: 'Failed to run search benchmark' });
  }
}

router.get('/benchmark', heavySearchOpLimiter, handleBenchmark);
router.post('/benchmark', heavySearchOpLimiter, handleBenchmark);

module.exports = router;
