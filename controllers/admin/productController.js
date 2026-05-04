const Product = require("../../models/productSchema")
const Category = require("../../models/categorySchema")
const Brand = require("../../models/brandSchema")
const User = require("../../models/userSchema")
const path = require("path")
const fs = require("fs")
const sharp = require("sharp") //to resize images
const {applyBestOffer} = require("../../helpers/offerHelper")
const { Types } = require("mongoose")


const productInfo = async (req, res) =>{
  try {
    
    const search = req.query.search?.trim() || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;

    const productData = await Product.find({
      $or : [
        {productName :{ $regex :search , $options : "i"}}
      ]
    })
    .sort({_id : -1})
    .limit(limit)
    .skip(skip)
    .populate('category')
    .populate('brand')
    .exec()

    const totalProducts = await Product.countDocuments({
      $or: [
        {productName :{ $regex :search , $options : "i"}}
      ]
    });
    const totalPages = Math.ceil(totalProducts / limit);

    const category = await Category.find({isListed : true});
    const brand = await Brand.find({isBlocked : false})

    const noProductFound = search !== "" && productData.length === 0;

    if(category && brand){
      res.render("products" , {
        product : productData,
        currentPage : page,
        totalPages : totalPages,
        category : category,
        brand : brand,
        noProductFound,
        search : search
      })
    }else{
      return res.status(500).json({
        success : false,
        message : 'An error occured while displaying product listing page'
      })
    }
   
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
        const products = req.body;

        const existingProduct = await Product.findOne({ 
            productName: products.productName 
        });

        if (existingProduct) {
            console.log("Product already exists with this name");
            return res.status(400).json({
                success: false,
                message: 'Product with this name already exists. Please use a different name.'
            });
        }

        const sizes = ["S", "M", "L", "XL", "XXL"];
        const variants = []
        for (const size of sizes) {
            const qty = Number(products[`quantity_${size}`]) || 0;
            variants.push({ size, stock: qty });
        }

        const images = [];
        
        if (req.files && req.files.length > 0) {
            if (req.files.length > 4) {
                return res.status(400).json({
                    success: false,
                    message: 'Maximum 4 images allowed'
                });
            }

            console.log('hiiiii... : ',req.files)
            
            for (let file of req.files) {
                try {
                    const originalPath = file.path;
                    const resizedFilename = `resized-${file.filename}`;
                    const resizedPath = `${file.destination}/${resizedFilename}`;

                    await sharp(originalPath)
                        .resize(800, 800, {
                            fit: 'cover',
                            position: 'center',
                            withoutEnlargement: false
                        })
                        .jpeg({ 
                            quality: 90,
                            mozjpeg: true 
                        })
                        .toFile(resizedPath);

                    images.push(resizedFilename);

                } catch (imageError) {
                    console.error('Error processing image:', imageError);
                }
            }
        }

        if (images.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'At least one product image is required'
            });
        }

        const categoryId = await Category.findById(products.category);
        if (!categoryId) {
            return res.status(404).json({
                success: false,
                message: 'Invalid category name'
            });
        }
        const brandId = await Brand.findById(products.brand);
        if (!brandId) {
            return res.status(404).json({
                success: false,
                message: 'Invalid brand name'
            });
        }

        const regularPrice = Number(products.regularPrice);
        let salePrice = regularPrice;
        
        if (categoryId.categoryOffer) {
          salePrice = regularPrice - (regularPrice * categoryId.categoryOffer) / 100;
        }

        const newProduct = new Product({
            productName: products.productName,
            description: products.description,
            brand: brandId._id,
            category: categoryId._id,
            regularPrice : products.regularPrice,
            salePrice ,
            variants: variants,
            color: products.color,
            productImage: images,
            status: 'Available'
        });

        await newProduct.save();
        console.log('Product added successfully:', newProduct._id);
        return res.redirect("/admin/products");

    } catch (error) {
        console.error("Error adding product:", error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error while adding product',
            error: error.message
        });
    }
};

