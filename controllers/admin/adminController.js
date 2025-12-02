const User = require("../../models/userSchema")
const mongoose = require("mongoose")
const bcrypt = require("bcrypt")

const pageNotFound = async (req, res) => {
  try {
    return res.render("pageError");
  } catch (error) {
    console.log("Error getting page-404 : ", error);
    return res.status(500).send("Something went wrong");
  }
};


const loadLogin = (req, res) =>{
  try {  
    if(req.session.admin){
      return res.redirect("/admin/dashboard")
    }
    return res.render("admin-login", {message : null})
  } catch (error) {
    console.error("Admin login page loading error : ",error);  
    return res.redirect("/admin/pageNotFound")   
  }
}


const login = async (req, res) => {
  try {
    const email = req.body.email.trim().toLowerCase();
    const password = req.body.password;

    const admin = await User.findOne({ email, isAdmin: true });

    if (!admin) {
      return res.redirect("/admin/login");
    }

    const passwordMatch = await bcrypt.compare(password, admin.password);

    if (!passwordMatch) {
      return res.redirect("/admin/login");
    }

    req.session.admin = admin._id;

    return res.redirect("/admin/dashboard");

  } catch (error) {
    console.log("Admin login error:", error);
    return res.redirect("/admin/pageNotFound");
  }
};


const loadDashboard = async(req,res) =>{
    try {
      if(!req.session.admin){
         return res.redirect("/admin/login");
      }
      return res.render("dashboard") 
    } catch (error) {
      console.log("Loading dashboard error : ",error);
      return res.redirect("/admin/pageNotFound")   
    }
}

const logout = async (req,res) =>{
  try {
    req.session.destroy (err =>{
      if(err){
        console.log("Error destroying session : ",err);   
        return res.redirect("/admin/pageNotFound")    
      }
      res.redirect("/admin/login")
    })
  } catch (error) {
    console.log("Error logging out admin : ",error);
    return res.redirect("/admin/pageNotFound")
  }
}

module.exports = {
  pageNotFound,
  loadLogin,
  login,
  loadDashboard,
  logout
}