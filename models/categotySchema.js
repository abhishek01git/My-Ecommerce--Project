const mongoose=require('mongoose');
const CategorySchema=new mongoose.Schema({
   name:{
    type:String,
    required:true,
    unique:true,
   },
   description:{
    type:String,
    required:true
   },
   isListed:{
    type:Boolean,
     default:true,
   },
   image: { 
      type: String, 
      required: false
    },
   createdAt:{
   type:Date,
   default:Date.now
   },
   categoryOffer: {
      type: Number, 
      default: 0,   
      required: false
   }

});
const Category=mongoose.model("Category",CategorySchema);
module.exports=Category;