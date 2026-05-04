const User = require("../../models/userSchema");
const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");
const Brand = require("../../models/brandSchema");


const productDetails = async (req, res) =>{
  try {
    const userId = req.session.user;
    const userData = await User.findById(userId);

    const productId = req.query.id;
    const product = await Product.findById(productId).populate('category').populate('brand');

    const findBrand = product.brand;
    const findCategory = product.category;

    const categoryOffer = findCategory ?. categoryOffer || 0;
    const productOffer = product.productOffer || 0;
    const totalOffer = categoryOffer + productOffer;

    const totalStock = product.variants.reduce((sum, item) => sum + item.stock, 0)

    let stockStatus = 'Available';
    if(product.status === 'Discontinued' || product.isBlocked){
      stockStatus = 'Unavailable'
    }else if(totalStock === 0){
      stockStatus = 'Out of stock'
    }

    const relatedProducts = await Product.find({
      category : product.category._id,
      isBlocked : false,
       _id: { $ne: product._id },
    }).limit(4)

    res.render("product-details",{
      user : userData,
      product : product,
      catgeory : findCategory,
      brand : findBrand,
      quantity : totalStock,
      totalOffer : totalOffer,
      stockStatus,
      relatedProducts
    })
    

  } catch (error) {
    console.log("Cannot get product-details page : ",error);
    res.redirect("/pageNotFound")
  }
}
 

module.exports = {
  productDetails
}