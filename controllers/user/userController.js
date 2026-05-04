const User = require("../../models/userSchema");
const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");
const Banner = require("../../models/bannerSchema")
const Brand = require("../../models/brandSchema")
const nodemailer = require("nodemailer");
const env = require("dotenv").config();
const bcrypt = require("bcrypt");

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendVerificationEmail(email, otp) {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD,
      },
    });
    const info = await transporter.sendMail({
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: "Verify your email",
      text: `Your OTP is ${otp}`,
      html: `<b> OTP : ${otp}</b>`,
    });

    return info.accepted.length > 0;
  } catch (error) {
    console.error("Error Sending OTP : ", error);
    return false;
  }
}

const securePsssword = async (password) => {
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    return passwordHash;
  } catch (error) {
    console.error("Error securing password : ", error);
    return false;
  }
};

const loadHomepage = async (req, res) => {
  try {
    const user = req.session.user;
    const today = new Date().toISOString();
    const findBanner = await Banner.find({
      startDate : {$lt: new Date(today)},
      endDate : {$gt: new Date(today)}
    })
    
    const categories = await Category.find({isListed : true});
    const productsData = await Product.find({
      isBlocked : false,
      category : { $in :categories.map(category => category._id)},
      "variants.stock" : {$gt : 0}
    })
    .sort({ createdAt : -1})
    .limit(4)

    if(user){
      const userData = await User.findById(user)
      res.render("home", { user : userData, products : productsData, banner : findBanner || []})
    }else{
      res.render("home", {products : productsData, banner : findBanner || []})
    }

  } catch (error) {
    console.log(`Error loading home page : `, error);
    res.status(500).send("Error loading home page");
  }
};

const pageNotFound = async (req, res) => {
  try {
    res.render("page-404");
  } catch (error) {
    res.redirect("/pageNotFound");
    console.log("Error getting page-404 : ", error);
  }
};

const loadSignup = async (req, res) => {
  try {
    res.render("signup");
  } catch (error) {
    console.log("Error loading signup page : ", error);
    res.redirect("/pageNotFound");
  }
};

const signup = async (req, res) => {
  try {
    const { name, email, phone, password, cPassword } = req.body;
    if (password !== cPassword) {
      return res.render("signup", { message: "Passwords do not match" });
    }
    const findUser = await User.findOne({ email });
    if (findUser) {
      return res.render("signup", {
        message: "User with this email already exists",
      });
    }

    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(email, otp);

    if (!emailSent) {
      return res.json("Email error");
    }

    req.session.userOtp = otp;
    req.session.userData = { name, phone, email, password };

    res.render("verify-otp");
    console.log("OTP : ",otp);
    

  } catch (error) {
    console.error("Signup error : ", error);
    res.redirect("/pageNotFound");
  }
};

const loadLogin = async (req, res) => {
  try {
    if (!req.session.user) {
      res.render("login");
    } else {
      res.redirect("/");
    }
  } catch (error) {
    console.log("Error loading login page : ", error);
    res.redirect("/pageNotFound");
  }
};

const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    console.log("Otp : ", otp);
    if (otp === req.session.userOtp) {
      const user = req.session.userData;
      const passwordHash = await securePsssword(user.password);

      const saveUserData = new User({
        name: user.name,
        email: user.email,
        phone: user.phone,
        password: passwordHash,
      });

      await saveUserData.save();
      req.session.user = saveUserData._id;
      res.json({ success: true, redirectUrl: "/" });
    } else {
      res
        .status(400)
        .json({ success: false, message: "Invalid OTP, please try again" });
    }
  } catch (error) {
    console.error("Erro verifying otp : ", error);
    res.status(500).json({ success: false, message: "Error verifying otp" });
  }
};

const resendOtp = async (req, res) => {
  try {
    const { email } = req.session.userData;
    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "Email not found in session" });
    }
    const otp = generateOtp();
    req.session.userOtp = otp;

    const emailSent = await sendVerificationEmail(email, otp);
    if (emailSent) {
      console.log("Resend Otp : ", otp);
      res
        .status(200)
        .json({ success: true, message: "Otp resent succesfully" });
    } else {
      res.status(500).json({
        success: false,
        message: "Failed to resend otp, Plz try again",
      });
    }
  } catch (error) {
    console.error("Failed to resend otp : ", error);
    res.status(500).json({
      success: false,
      message: "Intrenal Server Error, Please try again",
    });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if(!email || !password){
      return res.render("login" ,{message : "All fields are required"})
    }

    const findUser = await User.findOne({ isAdmin: 0, email: email });
    if (!findUser) {
      return res.render("login", { message: "User not found" });
    }
    if (findUser.isBlocked) {
      return res.render("login", { message: "This user is blocked by admin" });
    }

    const passwordMatch = await bcrypt.compare(password, findUser.password);

    if (!passwordMatch) {
        return res.status(400).json({ message: "Incorrect password" });
    }

    req.session.user = findUser._id;
    return res.redirect("/");
  } catch (error) {
    console.error(" Login user : ", error);
    res.render("login", { message: "Login failed" });
  }
};

const logout = async (req,res) =>{
  try {

    req.session.destroy((err)=>{
      if(err){
        console.error("Session destruction error");
        return res.redirect("/pageNotFound")
      }
      return res.redirect("/login")
    })
  } catch (error) {
    console.log("Logout error : ",error);
    res.redirect("/pageNotFound")
  }
}

// const loadShopPage = async (req, res) =>{
//   try {
//     const user = req.session.user;
//     const userData = await User.findOne({_id : user})

//     const categories = await Category.find({isListed : true})
//     const brands = await Brand.find({isBlocked : false})
    
