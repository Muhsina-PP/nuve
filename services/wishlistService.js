const Wishlist = require("../models/wishlistSchema");
const Product = require("../models/productSchema");
const mongoose = require("mongoose");

const getWishlistItems = async (userId) => {

  const wishlist = await Wishlist.findOne({ userId }).populate({
    path: "products.productId",
    populate: [
      { path: "category" },
      { path: "brand" }
    ]
  });

  if (!wishlist) {
    return [];
  }

  wishlist.products = wishlist.products.filter(item => {
    const product = item.productId;

    return (
      product &&
      !product.isBlocked &&
      product.status === "Available" &&
      product.category &&
      product.category.isListed
    );
  });

  await wishlist.save();

  return wishlist.products;
};

const addProductToWishlist = async (
  userId,
  productId,
  variant
) => {

  const product = await Product.findById(productId)
    .populate("category");

  if (
    !product ||
    product.isBlocked ||
    !product.isListed ||
    !product.category?.isListed
  ) {
    return {
      success: false,
      message: "Product is not available"
    };
  }

  if (!variant) {
    return {
      success: false,
      message: "Please select a size"
    };
  }

  const variantData = product.variants.find(
    v => v.size === variant
  );

  if (!variantData || variantData.stock <= 0) {
    return {
      success: false,
      message: "Selected size is not available"
    };
  }

  let wishlist = await Wishlist.findOne({ userId });

  if (!wishlist) {
    wishlist = new Wishlist({
      userId: new mongoose.Types.ObjectId(userId),
      products: [{ productId, variant }]
    });

    await wishlist.save();

    return {
      success: true,
      message: "Product added to wishlist"
    };
  }

  const exists = wishlist.products.find(
    item =>
      item.productId.toString() === productId &&
      item.variant === variant
  );

  if (exists) {
    return {
      success: false,
      alreadyExists: true,
      message: "Item already in wishlist"
    };
  }

  wishlist.products.push({
    productId,
    variant
  });

  await wishlist.save();

  return {
    success: true,
    message: "Product added to wishlist"
  };
};

const removeProductFromWishlist = async (
  userId,
  productId
) => {

  const wishlist = await Wishlist.findOne({ userId });

  if (!wishlist) {
    return;
  }

  wishlist.products = wishlist.products.filter(
    item => item.productId.toString() !== productId
  );

  await wishlist.save();
};

module.exports = {
  getWishlistItems,
  addProductToWishlist,
  removeProductFromWishlist
};