require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const errorHandler = require('./middlewares/errorMiddleware');
const rateLimit = require('express-rate-limit');

// Initialize Express
const app = express();

// Connect to database
connectDB();

// Middleware
app.use(express.json());
app.use(cors());



const limiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 mins
  max: 100
});
app.use(limiter);

// Routes

app.use('/api/v1/auth', require('./routes/authRoutes'));
app.use('/api/v1/tasks', require('./routes/taskRoutes'));
app.use('/api/categories', require('./routes/categoryRoutes'));

// Home route
app.get('/', (req, res) => {
  res.json({
    message: 'Task Management API',
    version: '1.0.0'
  });
});


// Home route
app.get('/', (req, res) => {
  res.json({
    message: 'Category Management API',
    version: '1.0.0',
    endpoints: [
      'POST /api/categories - Create a category',
      'GET /api/categories - Get all categories with filtering & pagination',
      'GET /api/categories/:id - Get a category by ID',
      'PUT /api/categories/:id - Update a category',
      'DELETE /api/categories/:id - Delete a category',
      'GET /api/categories/parent/:parentId - Get subcategories by parent ID',
      'GET /api/categories/tree - Get category tree structure'
    ]
  });
});

// Error handling middleware
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});