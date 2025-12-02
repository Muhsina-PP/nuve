const mongoose = require ("mongoose")
const {Schema} = mongoose

const productSchema = new Schema({
  productName: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  brand: {
    type: String,
    required: true
  },
  category: {
    type: Schema.Types.ObjectId,
    ref: "Category",
    required: true
  },
  regularPrice: {
    type: Number,
    required: true
  },
  salePrice: {
    type: Number,
    required: false
  },

  variants: [
    {
      size: {
        type: String,
        enum: ["S", "M", "L", "XL", "XXL"], 
        required: true
      },
      stock: {
        type: Number,
        default: 0,
        min: 0
      }
    }
  ],

  color: {
    type: String,
    required: true
  },

  productImage: {
    type: [String],
    required: true
  },

  isBlocked: {
    type: Boolean,
    default: false
  },

  rating: {
    type: Number,
    default: 0
  },

  numberOfReviews: {
    type: Number,
    default: 0
  },
  createdAt : {
    type : Date,
    default : Date.now()
  },
  status: {
    type: String,
    enum: ["Available", "Out of stock", "Discontinued"],
    default: "Available"
  }
}, { timestamps: true });

const Product = mongoose.model( "Product", productSchema)
module.exports = Product;
