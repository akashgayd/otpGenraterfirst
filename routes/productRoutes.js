const express = require('express');
const {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct
} = require('../controllers/productController');
const { protect} = require('../middlewares/authMiddleware');

const router = express.Router();

router.route('/')
  .get(getProducts)
  .post(protect,  createProduct);

router.route('/:id')
  .get(getProduct)
  .put(protect, updateProduct)
  .delete(protect,  deleteProduct);

module.exports = router;
