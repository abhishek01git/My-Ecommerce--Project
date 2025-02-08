const Oder = require("../../models/oderSchemma");
const express = require('express');
const { v4: uuidv4 } = require("uuid");
const mongoose = require("mongoose");
const Product = require("../../models/productSchema");
const User = require("../../models/userSchema");
const Address = require("../../models/addressSchema");
const Cart = require("../../models/CartSchema");
const Order = require("../../models/oderSchemma");
const Razorpay = require('razorpay');
const Coupon=require('../../models/couponSchema')
const crypto = require('crypto');
const dotenv = require('dotenv');
const Wallet=require('../../models/WalletSchemma')
dotenv.config();


const renderCheckoutPage = async (req, res) => {
  try {
    const userId = req.session.user;
    console.log("User ID:", userId);

    const cart = await Cart.findOne({ userId }).populate("items.productId");
    console.log("Cart:", cart);


    if(!cart||cart.items.length===0){
      return res.redirect('/cart')
    }
    


  const totalAmount = cart.totalAmount;

    console.log("total ###amound".totalAmount);
    


    const addresses = await Address.find({ userId });
    console.log("User Addresses:", addresses);




    res.render("checkout", { cart, addresses, totalAmount });
  } catch (error) {
    console.error("Error rendering checkout page:", error);
    res.status(500).send("An error occurred.");
  }
};

const saveNewAddress = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      throw new Error("User ID is missing");
    }

    const address = req.body;
    const userId = req.user._id;

    const newAddress = new Address({
      userId: userId,
      address: [
        {
          addressType: address.addressType,
          name: address.name,
          city: address.city,
          landmark: address.landmark,
          state: address.state,
          pincode: String(address.pincode),
          phone: address.phone,
        },
      ],
    });

    await newAddress.save();
    return res.redirect("/checkout");
  } catch (error) {
    console.error("error creating address", error);
    return res.redirect("/pageNotFound");
  }
};



const updateProductStock = async (items) => {
  try {
    
    for (const item of items) {
      const productId = item.productId;
      const size = item.size;
      const quantityOrdered = item.quantity;

     
      const product = await Product.findOne({
        _id: productId,
        'variant.size': size
      });

      if (product) {
        const variantIndex = product.variant.findIndex(
          v => v.size === size
        );

        if (variantIndex !== -1) {
        
          product.variant[variantIndex].quantity -= quantityOrdered;

         
          await product.save();
        }
      }
    }
  } catch (error) {
    console.error('Error updating product stock:', error);
  }
};




