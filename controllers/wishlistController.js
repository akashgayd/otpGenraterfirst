const Wishlist = require('../models/Wishlist');
const Product = require('../models/product');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middlewares/async');

// @desc    Get user wishlist
// @route   GET /api/wishlist
// @access  Private
exports.getWishlist = asyncHandler(async (req, res, next) => {
  const wishlist = await Wishlist.findOne({ user: req.user.id }).populate('products');
  
  if (!wishlist) {
    return res.json({ products: [] });
  }
  
  res.json(wishlist);
});

// @desc    Add product to wishlist
// @route   POST /api/wishlist/add
// @access  Private
exports.addToWishlist = asyncHandler(async (req, res, next) => {
  const { productId } = req.body;
  
  const product = await Product.findById(productId);
  if (!product) {
    return next(new ErrorResponse('Product not found', 404));
  }
  
  let wishlist = await Wishlist.findOne({ user: req.user.id });
  
  if (!wishlist) {
    // Create new wishlist
    wishlist = await Wishlist.create({
      user: req.user.id,
      products: [productId]
    });
  } else {
    // Check if product already in wishlist
    if (wishlist.products.includes(productId)) {
      return next(new ErrorResponse('Product already in wishlist', 400));
    }
    
    wishlist.products.push(productId);
    await wishlist.save();
  }
  
  await wishlist.populate('products').execPopulate();
  
  res.json(wishlist);
});

// @desc    Remove product from wishlist
// @route   DELETE /api/wishlist/:id
// @access  Private
exports.removeFromWishlist = asyncHandler(async (req, res, next) => {
  const wishlist = await Wishlist.findOne({ user: req.user.id });
  
  if (!wishlist) {
    return next(new ErrorResponse('Wishlist not found', 404));
  }
  
  const productIndex = wishlist.products.findIndex(
    product => product.toString() === req.params.id
  );
  
  if (productIndex === -1) {
    return next(new ErrorResponse('Product not found in wishlist', 404));
  }
  
  wishlist.products.splice(productIndex, 1);
  await wishlist.save();
  await wishlist.populate('products').execPopulate();
  
  res.json(wishlist);
});