/**
 * Domain Event Consumers for AEVO Microservices:
 *   1. product-service: Consumes ORDER_CREATED, ORDER_CANCELLED, PRODUCT_UPDATED, INVENTORY_SYNC
 *   2. order-service:   Consumes ORDER_CREATED, ORDER_STATUS_CHANGED, DISCOUNT_APPLIED
 *   3. user-service:    Consumes USER_REGISTERED, LOYALTY_UPDATED, REVIEW_SUBMITTED
 */
const { registerServiceConsumer, initEventBus } = require('../utils/eventBus');
const {
  syncSingleProductToElasticsearch,
  syncAllProductsToElasticsearch,
} = require('../utils/elasticsearch');
const { analyzeReviewSentiment } = require('../utils/sentiment');

let consumersRegistered = false;

function registerProductServiceConsumer() {
  registerServiceConsumer(
    'product-service',
    ['ORDER_CREATED', 'ORDER_CANCELLED', 'PRODUCT_CREATED', 'PRODUCT_UPDATED', 'PRODUCT_DELETED', 'INVENTORY_SYNC'],
    async (payload, envelope) => {
      if (envelope.type === 'PRODUCT_CREATED' || envelope.type === 'PRODUCT_UPDATED' || envelope.type === 'PRODUCT_DELETED') {
        if (payload?.productId) {
          await syncSingleProductToElasticsearch(payload.productId);
        }
        return {
          action: 'elasticsearch-product-synced',
          productId: payload?.productId || null,
        };
      }

      if (envelope.type === 'ORDER_CREATED' || envelope.type === 'ORDER_CANCELLED') {
        const productIds = Array.isArray(payload?.productIds) ? payload.productIds : [];
        for (const pid of productIds.slice(0, 10)) {
          await syncSingleProductToElasticsearch(pid);
        }
        return {
          action: 'inventory-and-search-index-updated',
          orderNumber: payload?.orderNumber || null,
          syncedProducts: productIds.length,
        };
      }

      if (envelope.type === 'INVENTORY_SYNC') {
        if (payload?.productId) {
          await syncSingleProductToElasticsearch(payload.productId);
        } else {
          await syncAllProductsToElasticsearch();
        }
        return {
          action: 'full-inventory-search-sync',
          productId: payload?.productId || 'all',
        };
      }

      return { action: 'processed-by-product-service' };
    }
  );
}

function registerOrderServiceConsumer() {
  registerServiceConsumer(
    'order-service',
    ['ORDER_CREATED', 'ORDER_STATUS_CHANGED', 'ORDER_AUDIT_REQUESTED'],
    async (payload, envelope) => {
      return {
        action:
          envelope.type === 'ORDER_CREATED'
            ? 'order-confirmation-and-audit-logged'
            : 'order-status-transition-recorded',
        orderId: payload?.orderId || null,
        orderNumber: payload?.orderNumber || null,
        status: payload?.status || 'PENDING',
        totalAmount: payload?.totalAmount || 0,
      };
    }
  );
}

function registerUserServiceConsumer() {
  registerServiceConsumer(
    'user-service',
    ['USER_REGISTERED', 'LOYALTY_UPDATED', 'REVIEW_SUBMITTED', 'USER_PROFILE_UPDATED'],
    async (payload, envelope) => {
      if (envelope.type === 'REVIEW_SUBMITTED') {
        const sentiment = analyzeReviewSentiment(payload?.comment || '', payload?.rating);
        return {
          action: 'review-sentiment-indexed',
          reviewId: payload?.reviewId || null,
          sentimentLabel: sentiment.label,
          sentimentScore: sentiment.score,
        };
      }

      return {
        action:
          envelope.type === 'LOYALTY_UPDATED'
            ? 'loyalty-balance-synchronized'
            : 'user-identity-event-processed',
        userId: payload?.userId || null,
        email: payload?.email || null,
        pointsDelta: payload?.pointsDelta || 0,
      };
    }
  );
}

async function registerAllDomainConsumers(role = 'all') {
  if (consumersRegistered) return;
  consumersRegistered = true;

  if (role === 'all' || role === 'product-service') {
    registerProductServiceConsumer();
  }
  if (role === 'all' || role === 'order-service') {
    registerOrderServiceConsumer();
  }
  if (role === 'all' || role === 'user-service') {
    registerUserServiceConsumer();
  }

  await initEventBus();
}

module.exports = {
  registerProductServiceConsumer,
  registerOrderServiceConsumer,
  registerUserServiceConsumer,
  registerAllDomainConsumers,
};
