const mongoose = require ("mongoose")
const {Schema} = mongoose;

const categorySchema = new Schema ({
  name : {
    type : String,
    required : true,
    unique : true
  },
  description :{
    type : String,
    required : true
  },
  isListed :{
    type : Boolean,
    default : true
  },
  categoryOffer : {
    type : Number,
    default : 0
  },
  categoryOfferId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Offer',
    default: null
  },
  createdAt : {
    type : Date,
    default : Date.now
  }
})

const Category = mongoose.model ("Category", categorySchema)
module.exports = Category;
