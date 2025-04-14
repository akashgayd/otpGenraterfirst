require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const errorHandler = require('./middlewares/errorMiddleware');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');

// Initialize Express
const app = express();

// Connect to database
connectDB();

// Middleware
app.use(express.json());
app.use(cors());

// Rate limiting to avoid abuse
const limiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 mins
  max: 100,  // Limit to 100 requests per windowMs
});
app.use(limiter);

// Routes
const products = require('./routes/productRoutes');
const cart = require('./routes/cartRoutes');
const wishlist = require('./routes/wishlistRoutes');
const orders = require('./routes/orderRoutes');
const auth = require('./routes/authRoutes');
const taskRoutes = require('./routes/taskRoutes');
const categoryRoutes = require('./routes/categoryRoutes');

// Enable morgan logging in development environment
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// API Routes
app.use('/api/v1/auth', auth);
app.use('/api/v1/tasks', taskRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/products', products);
app.use('/api/v1/cart', cart);
app.use('/api/v1/wishlist', wishlist);
app.use('/api/v1/orders', orders);

// Combined Home Route
app.get('/', (req, res) => {
  res.json({
    message: 'API for Task, Category, Product, Cart, Wishlist, and Order Management',
    version: '1.0.0',
    endpoints: [
      'POST /api/v1/categories - Create a category',
      'GET /api/v1/categories - Get all categories with filtering & pagination',
      'GET /api/v1/categories/:id - Get a category by ID',
      'PUT /api/v1/categories/:id - Update a category',
      'DELETE /api/v1/categories/:id - Delete a category',
      'GET /api/v1/categories/parent/:parentId - Get subcategories by parent ID',
      'GET /api/v1/categories/tree - Get category tree structure',
      'POST /api/v1/auth - Authenticate and generate JWT',
      'POST /api/v1/tasks - Create a task',
      'GET /api/v1/products - Get all products',
      'GET /api/v1/cart - Get cart items',
      'GET /api/v1/wishlist - Get wishlist items',
      'POST /api/v1/orders - Create an order',
    ],
  });
});

// Error handling middleware
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
