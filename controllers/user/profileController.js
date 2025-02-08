const User = require("../../models/userSchema");
const nodemailer = require("nodemailer");
const Address = require("../../models/addressSchema");
const bcrypt = require("bcrypt");
const Product = require("../../models/productSchema");
const Order = require("../../models/oderSchemma");
const { ObjectId } = require("mongoose").Types;
const Review = require("../../models/ReviewSchema");
const Wallet = require("../../models/WalletSchemma");
const PDFDocument = require("pdfkit");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const dotenv = require("dotenv");
const { Z_ASCII } = require("zlib");
const mongoose = require("mongoose");
const userProfile = async (req, res) => {
  try {
    const userId = req.session.user;
    const userData = await User.findById(userId);
    const addressData = await Address.findOne({ userId: userId });

    // Pagination variables
    let page = parseInt(req.query.page) || 1;  // Get page number from query, default is 1
    const limit = 10;  // Number of orders per page
    const skip = (page - 1) * limit;  // Calculate how many orders to skip

    // Fetch paginated orders
    const orders = await Order.find({ userId: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Get total order count for the user
    const totalOrders = await Order.countDocuments({ userId });
    const totalPages = Math.ceil(totalOrders / limit);  // Calculate total pages

    // Render the view with pagination data
    res.render("profile", {
      user: userData,
      userAddress: addressData,
      orders: orders,
      currentPage: page,  // Pass currentPage to the view
      totalPages: totalPages,  // Pass totalPages to the view
    });
  } catch (error) {
    console.error("Error in userProfile:", error);
    res.redirect("/pageNotFound");
  }
};


const getOrderDetails = async (req, res) => {
  try {
    const user = req.session.user;
    const userData = await User.findOne({ _id: user });
    const orderId = req.params.orderId;

    const order = await Order.findById(orderId).populate("address");

    if (!order) {
      return res.status(404).send("Order not found");
    }

    const canCancel = order.status !== "canceled";

    const addressData = await Address.findOne({ userId: order.userId }).select(
      "name city state"
    );

    if (!addressData) {
      console.log("No address found for the user:", order.userId);
      return res.status(404).send("User address not found");
    }

    const statusMessage =
      {
        pending: "Your order is pending and being processed.",
        shipped: "Your order has been shipped.",
        Delivered: "Your order has been delivered.",
        canceled: "Your order has been canceled.",
      }[order.status] || "Status unavailable.";

    res.render("orderDetails", {
      user: userData,
      order,
      address: addressData,
      canCancel,
      statusMessage,
    });
  } catch (error) {
    console.error("Error in getOrderDetails:", error);
    res.status(500).send("Server error");
  }
};

const downloadInvoice = async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId })
      .populate("userId", "name email")
      .populate({
        path: "items.productId",
        select: "productName price description",
      });

    if (!order) {
      return res.status(404).send("Order not found");
    }

    const doc = new PDFDocument({ margin: 50, size: "A4" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=invoice_${order.orderId}.pdf`
    );

    doc.pipe(res);

    doc.fontSize(24).fillColor("#333").text("ELITE THREADS", 50, 50);
    doc.fontSize(12).fillColor("#666").text("Tax Invoice", 50, 80);

    doc
      .fontSize(10)
      .fillColor("#666")
      .text(`Invoice Number: #${order.orderId || "N/A"}`, 50, 120)
      .text(
        `Date: ${
          order.createdAt
            ? new Date(order.createdAt).toLocaleDateString()
            : "N/A"
        }`,
        50,
        140
      )
      .text(`Payment Method: ${order.paymentMethod || "N/A"}`, 50, 160);

    doc.fontSize(10).fillColor("#000").text("BILL TO:", 50, 190);
    doc
      .fontSize(10)
      .fillColor("#666")
      .text(`${order.userId?.name || "N/A"}`, 50, 210)
      .text(`${order.userId?.email || "N/A"}`, 50, 230)
      .text(`Address:${order.address.name || "N/A"}`, 50, 250)
      .text(
        `${order.address.state || "N/A"}, ${order.address.city || "N/A"}`,
        50,
        270
      )
      .text(`${order.address.landmark || ""}`, 50, 290)
      .text(`Pincode: ${order.address.pincode || "N/A"}`, 50, 310)
      .text(`Phone: ${order.address.phone || "N/A"}`, 50, 330);

    const tableTop = 370;
    doc
      .fontSize(10)
      .fillColor("#333")
      .text("Product", 50, tableTop)
      .text("Quantity", 280, tableTop)
      .text("Price", 350, tableTop)
      .text("Total", 450, tableTop);

    doc
      .strokeColor("#ddd")
      .lineWidth(1)
      .moveTo(50, tableTop + 20)
      .lineTo(550, tableTop + 20)
      .stroke();

    let yPosition = tableTop + 30;
    let totalAmount = 0;

    order.items.forEach((item, index) => {
      const productName = item.productName || "Unknown";
      const quantity = item.quantity || 1;
      const price = item.price || 0;
      const itemTotal = quantity * price;
      totalAmount += itemTotal;

      doc
        .fillColor("#666")
        .text(productName, 50, yPosition, { width: 220 }) 
        .text(quantity.toString(), 280, yPosition, {
          width: 50,
          align: "right",
        }) 
        .text(`${price.toFixed(2)}`, 350, yPosition, {
          width: 80,
          align: "right",
        })
        .text(`${itemTotal.toFixed(2)}`, 450, yPosition, {
          width: 80,
          align: "right",
        }); 

      yPosition += 20;
    });

    const discount = order.coupon.discountAmount || 0;
    const finalTotal = totalAmount - discount;

    doc
      .strokeColor("#ddd")
      .lineWidth(1)
      .moveTo(50, yPosition + 10)
      .lineTo(550, yPosition + 10)
      .stroke();

    doc
      .fontSize(12)
      .fillColor("#666")
      .text("Subtotal", 350, yPosition + 30, { width: 80, align: "right" })
      .text(`${totalAmount.toFixed(2)}`, 450, yPosition + 30, {
        width: 80,
        align: "right",
      })
      .text("Discount", 350, yPosition + 50, { width: 80, align: "right" })
      .text(`${discount.toFixed(2)}`, 450, yPosition + 50, {
        width: 80,
        align: "right",
      })
      .fillColor("#000")
      .text("Grand Total", 350, yPosition + 70, { width: 80, align: "right" })
      .fillColor("#000")
      .text(`${finalTotal.toFixed(2)}`, 450, yPosition + 70, {
        width: 80,
        align: "right",
      });

    doc
      .fontSize(8)
      .fillColor("#999")
      .text("Thank you for shopping with Elite Threads!", 50, 750, {
        align: "center",
      });

    doc.end();
  } catch (error) {
    console.error("Invoice Download Error:", error);
    res.status(500).send("Error generating invoice");
  }
};

