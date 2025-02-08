const { types, string } = require('joi');
const mongoose = require('mongoose');
const { Schema } = mongoose;
const { v4: uuidv4 } = require('uuid');

const orderSchema = new Schema({
  orderId: {
    type: String,
    unique: true,
    required: true,
    default: uuidv4 
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  address: {
    addressType: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    city: {
      type: String,
      required: true
    },
    landmark: {
      type: String,
      required: true
    },
    state: {
      type: String,
      required: true
    },
    pincode: {
      type: Number,
      required: true
    },
    phone: {
      type: String,
      required: true
    }
  },
  paymentMethod: { 
    type: String, 
    required: true 
  },
  totalAmount: { 
    type: Number, 
    required: true 
  },
  razorpayOrderId: {
    type: String,
    default: null, 
  },
  

  items: [{
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    size: { 
      type: String, 
      required: true 
    },
    quantity: { 
      type: Number, 
      required: true 
    },
    productName: { 
      type: String, 
      required: true 
    },
    price: { 
      type: Number, 
      required: true 
    },
    image: { 
      type: String, 
      required: true 
    },
    cancelStatus:{
      type:String,
      enum: ['Pending', 'Shipped', 'Delivered', 'Cancelled'], 
      default: 'Pending' 
    },
    cancelReason: {
      type: String,
      validate: {
        validator: function(value) {
          
          if (this.cancelStatus === 'Cancelled' && !value) {
            return false; 
          }
          return true;
        },
        message: 'Cancel reason is required when the item is canceled'
      }
    },
    returnStatus: {
      type: String, 
      enum: ["Not Requested", "Requested", "Approved", "Rejected"], 
      default: "Not Requested" 
    },
    returnReason: {
      type: String, 
      default: ""
    }
  }],
  paymentStatus: { 
    type: String, 
    enum: ['PaymentPending', 'Pending', 'Paid', 'Failed'], 
    default: 'PaymentPending' 
  },
  fulfillmentStatus: { 
    type: String, 
    enum: ['Pending', 'Shipped', 'Delivered', 'Cancelled'], 
    default: 'Pending' 
  },
  status: { 
    type: String, 
    default: 'Pending' 
  },
  coupon:{
    code:{type:String},
    discountAmount:{type:Number}
  },
  orderCancelReason: {
    type: String,
    required: function() { return this.fulfillmentStatus === 'Cancelled'; },
  },    // Status of the order
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
 

  // returnstatus: { 
  //   type: String, 
  //   enum: ["Not Requested", "Requested", "Approved", "Rejected"], 
  //   default: "Not Requested" 
  // },
  // returnRequestDate: { 
  //   type: Date 
  // },
  // returnReason: { 
  //   type: String 
  // }

}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
