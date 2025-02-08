const mongoose = require("mongoose");
const { Schema } = mongoose;


const ReviewSchema = new Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      maxlength: 1000,
    },
    createdOn: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);


ReviewSchema.index({ product: 1, user: 1 }, { unique: true });


ReviewSchema.pre("save", async function (next) {
  const Product = mongoose.model("Product");

  const product = await Product.findById(this.product);
  if (product) {
    product.reviews.push(this._id);
    await product.save();
  }
  next();
});


ReviewSchema.pre("remove", async function (next) {
  const Product = mongoose.model("Product");

  await Product.findByIdAndUpdate(this.product, { $pull: { reviews: this._id } });
  next();
});

const Review = mongoose.model("Review", ReviewSchema);

module.exports = Review;