const oderDelivered = async () => {
  try {
    const { orderId } = req.params._id;
    const oder = await Order.findById(orderId);
    if (!oder) {
      return res.status(404), send("oder not found");
    }

    if (oder.status == "Delivered") {
      return res.status(400).send("oder already  delivard successfully");
    }

    (oder.status = "Delivered"), await oder.save();

    res.status(200), send("Order marked as delivered successfully");
  } catch (error) {
    console.error("Error in markOrderAsDelivered:", error);
    res.status(500).send("Server error");
  }
};

const cancelOrder = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const {
      productId,
      size,
      quantity,
      cancelReason = "No reason provided",
    } = req.body;

    // Find the order by ID and populate items with product details
    const order = await Order.findById(orderId).populate("items.productId");

    if (!order) {
      return res.status(404).send("Order not found");
    }

    // Handle already delivered or canceled orders
    if (order.status === "Delivered") {
      return res.render("orderDetails", {
        order,
        statusMessage:
          "Order has already been delivered and cannot be canceled",
        canCancel: false,
        address: order.address,
      });
    }

    if (order.status === "canceled") {
      return res.render("orderDetails", {
        order,
        statusMessage: "Order has already been canceled",
        canCancel: false,
        address: order.address,
      });
    }

    let refundAmount = 0;
    const wallet = await Wallet.findOne({ userId: order.userId });

    const totalAmountBeforeDiscount = order.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    const totalAmountPaid = order.totalAmount;

    // Full Order Cancellation: Refund if the payment is "Paid"
    if (!productId) {
      if (order.paymentStatus === "Paid" && wallet) {
        if (order.paymentMethod !== "cod") {
          const alreadyRefunded = wallet.transactions
            .filter((txn) => txn.description.includes(`Order ID: ${orderId}`))
            .reduce((sum, txn) => sum + txn.amount, 0);

          refundAmount = totalAmountPaid - alreadyRefunded;
          if (refundAmount > 0) {
            wallet.balance += refundAmount;
            wallet.transactions.push({
              type: "credit",
              amount: refundAmount,
              description: `Final refund for full order cancellation (Order ID: ${orderId})`,
            });
            await wallet.save();
          }
        }

        order.status = "canceled";
        order.orderCancelReason = cancelReason;
        order.items.forEach((item) => {
          item.cancelStatus = "Cancelled";
          item.cancelReason = cancelReason;
        });

        // Restore product stock for all items
        for (const item of order.items) {
          const product = await Product.findById(item.productId._id);
          if (product) {
            const variant = product.variant.find((v) => v.size === item.size);
            if (variant) {
              variant.quantity += item.quantity;
            } else {
              product.stock += item.quantity;
            }
            await product.save();
          }
        }

        await order.save();
        return res.redirect(
          `/order-details/${orderId}?statusMessage=Order canceled successfully`
        );
      }

      // If payment was not "Paid", simply skip refund and proceed with cancellation
      order.status = "canceled";
      order.orderCancelReason = cancelReason;
      order.items.forEach((item) => {
        item.cancelStatus = "Cancelled";
        item.cancelReason = cancelReason;
      });

      // Restore product stock for all items
      for (const item of order.items) {
        const product = await Product.findById(item.productId._id);
        if (product) {
          const variant = product.variant.find((v) => v.size === item.size);
          if (variant) {
            variant.quantity += item.quantity;
          } else {
            product.stock += item.quantity;
          }
          await product.save();
        }
      }

      await order.save();
      return res.redirect(
        `/order-details/${orderId}?statusMessage=Order canceled successfully`
      );
    }

    // Product Cancellation: Refund only the specific product
    const itemToCancel = order.items.find(
      (item) =>
        item.productId._id.toString() === productId && item.size === size
    );

    if (!itemToCancel) {
      return res
        .status(404)
        .send(
          `Product with ID ${productId} and size ${size} not found in this order`
        );
    }

    // Calculate the refund amount for the product cancellation
    let itemPrice = itemToCancel.price * quantity;
    let proportion = itemPrice / totalAmountBeforeDiscount;

    refundAmount = proportion * totalAmountPaid;

    if (order.paymentStatus === "Paid" && wallet) {
      wallet.balance += refundAmount;
      wallet.transactions.push({
        type: "credit",
        amount: refundAmount,
        description: `Refund for product cancellation (Product ID: ${productId}, Order ID: ${orderId})`,
      });
      await wallet.save();
    }

    itemToCancel.quantity -= quantity;
    if (itemToCancel.quantity === 0) {
      itemToCancel.cancelStatus = "Cancelled";
      itemToCancel.cancelReason = cancelReason;
    }

    // If all items are canceled, mark the order as canceled
    if (order.items.every((item) => item.cancelStatus === "Cancelled")) {
      order.status = "canceled";
      order.orderCancelReason = cancelReason;
    }

    await order.save();

    // Update the stock of the product
    const product = await Product.findById(productId);
    if (product) {
      const variant = product.variant.find((v) => v.size === size);
      if (variant) {
        variant.quantity += quantity;
      } else {
        product.stock += quantity;
      }
      await product.save();
    }

    res.redirect(
      `/order-details/${orderId}?statusMessage=Product canceled successfully`
    );
  } catch (error) {
    console.error("Error in cancelOrder:", error);
    res.status(500).send("Server error");
  }
};


