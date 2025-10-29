const express = require('express')
const app = express()
const env = require('dotenv').config()
const db = require('./config/db')
db()
const path = require('path')
const userRoutes = require('./routes/userRoutes')
const adminRoutes = require('./routes/adminRoutes')

app.use( express.json())
app.use (express.urlencoded({extended : true}))

app.use("/", userRoutes)
app.use("/admin", adminRoutes)

app.set('view engine', 'ejs')
app.set('views', [path.join(__dirname, 'views/user'), path.join(__dirname, 'views/admin')])
app.use(express.static (path.join(__dirname, 'public')))



app.listen(process.env.PORT, ()=>{
  console.log(`Server running on 3000`);
})

module.exports = app