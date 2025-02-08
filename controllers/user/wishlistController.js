const Wishlist = require('../../models/wishlist'); 
const Product = require('../../models/productSchema');
const mongoose = require("mongoose"); 

const addToWishlist = async (req, res) => {
  try {
    
    if (!req.user || !mongoose.Types.ObjectId.isValid(req.user._id)) {
      return res.status(401).send({ success: false, message: "Unauthorized: Please log in to add products to your wishlist" });
    }

    const userId = req.user._id;
    const { productId } = req.body;

    
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).send({ success: false, message: "Invalid product ID" });
    }

   
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).send({ success: false, message: "Product not found" });
    }

    
    const existingWishlist = await Wishlist.findOne({ userId });
    if (existingWishlist && existingWishlist.products.some((p) => p.productId.toString() === productId)) {
      return res.status(400).send({ success: false, message: "Product is already in your wishlist" });
    }


    const wishlist = await Wishlist.findOneAndUpdate(
      { userId },
      { $push: { products: { productId, addedOn: Date.now() } } },
      { new: true, upsert: true }
    ).populate('products.productId', 'name price imageUrl'); 

    console.log("Updated wishlist:", wishlist);

    res.status(200).send({ success: true, message: "Product added to wishlist", wishlist });
  } catch (error) {
    console.error("Error adding to wishlist:", error.message);
    res.status(500).send({ success: false, message: "Failed to add product to wishlist" });
  }
};



  const getWishlist = async (req, res) => {
    try {
      const userId = req.user._id; 
  
      const wishlist = await Wishlist.findOne({ userId })
        .populate({
          path: 'products.productId',
          select: 'productName regularPrice productImage size', 
        });
  
      if (!wishlist) {
        return res.status(404).send({ success: false, message: "Wishlist not found" });
      }
  
      res.render('wishlist', { wishlist: wishlist.products }); 
    } catch (error) {
      console.error("Error fetching wishlist:", error);
      res.status(500).send({ success: false, message: "Failed to fetch wishlist" });
    }
  };
  



 

  const removewishlist = async (req, res) => {
    try {
        const userId = req.user._id;  
        const { productId } = req.body;  

        console.log("Received productId:", productId);

        
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).send({ success: false, message: "Invalid product ID" });
        }

        
        const updatedWishlist = await Wishlist.findOneAndUpdate(
            { userId },
            { $pull: { products: { productId } } },
            { new: true }
        ).populate({
            path: 'products.productId',
            select: 'productName salePrice productImage size',
        });

        if (!updatedWishlist) {
            return res.status(404).send({ success: false, message: "Wishlist not found" });
        }

        res.status(200).send({ success: true, message: "Product removed from wishlist", wishlist: updatedWishlist.products });

    } catch (error) {
        console.error("Error removing product from wishlist:", error.message);
        res.status(500).send({ success: false, message: "Failed to remove product from wishlist" });
    }
};









module.exports = { addToWishlist,getWishlist,removewishlist };
