const express = require('express')
const app = express()
const env = require('dotenv').config()
const db = require('./config/db')
db()
const session = require('express-session')
const path = require('path')
const bcrypt = require("bcrypt")
const passport = require ("./config/passport")
const morgan = require("morgan")
const userRoutes = require('./routes/userRoutes')
const adminRoutes = require('./routes/adminRoutes')
const {injectedUser} = require("./middlewares/auth")

app.use(morgan('dev'));

app.use( express.json())
app.use (express.urlencoded({extended : true}))

app.use(
  session({
    secret: process.env.SESSION_SECRET,          
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure : false,
      maxAge: 24 * 60 * 60 * 1000,     //1 day   
      httpOnly: true,                     
    }
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.set('view engine', 'ejs')
app.set('views', [path.join(__dirname, 'views/user'), path.join(__dirname, 'views/admin')])
app.use(express.static (path.join(__dirname, 'public')))

app.use(injectedUser)

app.use("/", userRoutes)
app.use("/admin", adminRoutes)

//404 router
// app.use((req,res,next) =>{
//   res.status(404).render('page-404')
// })
// app.use((err, req, res, next) =>{
//   console.log('SERVER ERROR : ',err);
//   res.status(404).render('page-404')
// })


app.listen(process.env.PORT, ()=>{
  console.log(`Server running on 3000`);
})

module.exports = app