const requestReturn = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const { productId, size, quantity, returnReason } = req.body;

    console.log("Request data:", { orderId, productId, size, quantity, returnReason });

    if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
      console.log("Invalid order ID:", orderId);
      return res.status(400).send("Invalid order ID");
    }

    const order = await Order.findById(orderId).populate("items.productId");
    console.log("Order details:", order);
    if (!order) {
      console.log("Order not found:", orderId);
      return res.status(404).send("Order not found");
    }

    const itemToReturn = order.items.find(
      (item) => item.productId._id.toString() === productId && item.size === size
    );

    console.log("Item to return:", itemToReturn);
    if (!itemToReturn) {
      return res.status(404).send("Product not found in the order for the specified size.");
    }

    if (itemToReturn.returnStatus === "Returned") {
      console.log("Product already returned:", itemToReturn);
      return res.status(400).send("This product has already been returned.");
    }

    if (!returnReason) {
      console.log("Missing return reason");
      return res.status(400).send("Return reason is required for product return.");
    }

    if (quantity > itemToReturn.quantity) {
      console.log("Quantity exceeds purchased quantity:", quantity, itemToReturn.quantity);
      return res.status(400).send("Quantity to return exceeds the purchased quantity.");
    }

    itemToReturn.returnStatus = "Requested";
    itemToReturn.returnReason = returnReason;
    itemToReturn.returnQuantity = quantity;
    console.log("Updated item return status:", itemToReturn);

    await order.save();
    console.log("Updated order after saving:", order);

    const allItemsRequestedForReturn = order.items.every(
      (item) => item.returnStatus === "Requested"
    );
    console.log("All items requested for return:", allItemsRequestedForReturn);
    
    if (allItemsRequestedForReturn) {
      order.returnStatus = "Return Requested";
      await order.save();
      console.log("Updated order return status to 'Return Requested':", order);
    }

    let wallet = await Wallet.findOne({ userId: order.userId });
    console.log("Wallet details:", wallet);
    if (!wallet) {
      wallet = new Wallet({
        userId: order.userId,
        balance: 0,
        transactions: [],
      });
      console.log("New wallet created:", wallet);
    }

    const totalAmountBeforeDiscount = order.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    console.log('totalAmountBeforeDiscount',totalAmountBeforeDiscount);
    

    const totalAmountPaid = order.totalAmount;
    const couponDiscount = order.couponDiscount || 0; 
    const alreadyRefunded = wallet.transactions
      .filter((txn) => txn.description.includes(`Order ID: ${orderId}`))
      .reduce((sum, txn) => sum + txn.amount, 0);

       console.log('totalAmountPaid',totalAmountPaid);
       
       console.log('couponDiscount',couponDiscount);
       
      
    const itemPrice = itemToReturn.price * quantity;
    const proportion = itemPrice / totalAmountBeforeDiscount;
    let refundAmount = proportion * (totalAmountPaid - couponDiscount);