const applyCoupon = async (req, res) => {
  try {
    const { couponCode, totalAmount } = req.body;
    console.log('coupon code', req.body);

    // Find the coupon in the database
    const coupon = await Coupon.findOne({ name: couponCode });

    // If coupon not found
    if (!coupon) {
      return res.status(400).json({ message: "Coupon code is invalid." });
    }

    // Check if the coupon is expired
    const currentDate = new Date();
    if (coupon.expireOn < currentDate) {
      return res.status(400).json({ message: "Coupon has expired." });
    }

    // Check if the coupon is active
    if (!coupon.isActive) {
      return res.status(400).json({ message: "Coupon is not active." });
    }

    // Check if total amount meets the minimum price condition
    if (totalAmount < coupon.minimumPrice) {
      return res.status(400).json({ message: `Your total amount must be at least ${coupon.minimumPrice} to apply this coupon.` });
    }

    // Calculate the discount
    const discount = coupon.offerPrice;
    const newTotal = totalAmount - discount;
    const finalTotal = newTotal < 0 ? 0 : newTotal;

    // Return success response
    return res.json({
      message: "Coupon applied successfully!",
      finalTotal: finalTotal,
      discount: discount,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Something went wrong. Please try again." });
  }
};





const availablecoupons = async (req, res) => {
  try {
    const currentDate = new Date();
    console.log("Current Date:", currentDate);

    // Fetch active and valid coupons
    const availableCoupons = await Coupon.find({
      expireOn: { $gte: currentDate }, // Only fetch coupons that haven't expired
      isActive: true, // Ensure the coupon is active
    });

    console.log("Filtered Available Coupons:", availableCoupons);

    // Check if no available coupons were found
    if (availableCoupons.length === 0) {
      return res.status(404).json({ message: 'No available coupons' });
    }

    // Return the available coupons
    return res.json(availableCoupons);

  } catch (error) {
    console.error("Error fetching coupons:", error);
    res.status(500).json({ message: "Something went wrong. Please try again." });
  }
};









const placeOrder = async (req, res) => {
  try {
    const { selectedAddressId, paymentMethod, couponCode ,} = req.body;
    console.log("place order",req.body);

    
    const addressDocument = await Address.findOne({
      userId: req.user._id,
      'address._id': selectedAddressId,
    }).select('address');

    if (!addressDocument || !addressDocument.address || addressDocument.address.length === 0) {
      return res.json({ success: false, message: 'Address not found.' });
    }

    const selectedAddress = addressDocument.address.find(
      (addr) => addr._id.toString() === selectedAddressId
    );

    if (!selectedAddress) {
      return res.json({ success: false, message: 'Selected address not found.' });
    }

   
    const cart = await Cart.findOne({ userId: req.user._id }).populate('items.productId');
    console.log(cart);

    if (!cart || !cart.items || cart.items.length === 0) {
      return res.json({ success: false, message: 'Invalid or empty cart.' });
    }

  
    for (const item of cart.items) {
      const selectedVariant = item.productId.variant.find((v) => v.size === item.size);
      if (!selectedVariant) {
        return res.json({
          success: false,
          message: `Variant with size ${item.size} not found for product ${item.productId.name}.`,
        });
      }

      if (item.quantity > selectedVariant.quantity) {
        return res.json({
          success: false,
          message: `Only ${selectedVariant.quantity} units are available for size ${item.size} of ${item.productId.name}.`,
        });
      }
    }

  
    const grandTotal = cart.items.reduce((sum, item) => {
      const price = item.price;
      const quantity = item.quantity ? item.quantity : 0;
      console.log('Item Price:', price, 'Quantity:', quantity);
      return sum + quantity * price;
    }, 0);

    let discount = 0; 
    let finalTotal = grandTotal; 



    
    
    if (couponCode) {
      const coupon = await Coupon.findOne({ name: couponCode });

      if (!coupon) {
        return res.json({ success: false, message: 'Invalid coupon code.' });
      }

      const currentDate = new Date();
      if (coupon.expireOn < currentDate) {
        return res.json({ success: false, message: 'Coupon has expired.' });
      }

      if (grandTotal < coupon.minimumPrice) {
        return res.json({
          success: false,
          message: `Your total amount must be at least ${coupon.minimumPrice} to use this coupon.`,
        });
      }

      discount = coupon.offerPrice; 
      finalTotal = grandTotal - discount; 
    }
      

   if(finalTotal>1000){
    return res.json({
      success: false,
      message: `amound greater than 1000 Cash On Delivary only avalivable`,
    });
   }

    console.log('Coupon Code:', couponCode);
    console.log('Grand Total:', grandTotal);
    console.log('Discount:', discount);
    console.log('Final Total:', finalTotal);
    

    
    const order = new Order({
      userId: req.user._id,
      address: selectedAddress,
      paymentMethod,
      items: cart.items,
      totalAmount: finalTotal, 
      discount, 
      paymentStatus: 'Pending',
      status: 'Pending',
    });

    await order.save();

   
    await Cart.updateOne({ userId: req.user._id }, { $set: { items: [] } });

   
    await updateProductStock(cart.items);

    res.json({ success: true, orderId: order._id });
  } catch (error) {
    console.error('Error placing the order:', error);
    res.status(500).json({ success: false, message: 'Error placing the order: ' + error.message });
  }
};






const walletPlaceOrder = async (req, res) => {
  try {
    const { selectedAddressId, paymentMethod, couponCode } = req.body;
    console.log("place order", req.body);

    
    const addressDocument = await Address.findOne({
      userId: req.user._id,
      'address._id': selectedAddressId,
    }).select('address');

    if (!addressDocument || !addressDocument.address || addressDocument.address.length === 0) {
      return res.json({ success: false, message: 'Address not found.' });
    }

    const selectedAddress = addressDocument.address.find(
      (addr) => addr._id.toString() === selectedAddressId
    );

    if (!selectedAddress) {
      return res.json({ success: false, message: 'Selected address not found.' });
    }

   
    const cart = await Cart.findOne({ userId: req.user._id }).populate('items.productId');

    if (!cart || !cart.items || cart.items.length === 0) {
      return res.json({ success: false, message: 'Invalid or empty cart.' });
    }

    
    for (const item of cart.items) {
      const selectedVariant = item.productId.variant.find((v) => v.size === item.size);
      if (!selectedVariant) {
        return res.json({
          success: false,
          message: `Variant with size ${item.size} not found for product ${item.productId.name}.`,
        });
      }

      if (item.quantity > selectedVariant.quantity) {
        return res.json({
          success: false,
          message: `Only ${selectedVariant.quantity} units are available for size ${item.size} of ${item.productId.name}.`,
        });
      }
    }

   
    const grandTotal = cart.items.reduce((sum, item) => {
      const price = item.price;
      const quantity = item.quantity ? item.quantity : 0;
      return sum + quantity * price;
    }, 0);

    let discount = 0;
    let finalTotal = grandTotal;

   
    if (couponCode) {
      const coupon = await Coupon.findOne({ name: couponCode });

      if (!coupon) {
        return res.json({ success: false, message: 'Invalid coupon code.' });
      }

      const currentDate = new Date();
      if (coupon.expireOn < currentDate) {
        return res.json({ success: false, message: 'Coupon has expired.' });
      }

      if (grandTotal < coupon.minimumPrice) {
        return res.json({
          success: false,
          message: `Your total amount must be at least ${coupon.minimumPrice} to use this coupon.`,
        });
      }

      discount = coupon.offerPrice;
      finalTotal = grandTotal - discount;
    }

    // **6. COD Restriction for Orders Above ₹1000**
    // if (finalTotal > 1000 && paymentMethod === "COD") {
    //   return res.json({
    //     success: false,
    //     message: `Amount greater than ₹1000: Cash On Delivery not available.`,
    //   });
    // }

    
    if (paymentMethod === "wallet") {
      const wallet = await Wallet.findOne({ userId: req.user._id });

      if (!wallet) {
        return res.status(404).json({ success: false, message: "Wallet not found" });
      }

      if (wallet.balance < finalTotal) {
        return res.status(400).json({ success: false, message: "Insufficient wallet balance" });
      }

     
      wallet.balance -= finalTotal;
      wallet.transactions.push({
        type: "debit",
        amount: finalTotal,
        description: `Order payment`,
      });

      await wallet.save();
    }

   
    const order = new Order({
      userId: req.user._id,
      address: selectedAddress,
      paymentMethod,
      items: cart.items,
      totalAmount: finalTotal,
      discount,
      paymentStatus: 'Pending',
      status: 'Pending',
     
    });

    await order.save();

    
    await Cart.updateOne({ userId: req.user._id }, { $set: { items: [] } });
    await updateProductStock(cart.items);

    res.json({ success: true, orderId: order._id });
  } catch (error) {
    console.error('Error placing the order:', error);
    res.status(500).json({ success: false, message: 'Error placing the order: ' + error.message });
  }
};






const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});



