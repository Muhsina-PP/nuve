const User = require("../models/userSchema");
const Product = require("../models/productSchema");

const getProductDetails = async (userId, productId) => {

  const userData = await User.findById(userId);

  const product = await Product.findById(productId)
    .populate("category")
    .populate("brand");

  if (!product) {
    throw new Error("PRODUCT_NOT_FOUND");
  }

  const findBrand = product.brand;
  const findCategory = product.category;

  const categoryOffer =
    findCategory?.categoryOffer || 0;

  const productOffer =
    product.productOffer || 0;

  const totalOffer =
    categoryOffer + productOffer;

  const totalStock =
    product.variants.reduce(
      (sum, item) => sum + item.stock,
      0
    );

  let stockStatus;

  if (product.isBlocked) {

    stockStatus = "Blocked";

  } else {

    const stock =
      product.variants.reduce(
        (sum, variant) =>
          sum + variant.stock,
        0
      );

    stockStatus =
      stock > 0
        ? "Available"
        : "Out of Stock";
  }

  const relatedProducts =
    await Product.find({
      category: product.category._id,
      isBlocked: false,
      _id: { $ne: product._id }
    }).limit(4);

  return {
    userData,
    product,
    findBrand,
    findCategory,
    totalOffer,
    totalStock,
    stockStatus,
    relatedProducts
  };
};

module.exports = {
  getProductDetails
};