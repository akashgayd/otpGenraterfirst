const express = require('express');
const router = express.Router();
const {
  createCategory,
  getCategories,
  getCategory,
  updateCategory,
  deleteCategory,
  getSubcategories,
  getCategoryTree
} = require('../controllers/categoryController');

// Re-ordered routes to avoid conflicts
router.get('/tree', getCategoryTree);
router.get('/parent/:parentId', getSubcategories);

router.route('/')
  .post(createCategory)
  .get(getCategories);

router.route('/:id')
  .get(getCategory)
  .put(updateCategory)
  .delete(deleteCategory);

module.exports = router;