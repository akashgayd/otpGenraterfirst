const express = require('express');
const {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart
} = require('../controllers/cartController');
// const { protect } = require('../middlewares/authMiddleware');

const router = express.Router();

router.route('/')
  .get( getCart);

router.route('/add')
  .post( addToCart);

router.route('/update/:id')
  .put( updateCartItem);

router.route('/:id')
  .delete(removeFromCart);

module.exports = router;