const User = require("../../models/userSchema");

const wishlistService = require("../../services/wishlistService");

const loadWishlist = async (req, res) => {
  try {

    const userId = req.session.user;

    const user = await User.findById(userId);

    const wishlistItems =
      await wishlistService.getWishlistItems(userId);

    res.render("wishlist", {
      user,
      wishlistItems
    });

  } catch (error) {

    console.log(
      "Cannot get wishlist page:",
      error
    );

    res.redirect("/pageNotFound");
  }
};

const addToWishlist = async (req, res) => {
  try {

    const { productId, variant } = req.body;

    const result =
      await wishlistService.addProductToWishlist(
        req.session.user,
        productId,
        variant
      );

    return res.status(200).json(result);

  } catch (error) {

    console.error(
      "Error adding item to wishlist:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Internal server error while adding item to wishlist"
    });
  }
};

const removeFromWishlist = async (req, res) => {
  try {

    const productId = req.query.productId;

    await wishlistService.removeProductFromWishlist(
      req.session.user,
      productId
    );

    return res.redirect("/wishlist");

  } catch (error) {

    console.error(
      "Error removing item from wishlist:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Internal server error while removing item"
    });
  }
};

module.exports = {
  loadWishlist,
  addToWishlist,
  removeFromWishlist
};