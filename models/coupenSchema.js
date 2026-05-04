const mongoose = require("mongoose");
const {Schema} = mongoose

const couponSchema = new Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  discount: {
    type: Number, // flat discount for now (simple)
    required: true
  },
  minAmount: {
    type: Number,
    default: 0
  },
  expiry: {
    type: Date,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });


const Coupen = mongoose.model("Coupen", couponSchema)
module.exports = Coupen;
