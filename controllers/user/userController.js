const User = require("../../models/userSchema");
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const env = require("dotenv").config();
const Joi = require("joi");

const Category = require("../../models/categotySchema");
const Product = require("../../models/productSchema");
const Wallet=require('../../models/WalletSchemma')


const loadHomepage = async (req, res) => {
  try {
    if (req.session.passport) {
      req.session.user = req.session.passport.user;
    }

    const category = await Category.find({ isListed: true });

    
    let productData = await Product.find({ isBlocked: false })
      .populate({ path: "category", match: { isListed: true } })
      .sort({ createdAt: -1 })  
      .limit(5); 

    
    productData = productData.filter((product) => product.category);

    
    const processedProducts = productData.map((product) => {
      const categoryOffer = product.category?.categoryOffer || 0; 
      const productOffer = product.productOffer || 0; 
      const effectiveOffer = Math.max(categoryOffer, productOffer); 

      const salePrice =
        product.regularPrice - (product.regularPrice * effectiveOffer) / 100;

      return {
        ...product._doc, 
        effectiveOffer, 
        salePrice: salePrice.toFixed(2), 
      };
    });

    const user = req.session.user;
    if (user) {
      const userData = await User.findOne({ _id: user });

      let wallet = await Wallet.findOne({ userId: user });
      if (!wallet) {
        wallet = new Wallet({
          userId: user,
          balance: 0, 
          transactions: [], 
        });
        await wallet.save();
        console.log(`Wallet created for user ${user}`);
      }

      return res.render("home", {
        user: userData,
        wallet, 
        products: processedProducts, 
        categories: category,
      });
    } else {
      return res.render("home", {
        products: processedProducts, 
        categories: category,
      });
    }
  } catch (error) {
    console.error("Error loading homepage:", error);
    res.status(500).send("Server error");
  }
};






const pageNotFound = async (req, res) => {
  try {
    res.render("page-404");
  } catch (error) {
    res.redirect("/pageNotFound");
  }
};




const loadingSignup = async (req, res) => {
  try {
    return res.render("signup");
  } catch (error) {
    console.log("home page not loadin", error);
    res.status(500).send("server error");
  }
};



function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const sendVarificationEmail = async (email, otp) => {
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

    const info = await transporter.sendMail({
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: "Verify Your Account",
      text: `Your OTP is ${otp}`,
      html: `<b>Your OTP: ${otp}</b>`,
    });

    if (info && info.accepted && info.accepted.length > 0) {
      return true;
    } else {
      console.error("Email not accepted:", info);
      return false;
    }
  } catch (error) {
    console.error("Error sending email:", error.message);
    return false;
  }
};

const signup = async (req, res) => {
  try {
    const { name, phone, email, password, confirm_password } = req.body;

    if (password !== confirm_password) {
      return res.render("signup", { message: "passwords is not match" });
    }
    const findUser = await User.findOne({ email });
    if (findUser) {
      return res.render("signup", { message: "email already register" });
    }
    const otp = generateOtp();

    const emailSend = await sendVarificationEmail(email, otp);
    if (!emailSend) {
      return res.json("email-error");
    }
    req.session.userOtp = otp;
    req.session.userData = { name, phone, email, password };
    res.render("verify-otp");
    console.log("otp send:", otp);
  } catch (error) {
    console.error("signup error", error);
    res.redirect("/pageNotFound");
  }
};



const securePassword = async (password) => {
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    return passwordHash;
  } catch (error) 
  {
    console.error("password error", error);
    res.redirect("/pageNotFound");
  }
};


const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    console.log(otp);
    if (otp === req.session.userOtp) {
      const user = req.session.userData;
      const passwordHash = await securePassword(user.password);
      const saveUserdata = new User({name: user.name, email: user.email,phone: user.phone,password: passwordHash,});
      await saveUserdata.save();
      req.session.user = saveUserdata._id;
      res.json({ success: true, redirectUrl: "/" });
    } else {
      res
        .status(400)
        .json({ success: false, message: "invalide otp,please try again" });
    }
  } catch (error) {
    console.error("erro verify otp", error);
    res.status(500).json({ success: false, message: "an error occure" });
  }
};



const resendOtp = async (req, res) => {
  try {
    if (!req.session || !req.session.userData || !req.session.userData.email) {
      return res
        .status(400)
        .json({ success: false, message: "User data not found in session." });
    }
    const { email } = req.session.userData;
    const otp = generateOtp();
    req.session.userOtp = otp;

    const emailSend = await sendVarificationEmail(email, otp);
    if (emailSend) {
      console.log("Resend OTP:", otp);
      return res.status(200).json({ success: true, message: "OTP resent successfully." });
    } else {
      return res
        .status(500)
        .json({success: false, message: "Failed to resend OTP. Please try again."});
    }
  } catch (error) {
    console.log("Error resending OTP:", error);
    return res.status(500).json({success: false,message: "An error occurred while resending OTP. Please try again." });
  }
};


const loadLogin = async (req, res) => {
  try {
    if (!req.session.user) {
      if (req.query.message === "user is blocked") {
        const message = req.query.message;
        return res.render("login", { message });
      }

      return res.render("login");
    } else {
      res.redirect("/");
    }
  } catch (error) {}
};



const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const loginSchema = Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().min(6).required(),
    });
    const { error } = loginSchema.validate(req.body);
    if (error) {
      return res.render("login", { message: error.details[0].message });
    }

    const findUser = await User.findOne({ isAdmin: false, email });
    if (!findUser) {
      return res.render("login", { message: "User not found" });
    }
    if (findUser.isBlocked) {
      return res.render("login", { message: "User is blocked by admin" });
    }

    const passwordMatch = await bcrypt.compare(password, findUser.password);
    if (!passwordMatch) {
      return res.render("login", { message: "Incorrect password" });
    }

    req.session.user = findUser.id;
    res.redirect("/");
  } catch (error) {
    console.error("Login error:", { email: req.body.email, error });
    res.render("login", { message: "Login failed. Please try again later" });
  }
};


const logout = async (req, res) => {
  try {
    req.session.destroy();
    res.redirect("/login");
  } catch (error) {
    console.error("Logout error:", error.message);
    res.redirect("/pageNotFound");
  }
};

module.exports = {
  loadHomepage,
  pageNotFound,
  signup,
  loadingSignup,
  verifyOtp,
  resendOtp,
  loadLogin,
  login,
  logout,
};
