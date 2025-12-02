const User = require("../../models/userSchema");
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
      html: `<b>Your OTP : ${otp}</b>`,
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
    res.render("home");
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

module.exports = {
  loadHomepage,
  pageNotFound,
  loadSignup,
  signup,
  loadLogin,
  verifyOtp,
  resendOtp,
  login,
  logout
};
