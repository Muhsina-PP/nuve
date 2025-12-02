const Product = require("../../models/productSchema")
const Category = require("../../models/categorySchema")
const Brand = require("../../models/brandSchema")
const User = require("../../models/userSchema")
const path = require("path")
const fs = require("fs")
const sharp = require("sharp")

const productInfo = async (req, res) =>{
  try {
    const category = await Category.find({isListed : true})
    const brand = await Brand.find({isBlocked : false})
    res.render("products",{
      category, 
      brand ,
    })
  } catch (error) {
    console.log('Error getting product details page : ',error);
    return res.status(404).json({
      success : false,
      message : 'Error getting product details page'
    })    
  }
}

const getAddProductPage = async (req, res) =>{
  try {
    const category = await Category.find({isListed : true})
    const brand = await Brand.find({isBlocked : false})
    res.render("add-products", {
      category,
      brand 
    })
  } catch (error) {
    console.log("Error getting products adding page : ",error);
    return res.status(404).json({
      success : false,
      message : 'Error getting products adding page'
    })
  }
}


const addProducts = async (req, res) => {
    try {
        console.log("Form received");
        const products = req.body;
        console.log("Request body : ",req.body);
        console.log("files recieved : ",req.files);
        

        const existingProduct = await Product.findOne({ productName : products.productName})

        if(!existingProduct){
          const images = [];
          const variants = [];

          ["S", "M", "L", "XL", "XXL"].forEach(size => {
              const qty = Number(products[`quantity_${size}`]) || 0;
              variants.push({ size, stock: qty });
          });

          
          if(req.files && req.files.length>0){
            for( let i=0; i<req.files.length; i++){
              const originalImagePath = req.files[i].path;
              const resizedImagePath = path.join('public', 'uploads', 'product-images', req.files[i].filename)
              await sharp(originalImagePath).resize({width : 440, height:440}).toFile(resizedImagePath)
              images.push(req.files[i].filename)
            }
          }

          const categoryId = await Category.findOne({name : products.category})
          if(!categoryId){
            return res.status(404).json({success : false, message : 'Invalid category name'})
          }

          const newProduct = new Product({
            productName : products.productName,
            description : products.description,
            brand : products.brand ,
            category: categoryId._id,
            regularPrice : products.regularPrice,
            createdAt : new Date(),
            salePrice : products.salePrice,
            quantity : products.quantity,
            variants : variants,
            color : products.color,
            productImage : images,
            status : 'Available'
          })
          await newProduct.save();
          return res.redirect("/admin/products")

        }else{
          console.log("Product adding error bcz product already exists, try with another name");
          return res.status(404).json({
            success : false,
            message : 'Product adding error bcz product already exists, try with another name'
          })
        }

    } catch (error) {
        console.log("Error adding product:", error);
        return res.status(500).json({
          success : false,
          message : 'Product adding error'
        })
    }
};


module.exports = {
  productInfo,
  getAddProductPage,
  addProducts
}