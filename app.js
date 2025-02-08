const express=require('express');
const env=require("dotenv").config();
const connectDB = require('./config/db');
const path=require("path");
const userRoute=require('./routes/userRouter')
const session=require('express-session')
const passport=require('./config/passport')
const adminRouter=require('./routes/adminRouter')
const orderRoutes = require('./routes/userRouter');
const nocache = require('nocache');
const methodOverride = require('method-override');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const moment = require('moment');
const PDFDocument = require('pdfkit');
const XLSX = require('xlsx');
const fs = require('fs');
const errorHandler = require('./middlewares/errorMiddleware');
const errorMiddleware=require('./middlewares/ErrorHandleing')



const app=express();


app.use(errorHandler);

app.use(express.json());
app.use(methodOverride('_method'));

app.use(express.urlencoded({extended:true}));

app.use(nocache())

app.use(session({
  secret:process.env.SESSION_SECRET,
  resave:false,
  saveUninitialized:true,
  cookie:{
    secure:false,
    httpOnly:true,
    maxAge:72*60*60*1000
  }
}))

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,  // Set your Razorpay Key ID here
  key_secret: process.env.RAZORPAY_KEY_SECRET  // Set your Razorpay Key Secret here
});


app.use(passport.initialize());
app.use(passport.session());

app.use('/uploads', express.static('uploads'));
app.use('/api', userRoute);



// app.use((req,res,next)=>{
//   res.set('cache-controller','no-store')
//   next();
// });



app.set("view engine","ejs");
app.set("views", [path.join(__dirname,'views/user'), path.join(__dirname, "views/admin")])
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(express.static(path.join(__dirname,"public")));


app.use('/',userRoute);
app.use('/admin',adminRouter);


app.use(errorMiddleware.checkError)

connectDB();
const PORT=process.env.PORT||3000;

app.listen(PORT,()=>{
  console.log("server is running");
  
})

module.exports=app