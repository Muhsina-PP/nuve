const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema")
const User = require("../../models/userSchema")
const Wishlist = require("../../models/wishlistSchema");
const mongoose = require('mongoose');



// const loadCart = async (req, res) => {
//   try {
//     const userId = req.session.user;

//     let cart = await Cart.findOne({ userId })
//       .populate({
//         path: 'items.productId',
//         populate: [
//           { path: 'category' },
//           { path : 'brand'}
//         ]
//       });

//     if (!cart) {
//       return res.render("cart", { cartItems: [] });
//     }

//     //  REMOVE INVALID PRODUCTS
//     cart.items = cart.items.filter(item => {
//       const product = item.productId;

//       return product &&
//         !product.isBlocked &&
//         product.status === 'Available' &&
//         product.category &&
//         product.category.isListed;
//     });

//     await cart.save(); 

//     res.render("cart", {
//       cartItems: cart.items
//     });

//   } catch (error) {
//     console.log("Cannot load cart:", error);
//     res.redirect("/pageNotFound");
//   }
// };

const loadCart = async (req, res) => {
  try {
    const userId = req.session.user;

    let cart = await Cart.findOne({ userId })
      .populate({
        path: 'items.productId',
        populate: [
          { path: 'category' },
          { path : 'brand'}
        ]
      });

    if (!cart) {
      return res.render("cart", { cartItems: [] });
    }

    //  REMOVE INVALID PRODUCTS
    const updatedItems = cart.items.map(item => {
      const product = item.productId;

      let stockStatus = 'Available';
      let isOutOfStock = false;

      if (
        !product ||
        product.isBlocked ||
        product.status !== 'Available' ||
        !product.category ||
        !product.category.isListed
      ) {
        stockStatus = 'Unavailable';
        isOutOfStock = true;
      } else {
        const variant = product.variants.find(v => v.size === item.variant);

        if (!variant || variant.stock === 0) {
          stockStatus = 'Out of stock';
          isOutOfStock = true;
        }
      }

      return {
        ...item._doc,
        stockStatus,
        isOutOfStock 
      };
    });

    await cart.save(); 

    res.render("cart", {
      cartItems: updatedItems
    });

  } catch (error) {
    console.log("Cannot load cart:", error);
    res.redirect("/pageNotFound");
  }
};


const addToCart = async (req, res) => {
  try {
    const userId = req.session.user;
    const { productId, selectedVariant , quantity} = req.body;
    console.log("Request body  : ", req.body, userId)

    const product = await Product.findById(productId).populate('category');

    if (!product) {
      return res.json({ success: false, message: 'Product not found' });
    }

    if (product.isBlocked) {
      return res.json({ success: false, message: 'This product is currently blocked' });
    }

    if (product.status !== 'Available') {
      return res.json({ success: false, message: 'This product is not available for purchase' });
    }

    if (!product.category || product.category.isListed === false) {
      return res.json({ success: false, message: 'This product category is currently unavailable' });
    }

    const availableVariants = product.variants.filter(v => v.stock > 0);

    if (availableVariants.length === 0) {
      return res.json({ success: false, message: 'Product is out of stock' });
    }

    let finalVariant = selectedVariant;
    console.log("Final variant : ", finalVariant)
    console.log("Selected variant : ",selectedVariant)

    if (!finalVariant) {
      const preferred = availableVariants.find(v => v.size === 'M');
      finalVariant = preferred ? preferred.size : availableVariants[0].size;
    }

    const variantData = product.variants.find(v => v.size === finalVariant);

    let cart = await Cart.findOne({ userId });
    const price = product.salePrice || product.price;

    if (!cart) {
      cart = new Cart({
        userId,
        items: [{
          productId,
          quantity: quantity? quantity : 1,
          price,
          totalPrice: price,
          variant: finalVariant
        }]
      });
    } else {

      const index = cart.items.findIndex(
        item =>
          item.productId.toString() === productId &&
          item.variant === finalVariant
      );

      console.log("index : ",index)
      if (index > -1) {

        if (cart.items[index].quantity >= variantData.stock) {
          return res.json({
            success: false,
            message: 'Maximum stock reached'
          });
        }

        cart.items[index].quantity += 1;
        cart.items[index].totalPrice =
          cart.items[index].quantity * cart.items[index].price;

      } else {

        cart.items.push({
          productId,
          quantity: quantity? quantity : 1,
          price,
          totalPrice: price,
          variant: finalVariant
        });

      }
    }

    await cart.save();

    console.log("Pull values : ",productId, finalVariant)

   await Wishlist.updateOne(
      { userId: new mongoose.Types.ObjectId(userId) },
      { 
        $pull: { 
          products: { 
            productId: new mongoose.Types.ObjectId(productId),
            variant: finalVariant
          } 
        } 
      }
    );


    res.json({
      success: true,
      message: `Product (Size ${finalVariant}) added to cart`
    });

  } catch (error) {
    console.error('Error adding to cart : ', error);
    res.status(500).json({ success: false, message: 'Error adding to cart' });
  }
};


const updateCart = async (req, res) => {
  try {

    
    const userId = req.session.user;
    const { id, quantity , variant} = req.query;
    console.log("Request body: ",req.query)

    const qty = Number(quantity);
    console.log("quantity : ",qty)

    let cart = await Cart.findOne({ userId }).populate('items.productId');
    console.log("cart : ",cart)
    console.log("ID : ",id);
    console.log("variant : ",variant);
    const item = cart.items.find(item=> item.productId._id.toString() === id && item.variant === variant);
    console.log("item : ",item)
    if (!item) return res.redirect('/cart');

    const product = item.productId;

    const stock = product.variants?.[0]?.stock || 0;

    if (stock === 0) {
      return res.redirect('/cart');
    }

    if (qty < 1) {
      item.remove();
    } else if (qty > stock) {
      item.quantity = stock;
      item.totalPrice = stock * item.price;
    } else {
      item.quantity = qty;
      item.totalPrice = qty * item.price;
    }

    await cart.save();
    let finalAmount = cart.items.reduce((acc,item) => acc + item.totalPrice, 0)

    // return res.redirect('/cart');
    return res.status(200).json({success : true, message : 'Updated succesfully', finalAmount})

  } catch (error) {
    console.log("Error updating cart:", error);
    return res.redirect('/cart');
  }
};

const removeFromCart = async (req, res) => {
  try {
    const userId = req.session.user;
    const { productId, variant } = req.query;

    const cart = await Cart.findOne({ userId });

    if (!cart) return res.redirect('/cart');

    cart.items = cart.items.filter(item => 
      !(item.productId.toString() === productId && item.variant === variant)
    );

    await cart.save();

    res.redirect('/cart');

  } catch (error) {
    console.error("Error removing item:", error);
    res.redirect('/pageNotFound');
  }
};

module.exports = {
  addToCart,
  loadCart,
  updateCart,
  removeFromCart
}