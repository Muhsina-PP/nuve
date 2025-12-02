const express = require("express");
const router = express.Router();
const userController = require("../controllers/user/userController");
const {userAuth , adminAuth} = require("../middlewares/auth")
const passport = require("passport");

router.get("/", userController.loadHomepage);
router.get("/pageNotFound", userController.pageNotFound);
router.get("/signup", userController.loadSignup);
router.post("/signup", userController.signup);
router.get("/login", userController.loadLogin);
router.post("/login", userController.login);
router.post("/verify-otp", userController.verifyOtp);
router.post("/resend-otp", userController.resendOtp);
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

module.exports = router;