//     const categoryIds = categories.map((category) => category._id)

//     const search = req.query.search || "";

//     const page = parseInt(req.query.page) ||1;
//     const limit = 6;
//     const skip = (page-1) * limit;

//     // filter values
//     const selectedCategory = req.query.category?.trim()
//     const selectedBrand = req.query.brand?.trim()
//     const minPrice = req.query.minPrice ? Number(req.query.minPrice) : undefined;
//     const maxPrice = req.query.maxPrice ? Number(req.query.maxPrice) : undefined;


//     // query object 
//     let query = {
//       productName : {$regex : search, $options : 'i'},
//       isBlocked : false,
//       category : {$in : categoryIds},
//       variants: { $elemMatch: { stock: { $gt: 0 } } }
//     }

//    if(selectedCategory){
//       query.category = selectedCategory
//     }

//     if(selectedBrand){
//       query.brand = selectedBrand
//     }

//     if(minPrice !== undefined && maxPrice !== undefined){
//       query.salePrice = { $gte: minPrice, $lte: maxPrice }
//     }

//     else if(minPrice !== undefined && maxPrice === undefined){
//       query.salePrice = { $gte: minPrice }
//     }

//      // sorting value
//     const sort = req.query.sort || "";
//     const sortOption = req.query.sort || ""
//     let sortQuery = {_id : -1};

//     if(sortOption === "priceLow"){
//       sortQuery = {salePrice : 1}
//     }
//     else if(sortOption === "priceHigh"){
//       sortQuery = {salePrice : -1}
//     }
//     else if(sortOption === "a-z"){
//       sortQuery = {productName : 1}
//     }
//     else if(sortOption === "z-a"){
//       sortQuery = {productName : -1}
//     }

//     const products = await Product.find(query)
//     .populate('brand')
//     .sort(sortQuery)
//     .skip(skip)
//     .limit(limit)
    

//     const totalProducts = await Product.countDocuments(query)
//     const totalPages = Math.ceil(totalProducts / limit)
//     const categoryWithIds = categories.map(category => ({ 
//       _id : category._id,
//       name : category.name
//     }))

//     res.render("shop",{
//       user : userData,
//       products : products ,
//       category : categoryWithIds,
//       brand : brands,
//       totalProducts : totalProducts,
//       currentPage : page,
//       totalPages : totalPages,
//       search : search,
//       sortOption,
//       selectedCategory,
//       selectedBrand,
//       minPrice,
//       maxPrice,
//       sort
//     })
//   } catch (error) {
//     console.log("Cannot get shop page : ",error);
//     res.redirect("/pageNotFound")
//   }
// }
const loadShopPage = async (req, res) =>{
  try {
    const user = req.session.user;
    const userData = await User.findOne({_id : user})

    const categories = await Category.find({isListed : true})
    const brands = await Brand.find({isBlocked : false})
    
    const categoryIds = categories.map((category) => category._id)

    const search = req.query.search || "";

    const page = parseInt(req.query.page) ||1;
    const limit = 6;
    const skip = (page-1) * limit;

    // filter values
    const selectedCategory = req.query.category?.trim()
    const selectedBrand = req.query.brand?.trim()
    const minPrice = req.query.minPrice ? Number(req.query.minPrice) : undefined;
    const maxPrice = req.query.maxPrice ? Number(req.query.maxPrice) : undefined;


    // query object 
    let query = {
      productName : {$regex : search, $options : 'i'},
      isBlocked : false,
      category : {$in : categoryIds}
    }

   if(selectedCategory){
      query.category = selectedCategory
    }

    if(selectedBrand){
      query.brand = selectedBrand
    }

    if(minPrice !== undefined && maxPrice !== undefined){
      query.salePrice = { $gte: minPrice, $lte: maxPrice }
    }

    else if(minPrice !== undefined && maxPrice === undefined){
      query.salePrice = { $gte: minPrice }
    }

     // sorting value
    const sort = req.query.sort || "";
    const sortOption = req.query.sort || ""
    let sortQuery = {_id : -1};

    if(sortOption === "priceLow"){
      sortQuery = {salePrice : 1}
    }
    else if(sortOption === "priceHigh"){
      sortQuery = {salePrice : -1}
    }
    else if(sortOption === "a-z"){
      sortQuery = {productName : 1}
    }
    else if(sortOption === "z-a"){
      sortQuery = {productName : -1}
    }

    const products = await Product.find(query)
    .populate('brand')
    .sort(sortQuery)
    .skip(skip)
    .limit(limit)

    const productsWithStockStatus  = products.map( p => {
      const totalStock = p.variants.reduce((sum,v)=>sum+v.stock,0);
      return{
        ...p._doc,
        stockStatus:totalStock === 0 ? 'Out of stock' : 'Available'
      }
    })
    

    const totalProducts = await Product.countDocuments(query)
    const totalPages = Math.ceil(totalProducts / limit)
    const categoryWithIds = categories.map(category => ({ 
      _id : category._id,
      name : category.name
    }))

    res.render("shop",{
      user : userData,
      products : productsWithStockStatus ,
      category : categoryWithIds,
      brand : brands,
      totalProducts : totalProducts,
      currentPage : page,
      totalPages : totalPages,
      search : search,
      sortOption,
      selectedCategory,
      selectedBrand,
      minPrice,
      maxPrice,
      sort
    })
  } catch (error) {
    console.log("Cannot get shop page : ",error);
    res.redirect("/pageNotFound")
  }
}


module.exports = {
  loadHomepage,
  pageNotFound,
  loadSignup,
  signup,
  loadLogin,
  verifyOtp,
  resendOtp,
  login,
  logout,
  loadShopPage,
};
