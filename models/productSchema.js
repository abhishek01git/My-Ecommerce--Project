const { ref } = require('joi');
const mongoose = require('mongoose');
const { Schema } = mongoose;


const ProductSchema = new Schema(
  {
    productName: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
    },
    regularPrice: {
      type: Number,
      required: true,
    },
    salePrice: {
      type: Number,
      default: null,
      validate: {
        validator: function (v) {
          return v <= this.regularPrice;
        },
        message: (props) => `Sale price (${props.value}) must be less than or equal to regular price (${this.regularPrice}).`,
      },
    },
    productOffer: {
      type: Number,
      default: 0,
      validate: {
        validator: function (v) {
          return v >= 0 && v <= 100;
        },
        message: 'Product offer must be between 0 and 100.',
      },
    },
    variant: [
      {
        size: {
          type: String,
          enum: ['S', 'M', 'L', 'XL'],
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
        },
      },
    ],
    productImage: [
      {
        type: String,
        required: true,
        
      },
    ],
    isBlocked: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['Available', 'Out of stock', 'Discontinued', 'Pre-order', 'Backordered'],
      required: true,
      default: 'Available',
    },
reviews:[{
  type:mongoose.Schema.Types.ObjectId,
  ref:"Review"
}],

    deleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);


ProductSchema.virtual('totalStock').get(function () {
  return this.variant.reduce((acc, curr) => acc + curr.quantity, 0);
});


ProductSchema.virtual('discountedPrice').get(function () {
  if (this.productOffer > 0) {
   
    return this.regularPrice - (this.regularPrice * this.productOffer) / 100;
  }
  return this.regularPrice; 
});


ProductSchema.virtual('discountedPrice').get(function () {
  if (this.productOffer > 0) {
    return Math.floor(this.regularPrice - (this.regularPrice * this.productOffer) / 100);
  }
  return this.salePrice || this.regularPrice;
});



ProductSchema.query.notDeleted = function () {
  return this.where({ deleted: false });
};



ProductSchema.index({ productName: 1, category: 1 });
ProductSchema.index({ status: 1 });

const Product = mongoose.model('Product', ProductSchema);
module.exports = Product;
