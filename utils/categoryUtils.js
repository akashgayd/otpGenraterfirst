const Category = require('../models/Category');

const validateParentCategory = async (parentId) => {
  if (!parentId) return { isValid: true };
  
  const parentExists = await Category.findById(parentId);
  if (!parentExists) {
    return {
      isValid: false,
      error: 'Parent category not found'
    };
  }
  
  return { isValid: true };
};

const checkCircularReference = async (categoryId, parentId) => {
  if (categoryId === parentId) {
    return {
      isValid: false,
      error: 'Category cannot be its own parent'
    };
  }
  
  let currentParent = parentId;
  while (currentParent) {
    const parent = await Category.findById(currentParent);
    if (!parent) break;
    
    if (parent.parentId && parent.parentId.toString() === categoryId) {
      return {
        isValid: false,
        error: 'Circular reference detected in category hierarchy'
      };
    }
    
    currentParent = parent.parentId;
  }
  
  return { isValid: true };
};

module.exports = {
  validateParentCategory,
  checkCircularReference
};