console.log('itemPrice',itemPrice);
console.log('proportion',proportion);
console.log('refundAmount',refundAmount);





    if (refundAmount > 0) {
      wallet.balance += refundAmount;
      wallet.transactions.push({
        type: "credit",
        amount: refundAmount,
        description: `Refund for returned product (Product ID: ${productId}, Order ID: ${orderId})`,
      });
      await wallet.save();
    }

    console.log('wallet',wallet);
    
    return res.redirect(
      `/order-details/${orderId}?statusMessage=Product return requested and refund of ₹${refundAmount.toFixed(
        2
      )} processed successfully.`
    );

  } catch (error) {
    console.error("Error in requestReturn:", error);
    res.status(500).send("Server error");
  }
};


const addReview = async (req, res) => {
  try {
    const { productId, rating, comment } = req.body;
    const userId = req.params.userId;
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).send("Product not found.");
    }
    const existingReview = await Review.findOne({
      product: productId,
      user: userId,
    });
    if (existingReview) {
      return res.status(400).send("You have already reviewed this product.");
    }

    const newReview = new Review({
      product: productId,
      user: userId,
      rating,
      comment,
    });
    await newReview.save();
    res.redirect("/profile");
  } catch (error) {
    console.error("Error in addReview:", error);
    res.status(500).send("Server error");
  }
};

