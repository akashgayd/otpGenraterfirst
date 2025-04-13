const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a category name'],
    trim: true,
    maxlength: [100, 'Name cannot be more than 100 characters']
  },
  slug: {
    type: String
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  imageUrl: {
    type: String,
    trim: true,
    default: '',
    validate: {
      validator: function (v) {
        if (!v || v.trim() === '') return true;
        try {
          new URL(v);
          return true;
        } catch (err) {
          return false;
        }
      },
      message: 'Please enter a valid image URL'
    }
  },  
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null
  },
  level: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Pre-save middleware to create slug
categorySchema.pre('save', function(next) {
  this.slug = this.name
    .toLowerCase()
    .replace(/[^a-zA-Z0-9]/g, '-')
    .replace(/-+/g, '-');
  next();
});

// Pre-save middleware to set level
categorySchema.pre('save', async function(next) {
  if (this.parentId) {
    try {
      const parent = await this.constructor.findById(this.parentId);
      if (parent) {
        this.level = parent.level + 1;
      }
    } catch (error) {
      next(error);
    }
  }
  next();
});

module.exports = mongoose.model('Category', categorySchema);