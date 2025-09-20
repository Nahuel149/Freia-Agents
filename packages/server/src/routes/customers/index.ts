import express from 'express'
import customersController from '../../controllers/customers'

const router = express.Router()

// GET /api/v1/customers - Get all customers with pagination
router.get('/', customersController.getAllCustomers)

// GET /api/v1/customers/search - Search customers
router.get('/search', customersController.searchCustomers)

// GET /api/v1/customers/stats - Get customer statistics
router.get('/stats', customersController.getCustomerStats)

// GET /api/v1/customers/recent - Get recent customers
router.get('/recent', customersController.getRecentCustomers)

// GET /api/v1/customers/phone/:phone - Get customer by phone number
router.get('/phone/:phone', customersController.getCustomerByPhone)

// GET /api/v1/customers/:id - Get specific customer by ID
router.get('/:id', customersController.getCustomerById)

// POST /api/v1/customers - Create new customer
router.post('/', customersController.createCustomer)

// PUT /api/v1/customers/:id - Update customer
router.put('/:id', customersController.updateCustomer)

export default router