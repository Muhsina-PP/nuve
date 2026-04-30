const User = require("../models/userSchema")

// to automatically add the logged-in users to all views
const injectedUser = async (req, res, next)=>{
  if(req.session.user){
    res.locals.user = await User.findById(req.session.user).lean();
  }else if(req.user){
    res.locals.user = req.user;
  }else{
    res.locals.user = null;
  }
  next();
}

const userAuth = (req, res, next) => {
  if (req.session && req.session.user) {
    next();
  } else {
    res.redirect('/login');
  }
};

const adminAuth = async (req, res, next) => {
  try {  
    await User.findOne({ isAdmin: true });
    if (req.session.admin) {
      next();
    } else {
      res.redirect("/admin/login");
    }
  } catch (error) {
    console.log("Error in admin auth middleware:", error);
    res.status(500).send("Internal Server Error");
  }
};


module.exports = {
  injectedUser,
  userAuth,
  adminAuth
};