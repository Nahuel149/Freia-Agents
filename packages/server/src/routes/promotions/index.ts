import express from 'express'
import promotionsController from '../../controllers/promotions'

const router = express.Router()

// GET /api/v1/promotions/complementary - Complementary add-ons
router.get('/complementary', promotionsController.getComplementaryPromotions)

// GET /api/v1/promotions/seasonal - Seasonal promotions
router.get('/seasonal', promotionsController.getSeasonalPromotions)

// GET /api/v1/promotions/bundles - Bundle offers
router.get('/bundles', promotionsController.getBundleOffers)

// GET /api/v1/promotions/clearance - Clearance catalog
router.get('/clearance', promotionsController.getClearancePromotions)

// GET /api/v1/promotions/cross-sell - Cross-sell recommendations
router.get('/cross-sell', promotionsController.getCrossSellRecommendations)

// GET /api/v1/promotions/loyalty - Loyalty rewards summary
router.get('/loyalty', promotionsController.getLoyaltyRewards)

// GET /api/v1/promotions/analytics - Promotion analytics
router.get('/analytics', promotionsController.getPromotionsAnalytics)

// POST /api/v1/promotions/apply-code - Apply promo code to quote
router.post('/apply-code', promotionsController.applyPromoCode)

// POST /api/v1/promotions/custom-bundle - Create custom bundle
router.post('/custom-bundle', promotionsController.createCustomBundle)

// POST /api/v1/promotions/campaign - Create promotional campaign
router.post('/campaign', promotionsController.createPromotionalCampaign)

export default router
