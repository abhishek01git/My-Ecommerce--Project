const Cart = require("../../models/CartSchema");
const Product = require("../../models/productSchema");
const mongoose = require("mongoose");
const User = require("../../models/userSchema");
const errorMiddleware = require("../../middlewares/errorMiddleware");

const addToCart = async (req, res) => {
  const { productId, size, quantity } = req.body;
  console.log("Request Body: ", req.body);

  try {
    const userId = req.user.id;
    console.log("User ID:", userId);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User session not found.",
        redirectURL: "/login",
      });
    }

    const product = await Product.findById(productId)
      .select(
        "productName salePrice regularPrice productImage variant category productOffer"
      )
      .populate("category");

    console.log("Fetched Product: ", product);

    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    const variant = product.variant.find((v) => v.size === size);
    console.log("Variant: ", variant);

    if (!variant) {
      return res.status(400).json({
        success: false,
        message: `Size ${size} is not available for this product.`,
      });
    }

    const categoryOffer = product.category?.categoryOffer || 0;
    const productOffer = product.productOffer || 0;

    console.log("Category Offer: ", categoryOffer);
    console.log("Product Offer: ", productOffer);

    const effectiveOffer = Math.max(categoryOffer, productOffer);
    console.log(
      "Effective Offer (Max of Category and Product Offer):",
      effectiveOffer
    );

    const offerPrice = (product.regularPrice * effectiveOffer) / 100;
    console.log("Offer Price: ", offerPrice);

    const finalPrice = product.regularPrice - offerPrice;
    console.log("Final Price after offer: ", finalPrice);

    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId });
    }

    const existingItemIndex = cart.items.findIndex(
      (item) => item.productId.toString() === productId && item.size === size
    );

    if (existingItemIndex !== -1) {
      const newQuantity = cart.items[existingItemIndex].quantity + quantity;

      if (variant.quantity < newQuantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock. Only ${variant.quantity} items available.`,
          cart,
        });
      }

      cart.items[existingItemIndex].quantity = newQuantity;
    } else {
      if (variant.quantity < quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock. Only ${variant.quantity} items available.`,
        });
      }

      cart.items.push({
        productId,
        size,
        quantity,
        productName: product.productName,
        price: finalPrice,
        image: product.productImage[0],
      });
    }

    cart.totalAmount = cart.items.reduce(
      (total, item) => total + item.quantity * item.price,
      0
    );

    await cart.save();
    console.log("cart", cart);

    res.status(200).json({
      success: true,
      message: "Item added to cart successfully.",
      cart,
    });
  } catch (error) {
    console.error("Error adding to cart:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add item to cart.",
      error,
    });
  }
};

const viewCart = async (req, res) => {
  const userId = req.user.id;

  try {
    const user = req.session.user;
    const userData = await User.findOne({ _id: user });

    const cart = await Cart.findOne({ userId })
      .populate(
        "items.productId",
        "salePrice productName productImage variant category productOffer"
      )
      .exec();

    if (!cart || cart.items.length === 0) {
      console.log(
        `[viewCart]: No cart found or cart is empty for user: ${userId}`
      );
      return res.render("cart", {
        user: userData,
        cartItems: [],
        totalAmount: 0,
      });
    }

    let totalAmount = 0;

    cart.items.forEach((item) => {
      const product = item.productId;
      if (product) {
        const categoryOffer = product.category?.categoryOffer || 0;
        const productOffer = product.productOffer || 0;

        const effectiveOffer = Math.max(categoryOffer, productOffer);

        const offerPrice = (product.salePrice * effectiveOffer) / 100;
        const finalPrice = product.salePrice - offerPrice;

        console.log(`Item: ${product.productName}, Offer: ${effectiveOffer}%`);
        console.log(
          `Sale Price: ${product.salePrice}, Final Price: ${finalPrice}`
        );

        totalAmount += item.quantity * finalPrice;
        console.log("totalAmount", totalAmount);
      }
    });

    console.log(`[viewCart]: Total amount for user ${userId}: ${totalAmount}`);

    res.render("cart", { user: userData, cartItems: cart.items, totalAmount });
  } catch (error) {
    console.error(`[viewCart Error]:`, error.message, error.stack);
    res
      .status(500)
      .json({ error: "An unexpected error occurred. Please try again later." });
  }
};

const removeFromCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const productId = req.params.productId;

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res
        .status(404)
        .json({ error: "Cart not found or is already empty." });
    }

    const itemIndex = cart.items.findIndex(
      (item) => item.productId.toString() === productId
    );
    if (itemIndex === -1) {
      return res.status(404).json({ error: "Item not found in cart." });
    }

    cart.items.splice(itemIndex, 1);
    await cart.save();

    res.status(200).json({ message: "Item removed successfully." });
  } catch (error) {
    console.error("Error in [removeFromCart]:", error.message, error.stack);
    res
      .status(500)
      .json({ error: "An unexpected error occurred. Please try again later." });
  }
};

const updateCartQuantity = async (req, res) => {
  try {
    const { productId, quantity, size } = req.body;
    console.log("Received request data:", req.body);

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid or missing Product ID." });
    }

    if (!quantity || quantity <= 0) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid quantity." });
    }

    if (!size) {
      return res.status(400).json({
        success: false,
        error: "Missing size for the product variant.",
      });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, error: "Product not found." });
    }

    const selectedVariant = product.variant.find((v) => v.size === size);
    if (!selectedVariant) {
      return res.status(404).json({
        success: false,
        error: `Variant with size ${size} not found.`,
      });
    }

    console.log("Variant with size ${size} not found", selectedVariant);

    if (quantity > selectedVariant.quantity) {
      return res.status(400).json({
        success: false,
        error: `Only ${selectedVariant.quantity} units are available for size ${size}.`,
        availableQuantity: selectedVariant.quantity,
      });
    }

    let cart = await Cart.findOne({ userId: req.user._id });
    if (!cart) {
      return res.status(404).json({ success: false, error: "Cart not found." });
    }

    // const existingItemIndex = cart.items.findIndex(
    //   (item) => item.productId.toString() === productId && item.size === size
    // );
    const existingItem = cart.items.find(
      (item) => item.productId.toString() === productId && item.size === size
    );

    if (!existingItem) {
      return res
        .status(400)
        .json({ success: false, error: "Item not found in the cart." });
    }

    existingItem.quantity = quantity;

    const grandTotal = cart.items.reduce((sum, item) => {
      const price = item.price;
      const quantity = item.quantity ? item.quantity : 0;
      console.log("Item Price:", price, "Quantity:", quantity);
      return sum + quantity * price;
    }, 0);

    const totalAmount = existingItem.price * quantity;

    cart.totalAmount = grandTotal;

    console.log("grand total", grandTotal);
    console.log("total", totalAmount);

    await cart.save();
    console.log("full added data is ", cart);

    res
      .status(200)
      .json({
        success: true,
        message: "Cart updated successfully.",
        cart,
        totalAmount,
        grandTotal,
      });
  } catch (error) {
    console.error("Error updating cart quantity:", error);
    res
      .status(500)
      .json({ error: "An error occurred while updating the cart." });
  }
};

module.exports = { addToCart, viewCart, updateCartQuantity, removeFromCart };
