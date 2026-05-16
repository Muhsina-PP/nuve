const mongoose = require ("mongoose")
const {Schema} =mongoose;
const walletSchema = new Schema({
  userId: { 
    type: Schema.Types.ObjectId, 
    ref: "User",
    required: true,
    unique: true 
   },
  balance: { 
    type: Number, 
    default: 0 
  },
  transactions: [
    {
      amount: Number,
      type: { type: String, enum: ["credit", "debit"] },
      reason: String,
      orderId: { type: Schema.Types.ObjectId, ref: "Order" },
      date: { type: Date, default: Date.now }
    }
  ],
  walletUsed: {
    type: Number,
    default: 0
}
});

const Wallet = mongoose.model ("Wallet", walletSchema)
module.exports = Wallet;