const createOrder = async (req, res) => {
  try {
    const { amount, selectedAddressId, cartItems, paymentMethod, couponCode } = req.body;

    
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount provided.' });
    }

    if (!selectedAddressId) {
      return res.status(400).json({ success: false, message: 'Address ID is required.' });
    }

    
    const addressDocument = await Address.findOne({
      userId: req.user._id,
      'address._id': selectedAddressId,
    }).select('address');

    if (!addressDocument || !addressDocument.address) {
      return res.status(404).json({ success: false, message: 'Address not found.' });
    }

    const selectedAddress = addressDocument.address.find(
      (addr) => addr._id.toString() === selectedAddressId
    );

    if (!selectedAddress) {
      return res.status(404).json({ success: false, message: 'Selected address not found.' });
    }

    console.log('Selected Address:', selectedAddress);

   
    const cart = await Cart.findOne({ userId: req.user._id }).populate('items.productId');

    if (!cart || !cart.items || cart.items.length === 0) {
      return res.json({ success: false, message: 'Invalid or empty cart.' });
    }

    
    for (const item of cart.items) {
      const product = item.productId;

    
      const selectedVariant = product.variant.find((v) => v.size === item.size);

      if (!selectedVariant) {
        return res.json({
          success: false,
          message: `Variant with size ${item.size} not found for product ${product.name}.`,
        });
      }

      
      if (item.quantity > selectedVariant.quantity) {
        return res.json({
          success: false,
          message: `Only ${selectedVariant.quantity} units are available for size ${item.size} of ${product.name}.`,
        });
      }

      
      selectedVariant.quantity -= item.quantity;
      await product.save();
    }

   
    let discount = 0;
    let couponDetails = null;

    if (couponCode) {
      const coupon = await Coupon.findOne({ name: couponCode });

      if (!coupon) {
        return res.json({ success: false, message: 'Invalid coupon code.' });
      }

      const currentDate = new Date();
      if (coupon.expireOn < currentDate) {
        return res.json({ success: false, message: 'Coupon has expired.' });
      }

      if (amount < coupon.minimumPrice) {
        return res.json({
          success: false,
          message: `Your total amount must be at least ${coupon.minimumPrice} to use this coupon.`,
        });
      }

      discount = coupon.offerPrice;
      couponDetails = { code: coupon.name, discountAmount: coupon.offerPrice };
    }

   
    const finalTotal = amount - discount;

   
    const options = {
      amount: Math.round(finalTotal * 100), 
      currency: 'INR',
      receipt: `receipt_${new Date().getTime()}`,
      payment_capture: 1, 
    };

    console.log('Razorpay Order Options:', options);

    const razorpayOrder = await razorpay.orders.create(options);

    console.log('Razorpay Order Created:', razorpayOrder);

   
    const newOrder = new Order({
      userId: req.user._id,
      address: selectedAddress,
      paymentMethod,
      items: cart.items,
      totalAmount: finalTotal,
      discount,
      coupon: couponDetails,
      razorpayOrderId: razorpayOrder.id,
      paymentStatus: 'PaymentPending',
      status: 'Pending',
    });

    await newOrder.save();

    console.log('Order Saved to Database:', newOrder);

   
    await Cart.updateOne({ userId: req.user._id }, { $set: { items: [] } });

  
    return res.json({
      success: true,
      razorpayOrderId: razorpayOrder.id,
      orderId: newOrder._id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      discount,
      finalTotal,
    });
  } catch (error) {
    console.error('Error creating order:', error);
    return res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
};





const VerifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

   
    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Missing required payment fields'
      });
    }

   
    const hmac = crypto.createHmac("sha256", razorpay.key_secret);
    hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);  
    const generatedSignature = hmac.digest("hex");

    console.log('Generated Signature:', generatedSignature);
    console.log('Received Razorpay Signature:', razorpay_signature);

    if (generatedSignature === razorpay_signature) {
      const updatedOrder = await Order.findOneAndUpdate(
        { razorpayOrderId: razorpay_order_id },
        {
          $set: {
            paymentStatus: "Paid",
            status: "Pending",
          }
        },
        { new: true }
      );

      if (!updatedOrder) {
        console.error('Order not found:', razorpay_order_id);
        return res.status(404).send({
          status: "failure",
          message: "Order not found"
        });
      }

      res.status(200).send({ success: "success", message: "Payment verified successfully",orderId: updatedOrder._id});
    } else {
      console.error('Invalid signature');
      res.status(400).send({ success: "failure", message: "Invalid signature" });
    }
  } catch (error) {
    console.error("Error verifying payment:", error);
    res.status(500).send({ success: "failure", message: "Internal server error" });
  }
};





const orderSuccess = async (req, res) => {
  try {
    const orderId = req.query.orderId; 

    console.log("order id ",orderId);
    

    if (!orderId) {
      return res.status(400).render('error', { message: 'Invalid order ID.' });
    }

    
    const order = await Order.findById(orderId)
      .populate('userId address items.productId') 
      .lean(); 

    if (!order) {
      return res.status(404).render('error', { message: 'Order not found' });
    }

    res.render('order-success', { order }); 
  } catch (error) {
    console.error('Error fetching order details:', error);
    res.status(500).render('error', { message: 'Error fetching order details.' });
  }
};



const getOrderHistory= async (req, res) => {
    try {
        const userId = req.user._id;  
        const orders = await Order.find({ userId })
        .populate('items.productId') 
            .select('_id date paymentStatus fulfillmentStatus totalAmount') 
            .sort({ date: -1 }); 
        
        res.render('account/order-history', { orders });  
    } catch (error) {
        console.error('Error fetching order history:', error);
        res.status(500).render('error', { message: 'Error fetching order history.' });
    }
}














const getWallet = async (req, res) => {
  try {
    const userId = req.user._id; 

   
    const wallet = await Wallet.findOne({ userId });

    if (!wallet) {
      return res.status(404).send("Wallet not found");
    }

    
    const walletData = {
      balance: wallet.balance,
      transactions: wallet.transactions, 
    };

  
    res.render("wallet", { wallet: walletData });
  } catch (error) {
    console.error("Error fetching wallet details:", error);
    res.status(500).send("Server error: " + error.message); 
  }
};


const updateWallet = async (req, res) => {
  try {
    const userId = req.user._id;
    const { amount, type, description } = req.body;

   
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).send("Invalid amount");
    }

    const wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      return res.status(404).send("Wallet not found");
    }

    if (type === "debit" && wallet.balance < amount) {
      return res.status(400).send("Insufficient balance");
    }

  
    wallet.transactions.push({ type, amount, description });

    
    if (type === "credit") {
      wallet.balance += amount;
    } else if (type === "debit") {
      wallet.balance -= amount;
    }

    await wallet.save();

    res.status(200).send("Wallet updated successfully");
  } catch (error) {
    console.error("Error updating wallet:", error);
    res.status(500).send("Server error");
  }
};










module.exports = {
  renderCheckoutPage,
  saveNewAddress,
  placeOrder,
  orderSuccess,
  createOrder,
  VerifyPayment,
  getOrderHistory,
  applyCoupon,
  getWallet,
  updateWallet,
  walletPlaceOrder,
  availablecoupons
};
