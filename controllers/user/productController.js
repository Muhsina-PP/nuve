const productService = require("../../services/productService");

const productDetails = async (req, res) => {

  try {

    const userId = req.session.user;

    const productId = req.query.id;
    const data =
      await productService.getProductDetails(
        userId,
        productId
      );

    res.render("product-details", {
      user: data.userData,
      product: data.product,
      catgeory: data.findCategory,
      brand: data.findBrand,
      quantity: data.totalStock,
      totalOffer: data.totalOffer,
      stockStatus: data.stockStatus,
      relatedProducts:
        data.relatedProducts,
      blockedMessage:
        data.product.isBlocked
          ? "This product is currently unavailable, blocked by admin."
          : null
    });

  } catch (error) {

    if (
      error.message ===
      "PRODUCT_NOT_FOUND"
    ) {
      return res
        .status(404)
        .render("page-404");
    }

    console.log(
      "Cannot get product-details page:",
      error
    );

    res.redirect("/pageNotFound");
  }
};

module.exports = {
  productDetails
};