const addProductOffer = async (req, res) => {
  try {
    const percentage = parseInt(req.body.percentage);
    const productId = req.body.productId;

    if (!percentage || isNaN(percentage) || percentage <= 0 || percentage > 90) {
      return res.status(400).json({ success: false, message: "Invalid percentage" });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(400).json({ success: false, message: "Product not found" });
    }

    const category = await Category.findById(product.category);

    product.productOffer = percentage;

    const categoryOffer = category ? category.categoryOffer || 0 : 0;

    // Apply best offer
    applyBestOffer(product, categoryOffer);
    await product.save();

    return res.send({ success: true, message: "Product offer applied successfully" });

  } catch (error) {
    console.error("Error adding product offer:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};



const removeProductOffer = async (req, res) => {
  try {
    const productId = req.body.productId;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    const category = await Category.findById(product.category);
    const categoryOffer = category ? category.categoryOffer || 0 : 0;

    product.productOffer = 0;

    applyBestOffer(product, categoryOffer);

    await product.save();

    return res.status(200).json({
      success: true,
      message: "Product offer removed successfully"
    });

  } catch (error) {
    console.error("Error removing product offer:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}


 const blockProduct = async (req,res) =>{
  try {
    const productId = req.query.productId;
    await Product.updateOne({_id : productId},{$set :{isBlocked : true}})
    return res.redirect("/admin/products")
  } catch (error) {
    console.error('Error blocking product : ',error);
    return res.status(404).json({
      success : false,
      message : 'Error blocking product'
    })
  }
 }


 const unblockProduct = async (req,res) =>{
  try {
    const productId = req.query.productId;
    await Product.updateOne({_id : productId},{$set :{isBlocked : false}})
    return res.redirect("/admin/products")
  } catch (error) {
    console.error('Error unblocking product : ',error);
    return res.status(404).json({
      success : false,
      message : 'Error unblocking product'
    })
  }
 }


 const getEditProductPage = async (req, res) =>{
  try {
    const id = req.query.id;
    const product = await Product.findOne({_id : id})
    const category = await Category.find()
    const brand = await Brand.find()

    return res.render("edit-product",{
      product,
      category,
      brand
    })    
  } catch (error) {
    console.error('Error getting edit-product page : ',error);
    return res.status(404).json({
      success : false,
      message : 'Error getting edit-product page'
    })
  }
 }


//  const editProduct = async (req,res) =>{
//   try {
    
//     const id = req.params.id;
//     const products = req.body;

//     const product = await Product.findById(id)

//     if(!product){
//       return res.status(404).json({
//         success : false,
//         message : 'Product not found'
//       })
//     }

//     const existingProduct = await Product.findOne({
//       productName: products.productName,
//       _id: { $ne: id }
//     });

//     if(existingProduct){
//       return res.status(400).json({
//         success:false,
//         message:"Product with this name already exists"
//       })
//     }

//     const sizes = ["S","M","L","XL","XXL"];
//     const variants = [];

//     for(const size of sizes){
//       const qty = Number(products[`quantity_${size}`]) || 0;

//       variants.push({
//         size: size,
//         stock: qty
//       });
//     }

//     const categoryId = await Category.findById(products.category);
//     if(!categoryId){
//       return res.status(404).json({
//         success:false,
//         message:"Category not found"
//       })
//     }

//     const regularPrice = Number(products.regularPrice)
//     let salePrice = regularPrice;

//     if(categoryId.categoryOffer){
//         salePrice = regularPrice - (regularPrice * categoryId.categoryOffer)/100;
//     }

//     let productImage = product.productImage;

//     if(req.files && req.files.length > 0){

//       // delete old images
//       for(const img of product.productImage){
//         const imagePath = path.join("public/uploads/product-images", img);

//         if(fs.existsSync(imagePath)){
//           fs.unlinkSync(imagePath);
//         }
//       }

//       productImage = [];

//       for(const file of req.files){

//         const filename = Date.now() + path.extname(file.originalname);

//         await sharp(file.path)
//           .resize(500,500)
//           .toFile(path.join("public/uploads/product-images", filename));

//         productImage.push(filename);

//         fs.unlinkSync(file.path);
//       }
//     }

//     const updateProduct = await Product.findByIdAndUpdate(id,{
//       productName : products.productName,
//       description : products.description,
//       brand : products.brand,
//       category : categoryId._id,
//       regularPrice : regularPrice,
//       salePrice : salePrice,
//       color : products.color,
//       variants : variants,
//       productImage : productImage
//     },{new : true})
    
//     if(updateProduct){
//       return res.json({
//         success: true,
//         message: "Product updated successfully",
//         redirectUrl: "/admin/products"
//       });

//     }else{
//       return res.status(404).json({success : false, error : 'Product not found'})
//     }

//   } catch (error) {
//     console.error('Error editing product : ',error);
//     return res.status(500).json({
//       success : false,
//       message : 'Error editing product '
//     })
//   }
//  }

const editProduct = async (req, res) => {
  try {
    console.log('hhhhhiiiii');
    
    const id = req.params.id;
    const products = req.body;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const existingProduct = await Product.findOne({
      productName: products.productName,
      _id: { $ne: id }
    });
    if (existingProduct) {
      return res.status(400).json({ success: false, message: "Product with this name already exists" });
    }

    // Build variants
    const sizes = ["S", "M", "L", "XL", "XXL"];
    const variants = sizes.map(size => ({
      size,
      stock: Number(products[`quantity_${size}`]) || 0
    }));

    const categoryId = await Category.findById(products.category);
    if (!categoryId) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    const regularPrice = Number(products.regularPrice);
    const salePrice = categoryId.categoryOffer
      ? regularPrice - (regularPrice * categoryId.categoryOffer) / 100
      : regularPrice;

    // ── IMAGE HANDLING ──────────────────────────────────────────────
    // 1. Start with current images in DB
    let productImage = [...product.productImage];

    // 2. Delete images the user explicitly removed
    const deletedImages = products.deletedImages
      ? products.deletedImages.split(',').filter(Boolean)
      : [];

    for (const img of deletedImages) {
      const imagePath = path.join("public/uploads/product-images", img);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
      productImage = productImage.filter(p => p !== img);
    }

    // 3. Add newly uploaded images
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const filename = Date.now() + '-' + Math.random().toString(36).slice(2) + path.extname(file.originalname);
        await sharp(file.path)
          .resize(500, 500)
          .toFile(path.join("public/uploads/product-images", filename));
        productImage.push(filename);
        fs.unlinkSync(file.path);
      }
    }

    // 4. Guard: must have at least 1 image, max 4
    if (productImage.length === 0) {
      return res.status(400).json({ success: false, message: "At least one product image is required" });
    }
    if (productImage.length > 4) {
      return res.status(400).json({ success: false, message: "Maximum 4 images allowed" });
    }
    // ───────────────────────────────────────────────────────────────

    const updatedProduct = await Product.findByIdAndUpdate(id, {
      productName: products.productName,
      description: products.description,
      brand: products.brand,
      category: categoryId._id,
      regularPrice,
      salePrice,
      color: products.color,
      variants,
      productImage
    }, { new: true });

    if (updatedProduct) {
      return res.json({ success: true, message: "Product updated successfully", redirectUrl: "/admin/products" });
    } else {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

  } catch (error) {
    console.error('Error editing product:', error);
    return res.status(500).json({ success: false, message: 'Error editing product' });
  }
};

module.exports = {
  productInfo,
  getAddProductPage,
  addProducts,
  addProductOffer,
  removeProductOffer,
  blockProduct,
  unblockProduct,
  getEditProductPage,
  editProduct
}