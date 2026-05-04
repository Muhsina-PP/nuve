const Brand = require("../../models/brandSchema")
const Product = require("../../models/productSchema")

const getBrandPage = async (req,res) =>{
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 4;
    const skip = (page -1) * limit;

    const brandData = await Brand.find({})
    .sort({createdAt : -1})
    .skip(skip)
    .limit(limit)

    const totalBrands = await Brand.countDocuments();
    const totalPages = Math.ceil(totalBrands / limit);

    res.render("brands", {
      brand : brandData,
      currentPage : page,
      totalBrands : totalBrands,
      totalPages : totalPages
    })
  } catch (error) {
      console.error('Error loading brand listing page  : ', error);
      return res.status(500).json({
        success : false,
        message : "Server error while loading brands listing page"
      })
  }
}

const addBrand = async (req, res) => {
  try {
    const brandName = req.body.name?.trim();

    if (!brandName) {
      return res.status(400).send({
        success: false,
        message: "Brand name is required",
      });
    }
    if (!req.file) {
      return res.status(400).send({
        success: false,
        message: "Brand image is required",
      });
    }

    const existingBrand = await Brand.findOne({ brandName });
    if (existingBrand) {
      return res.status(400).send({
        success: false,
        message: "This brand already exists",
      });
    }

    const image = req.file.filename;

    const newBrand = new Brand({
      brandName: brandName,
      brandImage: image,
    });

    await newBrand.save();

    return res.status(200).json({
      success : true,
      message :"Brand added successfully",
      redirectUrl : "/admin/brands",     
    })
  } catch (error) {
    console.error("Error adding new brands:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while adding new brands",
    });
  }
};

const blockBrand = async(req,res) =>{
  try {
    const id = req.query.id;
    await Brand.updateOne({_id : id},{$set : {isBlocked : true}});
    res.redirect("/admin/brands")
  } catch (error) {
    console.error('Error blocking brand : ',error);
    return res.status(404).json({
      success : false,
      message : 'Error blocking brand'
    })   
  }
}

const unblockBrand = async(req,res) =>{
  try {
    const id = req.params.id;
    await Brand.updateOne({_id : id},{$set : {isBlocked : false}});
    res.redirect("/admin/brands")
  } catch (error) {
    console.error('Error unblocking brand : ',error);
    return res.status(404).json({
      success : false,
      message : 'Error unblocking brand'
    })   
  }
}

const deleteBrand = async (req, res) =>{
  try {
    const id = req.query.id;
    if(!id){
      return res.status(404).json({
        success : false,
        message : 'There is no brand with this id to delete'        
      })  
    }
    await Brand.deleteOne({_id : id})
    res.redirect("/admin/brands")
  } catch (error) {
    console.error('Error deleting brand : ',error);
    return res.status(404).json({
      success : false,
      message : 'Error deleting brand'
    })
  }
}


module.exports = {
  getBrandPage,
  addBrand,
  blockBrand,
  unblockBrand,
  deleteBrand
}