const loadprofile = async (req, res) => {
  try {
    const userId = req.session.user;

    const userData = await User.findById(userId);
    const addressData = await Address.findOne({ userId: userId });

    if (!userData) {
      return res.redirect("/pageNotFound");
    }

    res.render("profiletwo", {
      user: userData,
      userAddress: addressData,
    });
  } catch (error) {
    console.error("Error retrieving profile data:", error);
    res.redirect("/pageNotFound");
  }
};

const changeEmail = async (req, res) => {
  try {
    res.render("change-email");
  } catch (error) {
    res.render("/pageNotFound");
  }
};

function generateOtp() {
  const digits = "1234567890";
  let otp = "";
  for (let i = 0; i < 6; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }
  return otp;
}

const sendVerificationEmail = async (email, otp) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD,
      },
    });
    const mailOptions = {
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: "your otp for email changed",
      text: `your otp is ${otp}`,
      html: `<b><h4>your otp:${otp}</h4></b>`,
    };
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully:", info.messageId);
    return true;
  } catch (error) {
    console.error("Error sending email:", error);
    return false;
  }
};

const changeEmailVaild = async (req, res) => {
  try {
    const { email } = req.body;
    const userExist = await User.findOne({ email });
    if (userExist) {
      const otp = generateOtp();
      const emailSend = await sendVerificationEmail(email, otp);
      if (emailSend) {
        req.session.userOtp = otp;
        req.session.userData = req.body;
        req.session.email = email;
        console.log("email sent", email);
        console.log("otp", otp);
        return res.render("change-email-otp");
      } else {
        return res.json("email-error");
      }
    } else {
      res.render("change-email", {
        message: "user with this email not exist",
      });
    }
  } catch (error) {
    res.redirect("/pageNotFound");
  }
};

const verifyEmailOtp = async (req, res) => {
  try {
    const enteredOtp = req.body.otp;
    if (enteredOtp === req.session.userOtp) {
      req.session.userData = req.body.userData;
      res.render("new-email", {
        userData: req.session.userData,
      });
    } else {
      res.render("change-email-otp", {
        message: "otp not matching",
        userData: req.session.userData,
      });
    }
  } catch (error) {
    res.redirect("/pageNotFound");
  }
};

const updateEamil = async (req, res) => {
  try {
    const newEmail = req.body.newEmail;
    const userId = req.session.user;
    await User.findByIdAndUpdate(userId, { email: newEmail });
    res.redirect("profiletwo");
  } catch (error) {
    res.redirect("/pageNotFound");
  }
};

const loadChangePassword = async (req, res) => {
  try {
    res.render("change-password");
  } catch (error) {
    res.redirect("/pageNotFound");
  }
};

