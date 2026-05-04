const User = require("../../models/userSchema")
const Address = require("../../models/addressSchema")
const Order = require("../../models/orderSchema")
const nodemailer = require("nodemailer");
const env = require("dotenv").config();
const bcrypt = require("bcrypt");
const session = require("express-session");
const Wallet = require("../../models/walletSchema")


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

const getForgotPassPage = async (req,res) =>{
  try {
    res.render("forgot-password-page")
  } catch (error) {
    console.log("Error loading forgot-password page : ", error);
    res.redirect("/pageNotFound");
  }
}

const forgotEmailValid = async (req, res) =>{
  try {
    
    const {email} = req.body;
    const findUser = await User.findOne({email : email})
    if(findUser){
      const otp = generateOtp();
      const emailSent = await sendVerificationEmail(email, otp);
      if(emailSent){
        req.session.otp = otp;
        req.session.email = email;
        res.render("forgotpass-otp-page")
        console.log("Forgot password OTP : ",otp)
      }else{
        res.render("forgot-password-page", {
          success : false,
          message : 'Failed to send otp, please try again',
        })
      }
    }else{
      res.render("forgot-password-page", {
        success : false,
        message : 'User with this email does not exist, Please try again'
      })
    }

  } catch (error) {
    console.log("Error loading forgot-password email validation page : ", error);
    res.redirect("/pageNotFound")
  }
}

const verifyForgotPassOtp = async (req, res) =>{
  try {
    
    const enteredOtp = req.body.otp;
    const otp = generateOtp()
    if( enteredOtp == req.session.otp){
      res.json({
        success : true,
        message : 'OTP verified succefully',
        redirectUrl : '/reset-password'        
      })
    }else{
      res.json({
        success : false,
        message : 'OTP not matching'})
    }

  } catch (error) {
    console.log("An error occured while verifying otp, please try again : ", error);
    res.json({
      success : false,
      message : 'An error occured while verifying otp, please try again'
    })
  }
}

const getResetPassPage = async (req, res) =>{
  try {
    res.render("reset-password")
  } catch (error) {
    console.log("Error loading rest-password page : ", error);
    res.redirect("/pageNotFound");
  }
}

const resendOtp = async (req, res)=>{
  try {
    const otp = generateOtp();
    req.session.otp = otp;
    const email = req.session.email;
    console.log("Resending otp to email : ", email, "OTP : ",otp )
    const emailSent = await sendVerificationEmail( email, otp);
    if(emailSent){
      console.log("Resent OTP : ",otp)
      res.status(200).json({
        success : true,
        message : 'OTP resent succesfully'
      })
    }

  } catch (error) {
    console.log("Error resending otp : ", error);
    return res.status(500).json({
      success : false,
      message : 'Internal Server Error'
    })
  }
}

const postNewPassword = async ( req, res) =>{
  try {
    const {newPass1, newPass2} = req.body;
    const email = req.session.email;
    if(newPass1 === newPass2){
      const passwordHash = await securePsssword(newPass1);
      await User.updateOne(
        {email : email},
        {$set : {password : passwordHash}}
      )
      res.redirect('/login?reset=success');
    }else{
      res.render("reset-password", {
        success : false,
        message : 'Passwords do not match'
      })
    }
  } catch (error) {
    console.log("Error resetting password : ",error);
    return res.status(500).json({
      success : false,
      message : 'An error occured while restting password'
    })
  }
}

const userProfile = async (req, res) =>{
  try {
    const userId = req.session.user;
    const userData = await User.findById(userId);
    const addressData = await Address.findOne({userId : userId});
    const wallet = await Wallet.findOne({userId})

    const totalOrders = await Order.countDocuments({ userId})
    const deliveredOrders = await Order.countDocuments({
      userId,
      status : 'Delivered'
    })
    const pendingOrders = await Order.countDocuments({
      userId,
      status : 'Pending'
    })

    res.render("user-profile", {
      user : userData,
      userAddress : addressData ? addressData.address : [],
      totalOrders,
      deliveredOrders,
      pendingOrders,
      wallet
    })
  } catch (error) {
    console.log("Error getting user profile : ",error);
    res.status(500).json({
      success: false,
      message: "Intrenal Server Error - Error getting user profile, Please try again",
    });
  }
}

