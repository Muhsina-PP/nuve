const Category = require("../models/categorySchema");

const footerCategories = async (req, res, next) => {
  try {
    const categories = await Category.find({ isListed: true });
    res.locals.footerCategories = categories;
    next()
  } catch (error) {
    console.log("Error passing categories to footer : ", error);
    next();
  }
}

module.exports = footerCategories