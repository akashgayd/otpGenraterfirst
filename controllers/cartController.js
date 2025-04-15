const Cart = require('../models/Cart');
const Product = require('../models/product');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middlewares/async');

// @desc    Get user cart
// @route   GET /api/cart
// @access  Private
exports.getCart = asyncHandler(async (req, res, next) => {
  const cart = await Cart.findOne({ user: req.user.id }).populate('items.product');
  
  if (!cart) {
    return res.json({ items: [], total: 0 });
  }
  
  res.json(cart);
});

// @desc    Add item to cart
// @route   POST /api/cart/add
// @access  Private
exports.addToCart = asyncHandler(async (req, res, next) => {
  const { productId, quantity } = req.body;
  
  const product = await Product.findById(productId);
  if (!product) {
    return next(new ErrorResponse('Product not found', 404));
  }
  
  if (product.stock < quantity) {
    return next(new ErrorResponse('Not enough stock available', 400));
  }
  
  let cart = await Cart.findOne({ user: req.user.id });
  
  if (!cart) {
    // Create new cart
    cart = new Cart({
      user: req.user.id,
      items: [{
        product: productId,
        quantity,
        price: product.price
      }]
    });
  } else {
    // Check if product already in cart
    const itemIndex = cart.items.findIndex(item => item.product.toString() === productId);
    
    if (itemIndex > -1) {
      // Update quantity if product exists
      cart.items[itemIndex].quantity += quantity;
    } else {
      // Add new item
      cart.items.push({
        product: productId,
        quantity,
        price: product.price
      });
    }
  }
  
  await cart.save();
  await cart.populate('items.product').execPopulate();
  
  res.json(cart);
});

// @desc    Update cart item quantity
// @route   PUT /api/cart/update/:id
// @access  Private
exports.updateCartItem = asyncHandler(async (req, res, next) => {
  const { quantity } = req.body;
  
  const cart = await Cart.findOne({ user: req.user.id });
  if (!cart) {
    return next(new ErrorResponse('Cart not found', 404));
  }
  
  const itemIndex = cart.items.findIndex(item => item._id.toString() === req.params.id);
  if (itemIndex === -1) {
    return next(new ErrorResponse('Item not found in cart', 404));
  }
  
  const product = await Product.findById(cart.items[itemIndex].product);
  if (product.stock < quantity) {
    return next(new ErrorResponse('Not enough stock available', 400));
  }
  
  cart.items[itemIndex].quantity = quantity;
  await cart.save();
  await cart.populate('items.product');
  
  res.json(cart);
});

// @desc    Remove item from cart
// @route   DELETE /api/cart/:id
// @access  Private
exports.removeFromCart = asyncHandler(async (req, res, next) => {
  const cart = await Cart.findOne({ user: req.user.id });
  
  if (!cart) {
    return next(new ErrorResponse('Cart not found', 404));
  }
  
  const itemIndex = cart.items.findIndex(item => item._id.toString() === req.params.id);
  if (itemIndex === -1) {
    return next(new ErrorResponse('Item not found in cart', 404));
  }
  
  cart.items.splice(itemIndex, 1);
  await cart.save();
  await cart.populate('items.product').execPopulate();
  
  res.json(cart);
});