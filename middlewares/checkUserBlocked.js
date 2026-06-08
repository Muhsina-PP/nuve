const User = require("../models/userSchema")

const checkuserBlocked = async (req, res, next) => {
  try {
    if (!req.session.user) {
      return next()
    }
    const user = await User.findById(req.session.user);
    if (!user) {
      req.session.destroy()
      return res.redirect("/login")
    }
    if (user.isBlocked) {
      req.session.destroy();
      return res.redirect("/login?message=Your account has been blocked")
    }
    next();
  } catch (error) {
    console.log("Error checking user status:", error);
    return res.redirect("/login");
  }
}


module.exports = checkuserBlocked;