const express = require("express");
const router = express.Router();
const userController = require("../controllers/user/userController");
const profileController = require("../controllers/user/profileController")
const productController = require("../controllers/user/productController")
const cartController = require("../controllers/user/cartController")
const checkoutController = require("../controllers/user/checkoutController")
const walletController = require("../controllers/user/walletController")
const {userAuth , adminAuth} = require("../middlewares/auth")
const wishlistController = require("../controllers/user/wishlistController")
const orderController = require("../controllers/user/orderController")
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


// Wallet management
router.get("/wallet", userAuth, walletController.loadWallet)

// Address management
router.get("/addAddress", userAuth, profileController.getAddAddress)
router.post("/addAddress", userAuth, profileController.addAddress)
router.get("/editAddress/:id", userAuth, profileController.getEditAddress)
router.post("/editAddress", userAuth, profileController.editAddress)
router.get("/deleteAddress/:id", userAuth, profileController.deleteAddress)

// Product management
router.get("/productDetails", userAuth, productController.productDetails)

// Wishlist management
router.get("/wishlist",userAuth,wishlistController.loadWishlist)
router.post('/addToWishlist',userAuth, wishlistController.addToWishlist)
router.get('/removeFromWishlist', userAuth, wishlistController.removeFromWishlist)

// Cart management
router.get("/cart", userAuth, cartController.loadCart)
router.post("/addToCart", userAuth, cartController.addToCart);
router.get('/updateCart', userAuth, cartController.updateCart);
router.get("/removeFromCart",userAuth, cartController.removeFromCart);


// Checkout management
router.get("/checkout", userAuth, checkoutController.loadCheckoutPage )
router.post("/deleteAddress", userAuth, checkoutController.deleteAddress)
router.post("/placeOrder", userAuth, checkoutController.placeOrder)
router.get("/orderSuccess", userAuth, checkoutController.orderSuccess)
router.post("/create-razorpay-order", userAuth, checkoutController.createRazorpayOrder);
router.post('/verify-payment', userAuth, checkoutController.verifyPayment);
router.get("/check-cart", userAuth, checkoutController.checkCart)
router.post("/apply-coupon", userAuth, checkoutController.applyCoupon);



// Order management
router.get("/orders", userAuth, orderController.loadOrders)
router.get("/order-details/:id", userAuth, orderController.loadOrderDetails);
router.get('/orderDetails/:id', userAuth, orderController.loadOrderDetails);
router.get("/download-invoice/:id", userAuth, orderController.downloadInvoice);
router.post("/cancel-full-order", userAuth, orderController.cancelFullOrder);
router.post("/cancel-order", userAuth, orderController.cancelSingleItem);
router.patch("/return-item",userAuth, orderController.returnOrder);

module.exports = router;
