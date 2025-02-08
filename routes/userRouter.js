const express = require('express');
const router = express.Router();
const userController = require('../controllers/user/userController'); 
const { userAuth, adminAuth } = require('../middlewares/auth');  
const passport = require('passport');
const productController=require('../controllers/user/productController')
const blocker=require('../middlewares/block');
const User=require('../models/userSchema')
const profileController=require('../controllers/user/profileController')
const Cart=require('../models/CartSchema')
const CartController=require('../controllers/user/cartController')
const oderController=require('../controllers/user/oderController')
const Review=require('../models/ReviewSchema')
const  WishlistController=require('../controllers/user/wishlistController')
const Order=require('../models/oderSchemma')





router.use((req, res, next) => {if (['/login', '/signup', '/auth/google', '/auth/google/callback'].includes(req.path)) {return next();  } blocker(req, res, next);});
router.get('/', blocker,userController.loadHomepage);
router.get('/signup', userController.loadingSignup);  
router.post('/signup', userController.signup);        
router.post('/verify-otp', userController.verifyOtp);   
router.post('/resend-otp', userController.resendOtp);   
router.get('/login', userController.loadLogin);         
router.post('/login', userController.login);            
router.get('/logout', userAuth, userController.logout); 
router.get('/pageNotFound', userController.pageNotFound); 
router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/auth/google/callback',passport.authenticate('google', { failureRedirect: '/signup' }), async( req, res) => {
    try {
      const user=req.session.passport.user;
      const userData=await User.findOne({_id:user,isBlocked:false})  
      if(userData){
        return  res.redirect('/'); 
      }
      req.session.destroy();
      return res.redirect('/login?message=user is blocked')
    } catch (error) { console.log('passport error',error);
            res.redirect('/pageNoteFound') }});
router.get('/productDetails',blocker,productController.productDetails);
router.get('/shop',blocker,productController.shopLoad);
router.post('/addToCart', userAuth, CartController.addToCart); 
router.get('/cart', userAuth, CartController.viewCart); 
router.patch('/cart/update/:productId', userAuth, CartController.updateCartQuantity);
router.delete('/cart/remove/:productId', userAuth,CartController.removeFromCart); 




router.post('/addToWishlist',userAuth,WishlistController.addToWishlist)

router.get('/wishlist',userAuth,WishlistController.getWishlist)
router.delete('/remove-wishlist-item',userAuth,WishlistController.removewishlist);

router.get('/profile',userAuth,profileController.userProfile)
router.get('/order-details/:orderId', userAuth, profileController.getOrderDetails);
router.post('/cancel-order/:orderId', userAuth,profileController.cancelOrder);
router.get('/profiletwo',userAuth,profileController.loadprofile)
router.get("/change-email",userAuth,profileController.changeEmail)
router.post("/change-email",userAuth,profileController.changeEmailVaild)
router.post('/verify-email-otp',userAuth,profileController.verifyEmailOtp)
router.post('/update-email',userAuth,profileController.updateEamil)

router.get('/change-password',userAuth,profileController.loadChangePassword);
router.post('/change-password',userAuth,profileController.changePassword)
router.get('/address',userAuth,profileController.loadAddress)
router.get('/add-address',userAuth,profileController.loadAddAddress)
router.post('/add-address',userAuth,profileController.addAddress)
router.get('/edit-address/:id',userAuth,profileController.loadEditAddress)
router.post('/edit-address',userAuth,profileController.editAddress)     
router.post('/deleteAddress/:id',userAuth,profileController.deleteAddress)
router.get('/forget-password',profileController.loadForgetPassword)
router.post('/forget-password',profileController.forgetPassword)
router.post('/forget-passwordOTP',profileController.forgetPasswordOtp)
router.get('/reset-password',profileController.loadResetPassword)
router.post('/reset-password',profileController.resetPassword)
router.post("/order/:orderId/deliver",userAuth,profileController.oderDelivered)
router.post('/review/:userId',userAuth,profileController.addReview)






router.get('/checkout',userAuth,oderController.renderCheckoutPage)
router.post('/checkout/add-address',userAuth,oderController.saveNewAddress)
router.post('/apply-coupon',userAuth,oderController.applyCoupon)
 router.get('/dispay-coupon',userAuth,oderController.availablecoupons)

 router.post('/place-order',userAuth,oderController.placeOrder);
 router.get('/order-success',userAuth, oderController.orderSuccess);
 router.get('/order-history',userAuth,oderController.getOrderHistory)

 router.post('/create-order',userAuth,oderController.createOrder)
 router.post('/verify-payment',userAuth,oderController.VerifyPayment)
 router.post('/order/:orderId/return',userAuth,profileController.requestReturn);
 router.get('/wallet',userAuth,oderController.getWallet );
 router.post("/updateWallet",userAuth,oderController.updateWallet)
 router.get('/download-invoice/:orderId',userAuth,profileController.downloadInvoice);
 
 router.post('/retry-payment/:orderId',userAuth,profileController.retryPayment);

router.post('/retryVerify-payment',userAuth,profileController.verifyPayment)
router.post('/Walletplace-Order',userAuth,oderController.walletPlaceOrder)
















module.exports = router;