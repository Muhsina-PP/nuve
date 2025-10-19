const mongoose = require('mongoose')
const env = require('dotenv').config()

const connectDB = async (req, res) =>{
  try {
    await mongoose.connect(process.env.MONGODB_URI)
    console.log('DB connected');  
  } catch (error) {
    console.log('DB connection error : ', error);
    process.exit(1)   
  }
}

module.exports = connectDB