const changePassword = async (req, res) => {
  const { currentPass, newPass, confirmPass } = req.body;
  console.log(req.body);

  try {
    const user = req.user;

    const isMatch = await bcrypt.compare(currentPass, user.password);
    if (!isMatch) {
      return res.status(400).render("change-password", {
        message: "Current password is incorrect.",
      });
    }

    if (newPass !== confirmPass) {
      return res.status(400).render("change-password", {
        message: "New passwords do not match.",
      });
    }

    const hashedPassword = await bcrypt.hash(newPass, 10);
    user.password = hashedPassword;
    await user.save();

    res.redirect("/profile");
  } catch (error) {
    console.error("Error changing password:", error);
    res.status(500).send("Internal server error");
  }
};

const loadAddress = async (req, res) => {
  try {
    const userId = req.session.user;
    console.log("userId from session:", userId);
    if (!userId) {
      return res.redirect("/profile");
    }
    const userData = await User.findOne({ _id: req.session.user });
    const addresses = await Address.find({ userId });
    console.log("addresses:", addresses);

    res.render("address", { addresses, user: userData });
  } catch (error) {
    console.error("Error loading addresses:", error);
    res.redirect("/pageNotFound");
  }
};

const loadAddAddress = async (req, res) => {
  try {
    const userData = await User.findOne({ _id: req.session.user });
    res.render("add-address", { user: userData });
  } catch (error) {}
};

const addAddress = async (req, res) => {
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
          altphone: address.altphone,
        },
      ],
    });

    await newAddress.save();
    return res.redirect("/address");
  } catch (error) {
    console.error("error creating address", error);
    return res.redirect("/pageNotFound");
  }
};
const loadEditAddress = async (req, res) => {
  const addressId = req.params.id;

  try {
    const userData = await User.findOne({ _id: req.session.user });
    const parentDocument = await Address.findOne({
      "address._id": addressId,
    });
    const address = parentDocument.address.find(
      (addr) => addr._id.toString() === addressId
    );
    console.log("address", address);

    if (!address) {
      return res.status(404).send("Address not found.");
    }

    res.render("edit-address", { address, user: userData });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("Internal Server Error");
  }
};

const editAddress = async (req, res) => {
  const addressId = req.query.id;
  const updatedData = req.body;

  try {
    const result = await Address.updateOne(
      { "address._id": addressId },
      {
        $set: {
          "address.$.addressType": updatedData.addressType,
          "address.$.name": updatedData.name,
          "address.$.city": updatedData.city,
          "address.$.landmark": updatedData.landmark,
          "address.$.state": updatedData.state,
          "address.$.pincode": updatedData.pincode,
          "address.$.phone": updatedData.phone,
        },
      }
    );

    console.log("Address updated successfully:", result);
    res.redirect("/address");
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("Internal Server Error");
  }
};

const deleteAddress = async (req, res) => {
  const addressId = req.params.id;
  const userId = req.user.id;
  console.log("Address ID:", addressId);
  console.log("User ID:", userId);
  try {
    const result = await Address.deleteOne({
      userId: userId,
      "address._id": addressId,
    });
    console.log("Address deleted successfully:", result);
    res.redirect("/address");
  } catch (error) {
    console.error("Error deleting address:", error);
    res.status(500).send("Internal Server Error");
  }
};

const loadForgetPassword = async (req, res) => {
  try {
    res.render("forget-password");
  } catch (error) {}
};

const forgetPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.render("forget-password", {
        errorMessage: "Email not found!",
      });
    }
    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(email, otp);

    if (!emailSent) {
      return res.render("login", {
        message: "Failed to send OTP. Please try again.",
      });
    }

    req.session.userOtp = otp;
    req.session.userEmail = email;

    res.render("forget-passwordOTP");
    console.log("OTP sent:", otp);
  } catch (error) {
    console.error(" error:", error);
    res.redirect("/pageNotFound");
  }
};
const forgetPasswordOtp = async (req, res) => {
  try {
    const { otp } = req.body;

    console.log("Received OTP:", otp);
    console.log("Stored OTP:", req.session.userOtp);

    if (otp === req.session.userOtp) {
      res.status(200).json({
        success: true,
        redirectUrl: "/reset-password",
      });
    } else {
      res.status(400).json({
        success: false,
        message: "Invalid OTP. Please try again.",
      });
    }
  } catch (error) {
    console.error("Error verifying OTP:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred. Please try again.",
    });
  }
};

