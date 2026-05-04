const Category = require("../../models/categorySchema") 
const Product = require("../../models/productSchema")
const {applyBestOffer} = require("../../helpers/offerHelper")

const categoryInfo = async (req,res) =>{
  try {

    const search = req.query.search?.trim() || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 3;
    const skip = (page-1) * limit;

    const categoryData = await Category.find({
      $or : [
        {name : {$regex : ".*"+search+".*"}}
      ]
    })
    .sort({createdAt : -1})
    .skip(skip)
    .limit(limit);

    const totalCategoories = await Category.countDocuments();
    const totalPages = Math.ceil( totalCategoories / limit);

    res.render("category",{
      category : categoryData,
      currentPage : page,
      totalPages : totalPages,
      totalCategoories : totalCategoories,
      search : search
    })
    
  } catch (error) {
    console.error("Error loading category info : ",error);
    res.redirect("/admin/pageNotFound")
    
  }
}

const addCategory = async (req, res) =>{
  try {

    const {name, description} = req.body;
    
    const existingCategory = await Category.findOne({name})
    if(existingCategory){
      return res.status(400).json({message :"This category already exists"})
    }

    const newCategory = new Category({
      name,
      description
    })
    await newCategory.save();
    return res.json({message : "Category added succesfully"})
    
  } catch (error) {
    console.error("Error adding new category : ",error);
    res.redirect("/admin/pageNotFound")
    
  }
}


// const addCategoryOffer = async (req,res) =>{
//   try {
//     const percentage = parseInt(req.body.percentage);
//     const categoryId = req.body.categoryId;

//     console.log("CATEGORY ID RECEIVED:", req.body.categoryId);
    
//     if (!categoryId || categoryId.trim() === "") {
//       return res.status(400).json({
//           status: false,
//           message: "Category ID is required"
//       });
//     }

//     if (!percentage || isNaN(percentage) || percentage <= 0 || percentage > 90) {
//       return res.send({ success: false, message: "Invalid percentage" });
//     }

//     const category = await Category.findById(categoryId);
//     if(!category){
//       return res.status(400).send({success: false, message : "This category doesn't exist"})
//     }

//     const products = await Product.find({ category : categoryId})

//     const hasProductOffer = products.some(product =>product.productOffer > 0);
//     if(hasProductOffer){
//       return res.send({
//         success : false,
//         message : 'Cannot add offers, because Products in this category already have product-level offers'
//       })
//     }

//     category.categoryOffer = percentage;
//     await category.save();

//     for (const product of products){
//       product.productOffer = 0;
//        product.salePrice = Math.floor(
//         product.regularPrice - (product.regularPrice * percentage) / 100
//       );
//       await product.save();
//     }

//     return res.send({success : true, message : 'Added product offer succesfully'})

//   } catch (error) {
//     console.error("Error adding category offer  : ",error);
//     return res.status(400).send({success : false, message : 'Error adding category offer'})
//   }
// }

const addCategoryOffer = async (req, res) => {
  try {
    const percentage = parseInt(req.body.percentage);
    const categoryId = req.body.categoryId;

    if (!categoryId) {
      return res.status(400).json({ success: false, message: "Category ID required" });
    }

    if (!percentage || isNaN(percentage) || percentage <= 0 || percentage > 90) {
      return res.status(400).json({ success: false, message: "Invalid percentage" });
    }

    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(400).json({ success: false, message: "Category not found" });
    }

    // Update category offer
    category.categoryOffer = percentage;
    await category.save();

    // Update all products inside this category
    const products = await Product.find({ category: categoryId });

    for (const product of products) {
      applyBestOffer(product, category.categoryOffer); // compare productOffer vs categoryOffer
      await product.save();
    }

    return res.send({ success: true, message: "Category offer applied successfully" });

  } catch (error) {
    console.error("Error adding category offer:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};


const removeCategoryOffer = async (req, res) =>{
  try {
    const categoryId = req.body.categoryId;
    const category = await Category.findById(categoryId)
  
    if(!category){
      return res.status(400).send({success : false, message : 'This category doesnt exist'})
    }


    const percentage = category.categoryOffer;
    const products = await  Product.find({category : category._id})

 // Remove offer and reset price
      for (let product of products){
        product.productOffer = 0;
        applyBestOffer(product, 0);
        await product.save();
      }

    
    // Reset category offer
    category.categoryOffer = 0;
    await category.save();
    return res.status(200).send({success : true, message : "Removed product offer succesfully"})

  } catch (error) {
    console.error("Error removing category offer  : ",error);
    res.status(400).send({success : false, message : 'Error removing category offer'})
  }
}


const listCategory = async (req,res) =>{
  try {
    let id = req.query.id;
    await Category.updateOne({_id : id}, {$set : {isListed : true}})
    return res.redirect("/admin/category")
  } catch (error) {
    console.error('Error listing category  : ',error);
    res.redirect("/admin/pageNotFound")
  }
}

const unlistCategory = async( req, res) =>{
  try {
    let id = req.query.id;
    await Category.updateOne({_id : id},{$set : {isListed : false}})
    return res.redirect("/admin/category")
  } catch (error) {
    console.error('Error unlisting category  : ',error);
    res.redirect("/admin/pageNotFound")
  }
}

const getEditCategory = async (req, res) =>{
  try {
    const id = req.params.id;
    const category = await Category.findOne({_id: id})
    res.render("edit-category", {category : category})    
  } catch (error) {
    console.log("Error loading edit-category page : ", error);
    res.redirect("/admin/pageNotFound")
  }
}


const editCategory = async (req,res) =>{
  try {
    const id = req.params.id;
    const { categoryName, description} = req.body;

    const existingCategory = await Category.findOne({name : categoryName, _id:{ $ne : id}});
    if(existingCategory){
      return res.status(400).json({success : false, message : "This category already exists, please choose another name"})
    }
    const updateCategory = await Category.findByIdAndUpdate(id,{
       name : categoryName, 
       description : description
      }, {new : true} )

    if(updateCategory){
      return res.json({
        success: true,
        message: "Category updated successfully",
        redirectUrl: "/admin/category"
      });

    }else{
      return res.status(404).json({success : false, error : 'Category not found'})
    }

  } catch (error) {
    console.error('Error updating category : ', error);
    return res.status(500).json({
        success: false,
        message: "Server error while updating category"
    });
  }
}

module.exports = {
  categoryInfo,
  addCategory,
  addCategoryOffer,
  removeCategoryOffer,
  unlistCategory,
  listCategory,
  getEditCategory,
  editCategory
}