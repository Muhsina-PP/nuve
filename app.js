const express = require('express')
const app = express()
const env = require('dotenv').config()
const db = require('./config/db')
db()
const session = require('express-session')
const path = require('path')
const bcrypt = require("bcrypt")
const passport = require("./config/passport")
const morgan = require("morgan")
const userRoutes = require('./routes/userRoutes')
const adminRoutes = require('./routes/adminRoutes')
const { injectedUser } = require("./middlewares/auth")
const userCounts = require("./middlewares/userCounts")
const checkUserBlocked = require("./middlewares/checkUserBlocked")

app.use(morgan('dev'));
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  next();
});


app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      maxAge: 24 * 60 * 60 * 1000,     //1 day   
      httpOnly: true,
    }
  })
);

// const User = require("./models/userSchema")
// app.get("/welcome", async (req, res) => {
//   try {
//     const users = await User.find({}, "name email")
//     res.json(users)
//   } catch (error) {
//     console.log("error : ", error)
//     res.status(500).send("Server Error")
//   }
// })


app.use(passport.initialize());
app.use(passport.session());

app.set('view engine', 'ejs')
app.set('views', [path.join(__dirname, 'views/user'), path.join(__dirname, 'views/admin')])
app.use(express.static(path.join(__dirname, 'public')))

app.use(injectedUser)
app.use(userCounts)
app.use(checkUserBlocked)

app.use("/", userRoutes)
app.use("/admin", adminRoutes)
app.use((req, res) => {
  res.status(404).render("page-404");
});

app.listen(process.env.PORT, () => {
  console.log(`Server running on 3000`);
})

module.exports = app