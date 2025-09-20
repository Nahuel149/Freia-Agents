import express from 'express'
import productsController from '../../controllers/products'

const router = express.Router()

// GET /api/v1/products - Get all products with pagination and filters
router.get('/', productsController.getAllProducts)

// GET /api/v1/products/stats - Get product statistics
router.get('/stats', productsController.getProductStats)

// GET /api/v1/products/categories - Get all categories
router.get('/categories', productsController.getCategories)

// GET /api/v1/products/brands - Get all brands
router.get('/brands', productsController.getBrands)

// GET /api/v1/products/search - Search products
router.get('/search', productsController.searchProducts)

// GET /api/v1/products/:productId - Get product by ID
router.get('/:productId', productsController.getProductById)

// POST /api/v1/products - Create new product
router.post('/', productsController.createProduct)

// PUT /api/v1/products/:productId - Update product
router.put('/:productId', productsController.updateProduct)

export default router