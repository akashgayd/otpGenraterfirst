const Order = require('../models/Order');
const Cart = require('../models/Cart');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middlewares/async');

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
exports.createOrder = asyncHandler(async (req, res, next) => {
  const { shippingAddress, paymentMethod } = req.body;
  
  // Get user cart
  const cart = await Cart.findOne({ user: req.id }).populate('items.product');
  if (!cart || cart.items.length === 0) {
    return next(new ErrorResponse('No items in cart', 400));
  }
  
  // Check product availability
  for (const item of cart.items) {
    const product = await Product.findById(item.product._id);
    if (product.stock < item.quantity) {
      return next(new ErrorResponse(`Not enough stock for ${product.name}`, 400));
    }
  }
  
  // Create order items
  const orderItems = cart.items.map(item => ({
    product: item.product._id,
    quantity: item.quantity,
    price: item.price
  }));
  
  // Calculate prices
  const itemsPrice = cart.total;
  const taxPrice = itemsPrice * 0.1; // Example 10% tax
  const shippingPrice = itemsPrice > 100 ? 0 : 10; // Free shipping over $100
  const totalPrice = itemsPrice + taxPrice + shippingPrice;
  
  // Create order
  const order = new Order({
    user: req.user.id,
    items: orderItems,
    shippingAddress,
    paymentMethod,
    itemsPrice,
    taxPrice,
    shippingPrice,
    totalPrice
  });
  
  // Save order
  const createdOrder = await order.save();
  
  // Update product stock
  for (const item of cart.items) {
    const product = await Product.findById(item.product._id);
    product.stock -= item.quantity;
    await product.save();
  }
  
  // Clear cart
  await Cart.findByIdAndDelete(cart._id);
  
  res.status(201).json(createdOrder);
});

// @desc    Get all orders (admin)
// @route   GET /api/orders
// @access  Private/Admin
exports.getOrders = asyncHandler(async (req, res, next) => {
  const orders = await Order.find({}).populate( 'name email');
  res.json(orders);
});

// @desc    Get user orders
// @route   GET /api/orders/user
// @access  Private
exports.getUserOrders = asyncHandler(async (req, res, next) => {
  const orders = await Order.find({ user: req.id });
  res.json(orders);
});

// @desc    Update order status
// @route   PUT /api/orders/:id
// @access  Private/Admin
exports.updateOrderStatus = asyncHandler(async (req, res, next) => {
  const { status } = req.body;
  
  const order = await Order.findById(req.params.id);
  if (!order) {
    return next(new ErrorResponse('Order not found', 404));
  }
  
  // Check if order is already delivered
  if (order.status === 'delivered') {
    return next(new ErrorResponse('Order already delivered', 400));
  }
  
  order.status = status;
  
  if (status === 'delivered') {
    order.deliveredAt = Date.now();
    order.isDelivered = true;
  }
  
  await order.save();
  
  res.json(order);
});