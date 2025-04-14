const express = require('express');
const {
  getWishlist,
  addToWishlist,
  removeFromWishlist
} = require('../controllers/wishlistController');
// const { protect } = require('../middlewares/authMiddleware');

const router = express.Router();

router.route('/')
  .get( getWishlist);

router.route('/add')
  .post( addToWishlist);

router.route('/:id')
  .delete( removeFromWishlist);

module.exports = router;