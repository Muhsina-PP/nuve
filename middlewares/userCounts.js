const Cart = require("../models/cartSchema")
const Wishlist = require("../models/wishlistSchema")

const userCounts = async (req, res, next) => {
  try {
    if (req.session.user) {

      const userId = req.session.user;

      const cart = await Cart.findOne({ userId })
      let cartCount = 0;
      if (cart) {
        cartCount = cart.items.reduce((total, item) => {
          return total + item.quantity;
        }, 0)
      }

      const wishlist = await Wishlist.findOne({ userId })
      let wishlistCount = 0;
      if (wishlist) {
        wishlistCount = wishlist.products.length;
      }

      res.locals.cartCount = cartCount;
      res.locals.wishlistCount = wishlistCount

    } else {

      res.locals.cartCount = 0;
      res.locals.wishlistCount = 0;

    }

    next();

  } catch (error) {
    console.log("Error getting cart count and wishlist count : ", error);
    next();
  }
}


module.exports = userCounts