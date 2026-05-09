const mongoose = require('mongoose');
const { Schema } = mongoose;

const offerSchema = new Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    discount: {
        type: Number,
        required: true
    },
    type: {
        type: String,
        enum: ['product', 'category', 'referral'],
        required: true
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

const Offer = mongoose.model('Offer', offerSchema);
module.exports = Offer;