const getEditProfile = async(req, res) =>{
  try {
    const userId = req.session.user;
    const userData = await User.findById(userId)
    res.render("edit-profile",{
      user : userData
    })
  } catch (error) {
    console.log("Error getting edit profile page : ",error);
    res.status(500).json({
      success: false,
      message: "Intrenal Server Error - Error getting edit profile page, Please try again",
    });
  }
}

const editProfile = async(req, res) =>{
  try {
    const userId = req.session.user;
    const {name, email, phone} = req.body;
    const user = await User.findById(userId)
    // email not changed
    if(user.email === email){
        await User.findByIdAndUpdate(userId, {
          name : name,
          phone : phone
        })
        return res.redirect("/userProfile?success=1")
    }
    // email changed → send OTP

    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(email, otp);
    if(emailSent){
      req.session.otp = otp
      req.session.newname = name
      req.session.newemail = email
      req.session.newphone = phone
      res.render("verify-otp-emailchange")
      console.log("OTP for email change : ",otp)
    }else{
      console.log("Failed to send otp")
      res.render("user-profile", {
          success : false,
          message : 'Failed to send otp, please try again',
        })
    }

  } catch (error) {
    console.log("Error  editing profile  : ",error);
    res.status(500).json({
      success: false,
      message: "Intrenal Server Error - Error editing profile , Please try again",
    });
  }
}

const otpVerify = async (req, res) =>{
  try {
    const enteredOtp = req.body.otp;
    const userId = req.session.user;

    console.log("OTPs : ", req.session.otp, enteredOtp)
    if( enteredOtp == req.session.otp){

      await User.findByIdAndUpdate(userId,{
        name : req.session.newname,
        email : req.session.newemail,
        phone : req.session.newphone
      })

      delete req.session.otp;
      delete req.session.newname;
      delete req.session.newemail;
      delete req.session.newphone;
      res.json({
        success : true,
        message : 'OTP verified succefully',
        redirectUrl : '/userProfile'        
      })
    }else{
      res.json({
        success : false,
        message : 'OTP not matching'})
    }

  } catch (error) {
    console.log("An error occured while verifying otp, please try again : ", error);
    res.json({
      success : false,
      message : 'An error occured while verifying otp, please try again'
    })
  }
}



const editProfileImage = async (req,res) =>{
  try {
    const userId = req.session.user;
    console.log("image : ",  req.file)
    const image = `/uploads/product-images/${req.file.filename}`
    await User.findByIdAndUpdate(userId ,{
      profileImage : image
    })
    res.status(200).json({
      success : true,
      message : 'image uploaded successfully'
    })
  } catch (error) {
    console.log("Error editing pro pic : ",error)
    res.status(500).json({
      success : false,
      message : 'Internal server error while  editing pro pic'
    })
  }
}

const getChangePassword = async (req, res) =>{
  try {
    res.render("change-password")
  } catch (error) {
    console.log("Error gettting change password page : ",error)
    res.status(500).json({
      success : false,
      message : 'Internal server error while getting change password page'
    })
  }
}

const changePassword = async(req, res) =>{
  try {
    const userId = req.session.user;
    const {currentPassword, newPassword, confirmPassword} = req.body;
    const user = await User.findById(userId);
    const passwordMatch = await bcrypt.compare(currentPassword, user.password);
    if(!passwordMatch){
      return res.status(400).json({success : false, message :'Current password is wrong'})
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({success : false, message :'New passwords do not match'})
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10)
    await User.findByIdAndUpdate(userId, {
      password: hashedPassword
    });

    return res.redirect("/userProfile?passsuccess=1")

  } catch (error) {
    console.log("Error changing password : ",error)
    res.status(500).json({
      success : false,
      message : 'Internal server error while  changing password '
    })
  }
}

