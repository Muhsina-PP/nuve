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
  },
    type: {
    type: String,
    enum: ['percentage', 'flat'],
    required: true
  },
  // limit that coupon can use in total
  usageLimit  :{  
    type : Number,
    default : 1
  },
  perUserLimit :{
    type : Number,
    default : 1
  },
  usedCount :{
    type : Number,
    default : 0
  },
  usedBy: {
    type: [
      {
        userId: {
          type: Schema.Types.ObjectId,
          ref: "User"
        },
        count: {
          type: Number,
          default: 0
        }
      }
    ],
    default: []   // ✅ THIS FIXES YOUR ERROR
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    default: null
  },
  createdAt : {
    type : Date,
    default : Date.now
  }
}, { timestamps: true });


const Coupen = mongoose.model("Coupen", couponSchema)
module.exports = Coupen;
