const mongoose = require('mongoose');

const CartSchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    }, 
    items: [
        {
            productId: { 
                type: mongoose.Schema.Types.ObjectId, 
                ref: 'Product', 
                required: true 
            },
            size: { 
                type: String, 
                enum: ['S', 'M', 'L', 'XL'], 
                required: true 
            },
            quantity: { 
                type: Number, 
                required: true, 
                min: 1 
            }, 
            productName: { 
                type: String, 
                required: true 
            },
            price: { 
                type: Number, 
                required: true, 
                min: 0 
            }, 
            image: { 
                type: String, 
                required: true 
            }, 
        },
    ],
    totalAmount: { 
        type: Number, 
        required: true, 
        default: 0, 
        min: 0 
    }, 
}, { timestamps: true });

module.exports = mongoose.model('Cart', CartSchema);  
