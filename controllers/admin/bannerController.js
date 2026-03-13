const Banner = require("../../models/bannerSchema")
const path = require("path")
const fs = require("fs") 


const getBannerPage = async (req, res) =>{
  try {

    const page = parseInt(req.query.page) || 1;
    const limit = 4;
    const skip = (page-1) * limit ;

    const findBanner = await Banner.find({})
    .sort()
    .skip(skip)
    .limit(limit)

    const totalBanners = await Banner.countDocuments();
    const totalPages = Math.ceil(totalBanners / limit);

    res.render("banners", {
      banners : findBanner,
      currentPage : page,
      totalPages : totalPages,
      totalBanners : totalBanners
    })
  } catch (error) {
    console.log("Error getting banner page : ",error)
    res.status(500).send("Something went wrong while getting banner page");
    return res.redirect("/admin/pageNotFound")   
  }
}

const getAddBannerPage = async (req, res) =>{
  try {
    res.render("add-banner")
  } catch (error) {
    console.log("Error getting add banner page : ",error)
    res.status(500).send("Something went wrong while getting add banner page");
    return res.redirect("/admin/pageNotFound")
  }
}

const addBanner = async (req, res) =>{
  try {
    const banners = req.body;
    const image = req.file;
    const newBanner = new Banner({
      image : image.filename,
      title : banners.title,
      description : banners.description,
      link : banners.link,
      startDate : new Date(banners.startDate+"T00:00:00"),
      endDate : new Date(banners.endDate+"T00:00:00")
    })
    await newBanner.save().then((banners)=>console.log("Banner : ",banners))
    res.redirect("/admin/banner?success=bannerAdded")
  } catch (error) {
    console.log("Error adding banner  : ",error)
    res.status(500).send("Something went wrong while adding new banner");
    return res.redirect("/admin/pageNotFound")
  }
}

const deleteBanner = async (req, res) =>{
  try {
    const id = req.query.id;
    await Banner.deleteOne({_id:id})
    res.redirect("/admin/banner")
  } catch (error) {
    console.log("Error deleting banner  : ",error)
    res.status(500).send("Something went wrong while deleting  banner");
    return res.redirect("/admin/pageNotFound")
  }
}

module.exports = {
  getBannerPage,
  getAddBannerPage,
  addBanner,
  deleteBanner
}