const Category = require('../models/Category');
const { validateParentCategory, checkCircularReference } = require('../utils/categoryUtils');

// @desc    Create a category
// @route   POST /api/categories
// @access  Public
exports.createCategory = async (req, res, next) => {
  try {
    const { name, description, parentId } = req.body;
    
    if (parentId) {
      const validationResult = await validateParentCategory(parentId);
      if (!validationResult.isValid) {
        return res.status(400).json({ error: validationResult.error });
      }
    }
    
    const newCategory = new Category({
      name,
      description,
      parentId: parentId || null,
      imageUrl: req.body.imageUrl,
    });
    
    const savedCategory = await newCategory.save();
    res.status(201).json({
      success: true,
      data: savedCategory
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all categories
// @route   GET /api/categories
// @access  Public
exports.getCategories = async (req, res, next) => {
  try {
    const { 
      name, 
      parentId, 
      isActive, 
      page = 1, 
      limit = 10, 
      sortBy = 'name', 
      sortOrder = 'asc' 
    } = req.query;
    
    const filter = {};
    if (name) filter.name = { $regex: name, $options: 'i' };
    if (parentId) filter.parentId = parentId === 'null' ? null : parentId;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const categories = await Category.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('parentId', 'name');
    
    const total = await Category.countDocuments(filter);
    
    res.json({
      success: true,
      count: categories.length,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      },
      data: categories
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single category
// @route   GET /api/categories/:id
// @access  Public
exports.getCategory = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id)
      .populate('parentId', 'name');
    
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    res.json({
      success: true,
      data: category
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update category
// @route   PUT /api/categories/:id
// @access  Public
exports.updateCategory = async (req, res, next) => {
  try {
    const { name, description, parentId, isActive } = req.body;
    
    if (parentId) {
      const circularRefCheck = await checkCircularReference(
        req.params.id,
        parentId
      );
      
      if (!circularRefCheck.isValid) {
        return res.status(400).json({ error: circularRefCheck.error });
      }
      
      const validationResult = await validateParentCategory(parentId);
      if (!validationResult.isValid) {
        return res.status(400).json({ error: validationResult.error });
      }
    }
    
    const updateData = {
      updatedAt: Date.now()
    };
    
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (parentId !== undefined) updateData.parentId = parentId || null;
    if (isActive !== undefined) updateData.isActive = isActive;
    
    if (name) {
      updateData.slug = name
        .toLowerCase()
        .replace(/[^a-zA-Z0-9]/g, '-')
        .replace(/-+/g, '-');
    }
    
    const updatedCategory = await Category.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('parentId', 'name');
    
    if (!updatedCategory) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    res.json({
      success: true,
      data: updatedCategory
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete category
// @route   DELETE /api/categories/:id
// @access  Public
exports.deleteCategory = async (req, res, next) => {
  try {
    const hasChildren = await Category.findOne({ parentId: req.params.id });
    if (hasChildren) {
      return res.status(400).json({ 
        error: 'Cannot delete category with subcategories. Delete subcategories first or reassign them.'
      });
    }
    
    const deletedCategory = await Category.findByIdAndDelete(req.params.id);
    
    if (!deletedCategory) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    res.json({
      success: true,
      data: {},
      message: 'Category deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get subcategories by parent
// @route   GET /api/categories/parent/:parentId
// @access  Public
exports.getSubcategories = async (req, res, next) => {
  try {
    const parentId = req.params.parentId === 'null' ? null : req.params.parentId;
    
    const subcategories = await Category.find({ parentId })
      .sort({ name: 1 });
    
    res.json({
      success: true,
      count: subcategories.length,
      data: subcategories
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get category tree
// @route   GET /api/categories/tree
// @access  Public
exports.getCategoryTree = async (req, res, next) => {
  try {
    const allCategories = await Category.find().sort({ name: 1 });
    
    const buildTree = (parentId = null) => {
      return allCategories
        .filter(category => {
          if (!category.parentId && parentId === null) return true;
          return category.parentId && category.parentId.toString() === parentId;
        })
        .map(category => {
          const categoryObj = category.toObject();
          const children = buildTree(category._id.toString());
          
          if (children.length > 0) {
            categoryObj.children = children;
          }
          
          return categoryObj;
        });
    };
    
    const categoryTree = buildTree();
    res.json({
      success: true,
      count: categoryTree.length,
      data: categoryTree
    });
  } catch (error) {
    next(error);
  }
};