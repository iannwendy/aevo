const express = require('express');
const router = express.Router();
const {
  checkEsClusterHealth,
  syncAllProductsToElasticsearch,
  searchProductsWithElasticsearch,
  suggestProductsWithElasticsearch,
  runSearchBenchmark,
} = require('../../utils/elasticsearch');

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
router.post('/reindex', async (req, res) => {
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
    const queries = req.body?.queries || (req.query.q ? [String(req.query.q)] : undefined);
    const iterations = req.body?.iterations || req.query.iterations || 8;
    const report = await runSearchBenchmark({ queries, iterations });
    res.json(report);
  } catch (error) {
    console.error('Search benchmark error:', error);
    res.status(500).json({ error: 'Failed to run search benchmark' });
  }
}

router.get('/benchmark', handleBenchmark);
router.post('/benchmark', handleBenchmark);

module.exports = router;
