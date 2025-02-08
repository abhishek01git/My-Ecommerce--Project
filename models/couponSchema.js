const mongoose = require('mongoose');
const { Schema } = mongoose;

const couponSchema = new Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    createdOn: {
        type: Date,
        default: Date.now,
        required: true
    },
    expireOn: {
        type: Date,
        default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Default expiration in 7 days
    },
    offerPrice: {
        type: Number,
        required: true
    },
    minimumPrice: {
        type: Number,
        required: true
    },
    isActive: {  
        type: Boolean,
        default: true
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: false
    }
});

const Coupon = mongoose.model('Coupon', couponSchema);
module.exports = Coupon;