const getAddAddress = async (req, res) =>{
  try {
    const user = req.session.user;
    res.render("add-address")
  } catch (error) {
    console.log("Error geting add-address page : ",error)
    res.status(500).json({
      success : false,
      message : 'Internal server error while geting add-address page'
    })
  }
}

const addAddress = async(req, res) =>{
  try {
    console.log("hhhooooooooooo")
    const userId = req.session.user;
    const userData = await User.findById(userId)
    const {addressType, name, city, landMark, state, pincode, phone, altPhone, isDefault} = req.body;
    console.log("BOSY : ",req.body)
    const userAddress = await Address.findOne({userId : userData._id})
    if(!userAddress){
      const newAddress = new Address({
        userId : userData._id,
        address : [{addressType, name, city, landMark, state, pincode, phone, altPhone, isDefault : true}]
      })
      await newAddress.save();
    }else{
     
      if (isDefault) {
        userAddress.address.forEach(addr => addr.isDefault = false);
      }
      const newAddress = {
          addressType,
          name,
          city,
          landMark,
          state,
          pincode,
          phone,
          altPhone,
          isDefault: isDefault
      }
      userAddress.address.push(newAddress)
      await userAddress.save()
    }
    // res.redirect("/userProfile?success=1")
    res.status(200).json({ success: true });
  } catch (error) {
    console.log("Error adding address : ",error)
    res.status(500).json({
      success : false,
      message : 'Internal server error while adding address'
    })
  }
}

const getEditAddress = async (req, res) =>{
  try {
    const addressId = req.params.id;
    const userId = req.session.user;
    const addressData = await Address.findOne({userId : userId})
    const address = addressData.address.id(addressId)
    res.render("edit-address", {
      address : address
    })

  } catch (error) {
    console.log("Error loading edit address:", error)
    res.status(500).json({
      success : false,
      message : 'Error loading edit address'
    })
  }
}


const editAddress = async (req, res) =>{
  try {
    const userId = req.session.user;
    const { addressId } = req.body;
    console.log("Address id : ",addressId)
    const {addressType, name, city, landMark, state, pincode, phone, altPhone, isDefault} = req.body;
    const addressData = await Address.findOne({userId : userId})
    const address = addressData.address.id(addressId)

    address.addressType = addressType
    address.name = name
    address.city = city
    address.landMark = landMark
    address.state = state
    address.pincode = pincode
    address.phone = phone
    address.altPhone = altPhone

    // if(isDefault === 'on'){
    //   for(let i=0 ; i<addressData.address.length ; i++){
    //     addressData.address[i].isDefault = false;
    //   }
    //   address.isDefault = true;
    // }
    if (isDefault) {
      addressData.address.forEach(addr => addr.isDefault = false);
      address.isDefault = true;
    }
    await addressData.save()
    // res.redirect("/userProfile?updatesuccess=1")
    res.status(200).json({ success: true });
    
  } catch (error) {
     console.log("Error updating address:", error)
    res.status(500).json({
      success : false,
      message : 'Error updating address'
    })
  }
}

const deleteAddress = async (req, res) =>{
  try {
    const addressId = req.params.id;
    const userId = req.session.user;
    const addressData = await Address.findOne({userId : userId})
    if(!addressData){
      return res.redirect("/userProfile")
    }
    addressData.address.pull({_id : addressId})
    await addressData.save();
    res.redirect("/userProfile?deletesuccess=1")
  } catch (error) {
    console.log("Error deleting address:", error)
    res.status(500).json({
      success: false,
      message: "Error deleting address"
    })
  }
}

module.exports = {
  getForgotPassPage,
  forgotEmailValid,
  verifyForgotPassOtp,
  getResetPassPage,
  resendOtp,
  postNewPassword,
  userProfile,
  getEditProfile,
  editProfile,
  editProfileImage,
  getChangePassword,
  otpVerify,
  changePassword,
  getAddAddress,
  addAddress,
  getEditAddress,
  editAddress,
  deleteAddress
}