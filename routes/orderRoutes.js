const express = require('express');
const {
  createOrder,
  getOrders,
  getUserOrders,
  updateOrderStatus
} = require('../controllers/orderController');
const { protect} = require('../middlewares/authMiddleware');

const router = express.Router();

router.route('/')
  .post(protect, createOrder)
  .get(protect, getOrders);

router.route('/user')
  .get(protect, getUserOrders);

router.route('/:id')
  .put(protect,updateOrderStatus);

module.exports = router;