const loadResetPassword = async (req, res) => {
  try {
    res.render("reset-password");
  } catch (error) {}
};

const resetPassword = async (req, res) => {
  const { newPass, confirmPass } = req.body;

  try {
    if (!newPass || !confirmPass) {
      return res.status(400).json({
        success: false,
        message: "Both newPass and confirmPass are required",
      });
    }

    if (newPass !== confirmPass) {
      return res.status(400).render("reset-password", {
        message: "New passwords do not match.",
      });
    }

    const hashedPassword = await bcrypt.hash(newPass, 10);
    const user = await User.findOne({ email: req.session.userEmail });
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "User not found with the provided email",
      });
    }

    user.password = hashedPassword;
    await user.save();

    req.session.userOtp = null;
    req.session.userEmail = null;

    res.redirect("/login");
  } catch (error) {
    console.error(error);
    if (!res.headersSent) {
      res.status(500).send("Internal server error");
    }
  }
};

const retryPayment = async (req, res, next) => {
  const { orderId } = req.params;
  console.log("qwertyui", orderId);

  try {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return res
        .status(500)
        .json({ success: false, message: "Razorpay API keys are missing." });
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found." });
    }

    if (order.paymentStatus === "Paid") {
      return res
        .status(400)
        .json({ success: false, message: "Order is already paid." });
    }

    if (!order.totalAmount || order.totalAmount <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid order amount." });
    }

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const options = {
      amount: order.totalAmount * 100,
      currency: "INR",
      receipt: `order_rcpt_${orderId}`,
    };

    console.log("qwertghyjkljhgfds222222222222", options);

    const razorpayOrder = await razorpay.orders.create(options);

    if (!razorpayOrder || razorpayOrder.status !== "created") {
      throw new Error("Failed to create Razorpay order.");
    }

    order.razorpayOrderId = razorpayOrder.id;
    order.paymentStatus = "PaymentPending";
    await order.save();

    console.log("order", order);

    res.json({
      success: true,
      message: "Payment retry initiated.",
      amount: order.totalAmount,
      currency: "INR",
      razorpayOrderId: razorpayOrder.id,
      receipt: razorpayOrder.receipt,
    });
  } catch (error) {
    console.error("Retry Payment Error:", error);
    next(error);
  }
};

const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body;
    console.log(req.body);

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid payment response." });
    }

    const order = await Order.findOne({ razorpayOrderId: razorpay_order_id });
    console.log("2ndorder", order);

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found." });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    const generated_signature = crypto
      .createHmac("sha256", secret)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (generated_signature === razorpay_signature) {
      order.paymentStatus = "Paid";
      order.fulfillmentStatus = "Pending";
      order.status = "Confirmed";
      await order.save();

      return res.json({
        success: true,
        message: "Payment verified successfully.",
        orderId: order._id,
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "Payment verification failed.",
      });
    }
  } catch (error) {
    console.error("Payment Verification Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Payment verification error." });
  }
};

module.exports = {
  userProfile,
  loadprofile,
  cancelOrder,
  getOrderDetails,
  changeEmail,
  changeEmailVaild,
  verifyEmailOtp,
  updateEamil,
  loadChangePassword,
  changePassword,
  loadAddress,
  addAddress,
  loadEditAddress,
  loadAddAddress,
  editAddress,
  deleteAddress,
  loadForgetPassword,
  forgetPassword,
  forgetPasswordOtp,
  loadResetPassword,
  resetPassword,
  oderDelivered,
  addReview,
  requestReturn,
  downloadInvoice,
  retryPayment,
  verifyPayment,
};
