const express = require("express");
const router = express.Router();
const userController = require("../controllers/user/userController");
const profileController = require("../controllers/user/profileController")
const {userAuth , adminAuth} = require("../middlewares/auth")
const passport = require("passport");
const { ProfilingLevel } = require("mongodb");
const multer = require("multer")
const storage = require("../helpers/multer")
const upload = require("../helpers/multer")

router.get("/pageNotFound", userController.pageNotFound);
router.get("/signup", userController.loadSignup);
router.post("/signup", userController.signup);
router.post("/verify-otp", userController.verifyOtp);
router.post("/resend-otp", userController.resendOtp);

// Login management
router.get("/login", userController.loadLogin);
router.post("/login", userController.login);
router.get("/logout", userController.logout)

router.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account",
  })
);
router.get(
  "/google/callback", (req, res, next) =>{
     passport.authenticate("google", (err, user, infor)=>{
      if(err) return next(err);

      if(!user){
        return res.render("login", {message : "User is blocked by admin"})
      }
      req.logIn(user, (err) =>{
        if(err) return next(err);
        res.redirect("/");
      })
     })(req, res, next);
  }
);

// Homepage and shop page managememt
router.get("/", userController.loadHomepage);
router.get("/shop", userAuth, userController.loadShopPage)


// Profile management
router.get("/forgot-password", profileController.getForgotPassPage)
router.post("/forgot-email-valid", profileController.forgotEmailValid)
router.post("/verify-passForgot-otp", profileController.verifyForgotPassOtp)
router.get("/reset-password", profileController.getResetPassPage)
router.post("/resend-forgot-otp", profileController.resendOtp)
router.post("/reset-password", profileController.postNewPassword)
router.get("/userProfile", userAuth, profileController.userProfile)
router.get("/edit-profile", userAuth, profileController.getEditProfile)
router.post("/edit-profile",userAuth, profileController.editProfile)
router.post("/edit-profileImage", userAuth, upload.single("image"), profileController.editProfileImage )
router.post("/validate-otp", userAuth,profileController.otpVerify)
router.get("/change-password", userAuth, profileController.getChangePassword)
router.post("/change-password", userAuth, profileController.changePassword)

// Address management
router.get("/addAddress", userAuth, profileController.getAddAddress)
router.post("/addAddress", userAuth, profileController.addAddress)
router.get("/editAddress/:id", userAuth, profileController.getEditAddress)
router.post("/editAddress", userAuth, profileController.editAddress)
router.get("/deleteAddress/:id", userAuth, profileController.deleteAddress)



module.exports = router;
