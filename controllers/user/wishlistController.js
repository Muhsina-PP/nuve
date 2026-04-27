const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Wishlist = require('../../models/wishlistSchema');
const { Mongoose, default: mongoose } = require("mongoose");

const loadWishlist = async (req,res) =>{
  try {
    const userId = req.session.user;
    const user = await User.findById(userId);

    
    const wishlist = await Wishlist.findOne({userId}).populate({
      path: 'products.productId',
      populate: [
        { path: 'category' },
        { path: 'brand' }
      ]
    });

    if(!wishlist){
      return res.render("wishlist", {wishlistItems : wishlist?.products || []} )
    }

    wishlist.products = wishlist.products.filter(item =>{
      const product = item.productId

      return product &&
        !product.isBlocked &&
        product.status === 'Available' &&
        product.category &&
        product.category.isListed;
    })
    await wishlist.save();

    res.render("wishlist",{
        user : user,
        wishlistItems : wishlist?.products || []
    })
  } catch (error) {
    console.log("Cannot get wisglist page : ",error);
    res.redirect("/pageNotFound")
  }
}

const addToWishlist = async(req,res) =>{
  try {
    const {productId, variant}  = req.body;
    const userId = req.session.user;
    const user = await User.findById(userId);

    const product = await Product.findById(productId).populate('category');

    if (!product || product.isBlocked || !product.isListed || !product.category?.isListed) {
      return res.status(400).json({
        success: false,
        message: 'Product is not available'
      });
    }
     if (!variant) {
      return res.status(400).json({
        success: false,
        message: 'Please select a size'
      });
    }
    const variantData = product.variants.find(v=> v.size === variant)

    if (!variantData || variantData.stock <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Selected size is not available'
      });
    }

    const wishlist = await Wishlist.findOne({ userId });

    if (wishlist) {

      const exists = wishlist.products.find(
        item =>
          item.productId.toString() === productId &&
          item.variant === variant
      );

      if (exists) {
        return res.status(200).json({
          success: false,
          alreadyExists: true,
          message: 'Item already in wishlist'
        });
      }

      wishlist.products.push({ productId, variant });
      await wishlist.save();

      return res.json({
        success: true,
        message: 'Product added to wishlist'
      });
    } 

    let newWishlist = new Wishlist({
      userId: new mongoose.Types.ObjectId(userId),
      products : [
        {productId, variant}
      ]
    })
    await newWishlist.save()

    
    return res.status(200).json({
      success : true,
      message : 'Item added to wishlist succesfully'
    })
  } catch (error) {
    console.error('Error adding item to wishlist : ',error);
    return res.status(500).json({
      status : false,
      message :  'Internal server error while adding item to wishlist'
    })
  }
}

const removeFromWishlist = async(req,res) =>{
  try {
    const productId = req.query.productId;
    const userId = req.session.user;
    const user = await User.findById(userId);

    let wishlist = await Wishlist.findOne({userId});
    wishlist.products = wishlist.products.filter(item => item.productId.toString() !== productId )
    await wishlist.save()

    return res.redirect("/wishlist")
  } catch (error) {
    console.error('Error removing product from wishlist : ',error);
    return res.status(500).json({
      status : false,
      message :  'Internal server error while removing item from wishlist'
    })
  }
}

module.exports = {
  loadWishlist,
  addToWishlist,
  removeFromWishlist
}