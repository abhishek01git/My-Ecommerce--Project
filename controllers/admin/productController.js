const Product = require("../../models/productSchema");
const Category = require("../../models/categotySchema");
const mongoose = require('mongoose');
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const { log } = require("console");

const getProductAddPage = async (req, res) => {
  try {
    const category = await Category.find({ isListed: true });
    res.render("product-add", { cat: category });
  } catch (error) {
    console.error("Error fetching categories:", error.message);
    res.redirect("/pageError");
  }
};

const addProducts = async (req, res) => {
  try {
    const {
      productName,
      description,
      category,
      regularPrice,
      salePrice,
      size,
    } = req.body;

    const sizeArray = Object.keys(size).map((key) => ({
      size: key,
      quantity: parseInt(size[key], 10),
    }));

    if (
      !productName ||
      !description ||
      !category ||
      !regularPrice ||
      !salePrice ||
      !size ||
      sizeArray.length === 0
    ) {
      return res
        .status(400)
        .json({
          error:
            "All fields are required, and at least one size must be specified.",
        });
    }

    if (Number(salePrice) > Number(regularPrice)) {
      return res
        .status(400)
        .json({
          error: "Sale price must be less than or equal to the regular price.",
        });
    }

    for (const item of sizeArray) {
      if (!item.size || !["S", "M", "L", "XL"].includes(item.size)) {
        return res
          .status(400)
          .json({
            error: `Invalid size value: ${item.size}. It should be 'S', 'M', 'L', or 'XL'.`,
          });
      }
      if (typeof item.quantity !== "number" || item.quantity < 0) {
        return res
          .status(400)
          .json({
            error: `Invalid quantity for size: ${item.size}. It must be a positive number.`,
          });
      }
    }

    const productExist = await Product.findOne({
      productName: productName.trim(),
    });
    if (productExist) {
      return res
        .status(400)
        .json({ error: "Product already exists, try with another name." });
    }

    const categoryData = await Category.findOne({ name: category });
    if (!categoryData) {
      return res.status(400).json({ error: "Invalid category name." });
    }

    const images = [];

    if (req.files && req.files.length > 0) {
      for (let i = 0; i < req.files.length; i++) {
        try {
          const originalImagePath = req.files[i].path;
          const timestamp = Date.now();
          const imageName = `${timestamp}-${req.files[i].filename}`;
          const resizedImagePath = path.join(
            "public",
            "uploads",
            "product-image",
            imageName
          );
          console.log(imageName);
          console.log("this is the path", resizedImagePath);

          await sharp(originalImagePath)
            .resize({ width: 440, height: 440 })
            .toFile(resizedImagePath);

          images.push("/uploads/product-image/" + imageName);
          console.log("this is the image", images);
        } catch (err) {
          console.error("Image processing error:", err);
          return res
            .status(500)
            .json({ error: "Error processing images, please try again." });
        }
      }
    }

    const totalQuantity = sizeArray.reduce(
      (sum, item) => sum + item.quantity,
      0
    );

    const newProduct = new Product({
      productName,
      description,
      category: categoryData._id,
      regularPrice: Number(regularPrice),
      salePrice: Number(salePrice),
      variant: sizeArray,
      productImage: images,
      status: totalQuantity > 0 ? "Available" : "Out of stock",
    });

    await newProduct.save();

    console.log("this is the newProducts", newProduct);

    return res.redirect("/admin/products");
  } catch (error) {
    console.error("Error adding product:", error);
    return res
      .status(500)
      .json({ error: "Something went wrong. Please try again later." });
  }
};

const getAllProducts = async (req, res) => {
  try {
    const searchQuery = req.query.search || "";
    const page = parseInt(req.query.page, 10) || 1;
    const limit = 3;

    const searchRegex = new RegExp(".*" + searchQuery + ".*", "i");

    
    const productData = await Product.find({
      productName: { $regex: searchRegex },
    })
      .limit(limit)
      .skip((page - 1) * limit)
      .populate("category") 
      .exec();

    const count = await Product.countDocuments({
      productName: { $regex: searchRegex },
    });

    const categories = await Category.find({ isListed: true });

    if (categories) {
     
      const processedProducts = productData.map((product) => {
        const categoryOffer = product.category?.categoryOffer || 0; 
        const productOffer = product.productOffer || 0; 
        const effectiveOffer = Math.max(categoryOffer, productOffer); 

        
        const salePrice = product.regularPrice - (product.regularPrice * effectiveOffer) / 100;

        return {
          ...product._doc, 
          effectiveOffer,
          salePrice: salePrice.toFixed(2), 
        };
      });

      res.render("products", {
        data: processedProducts, 
        currentPage: page,
        totalPages: Math.ceil(count / limit),
        totalCount: count,
        categories: categories,
      });
    } else {
      res.redirect("page-404");
    }
  } catch (error) {
    console.error(error);
    res.redirect("/pageError");
  }
};


const blockProduct = async (req, res) => {
  try {
    const id = req.query.id;
    const page = req.query.page;
    await Product.updateOne({ _id: id }, { $set: { isBlocked: true } });
    res.redirect(`/admin/products?page=${page}`);
  } catch (error) {
    res.redirect("/pageError");
  }
};

const unblockProduct = async (req, res) => {
  try {
    const id = req.query.id;
    const page = req.query.page;
    await Product.updateOne({ _id: id }, { $set: { isBlocked: false } });
    res.redirect(`/admin/products?page=${page}`);
  } catch (error) {
    res.redirect("/pageError");
  }
};

const geteditProduct = async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) {
      console.error("Product ID missing in query parameters.");
      return res
        .status(400)
        .render("error", { message: "Product ID is required" });
    }

    const product = await Product.findById(id).populate("category").lean();
    if (!product) {
      console.error(`No product found with ID: ${id}`);
      return res.status(404).render("error", { message: "Product not found" });
    }

    const categories = await Category.find({ isListed: true }).lean();
    console.log("Product:", product);
    console.log("Categories:", categories);

    res.render("edit-product", { product, cat: categories });
  } catch (error) {
    console.error("Error in geteditProduct:", error.message);
    res.redirect("/pageError");
  }
};

const editProduct = async (req, res) => {
  try {
    const id = req.params.id;
    console.log('full data',req.body);
    

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    if (req.body.category) {
      const categoryData = await Category.findOne({
        name: req.body.category,
      }).select("_id");
      if (!categoryData) {
        return res.status(400).json({ error: "Invalid category name." });
      }
      product.category = categoryData._id;
    }

    const existingProduct = await Product.findOne({
      productName: req.body.productName,
      _id: { $ne: id },
    });

    if (existingProduct) {
      return res
        .status(400)
        .json({ error: "Product already exists. Try with another name." });
    }

    product.productName = req.body.productName || product.productName;
    product.description = req.body.description || product.description;
    product.regularPrice = req.body.regularPrice || product.regularPrice;
    product.salePrice = req.body.salePrice || product.salePrice;

    if (req.body.size) {
      
      const sizeArray = Object.keys(req.body.size).map((key) => {
        const sizeDetails = req.body.size[key];
    
        
        if (!sizeDetails || typeof sizeDetails.quantity === "undefined") {
          throw new Error(`Invalid size data for size: ${key}`);
        }
    
const quantity=parseInt(sizeDetails.quantity,10)
if(quantity<0||isNaN(quantity)){
  throw new Error(
    `invaild quentiy  is must a non negitive number`
  )
}


        return {
          size: key,
          quantity: parseInt(sizeDetails.quantity, 10),
        };
      });
    
      
      product.variant = sizeArray;
      console.log("Updated variant:", product.variant);
    
      
      try {
        await product.save();
        console.log("Product variants saved successfully.");
      } catch (saveError) {
        console.error("Error saving product variants:", saveError.message);
        return res.status(500).json({ error: "Failed to save product variants." });
      }
    }
    
   
   

   const images = product.productImage || []; 

   if (req.files && req.files.length > 0) {
     for (let i = 0; i < req.files.length; i++) {
       try {
         const originalImagePath = req.files[i].path;
         const timestamp = Date.now();
         const imageName = `${timestamp}-${req.files[i].filename}`;
         const resizedImagePath = path.join(
           "public",
           "uploads",
           "product-image",
           imageName
         );
         console.log(imageName);
         console.log("this is the path", resizedImagePath);
   
         await sharp(originalImagePath)
           .resize({ width: 440, height: 440 })
           .toFile(resizedImagePath);
   
         images.push("/uploads/product-image/" + imageName); 
       } catch (err) {
         console.error("Image processing error:", err);
         return res
           .status(500)
           .json({ error: "Error processing images, please try again." });
       }
     }
     product.productImage = images; 
   }
   

    await product.save();

    console.log("Updated product:", product);

    res.redirect("/admin/products");
  } catch (error) {
    console.error("Error while editing product:", error.message || error);
    res.redirect("/pageError");
  }
};

const getProductVariants = async (req, res) => {
  try {
    const productId = req.query.id;

    if (!productId) {
      return res
        .status(400)
        .json({ success: false, message: "Product ID is required" });
    }

    const product = await Product.findById(productId).populate("category");

    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    console.log(product);

    const productName = product.productName || "Default Product Name";

    const categories = await Category.find();

    const sizes = {};
    if (product.variant && Array.isArray(product.variant)) {
      product.variant.forEach((variant) => {
        sizes[variant.size] = variant.quantity;
      });
    }

    res.render("product-variants", {
      productName: productName,
      product: product,
      sizes: sizes,
      categories: categories,
    });
  } catch (error) {
    console.error("Error fetching product variants:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const handleProductvariants = async (req, res) => {
  try {
    const { productId, sizeS, sizeM, sizeL, sizeXL } = req.body;
    res.redirect("/admin/products");
  } catch (error) {
    console.error("Error processing form submission:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const deleteSingleImage = async (req, res) => {
  try {
    const { imagePath } = req.body;
    const productId = req.params.productId;

    const fullPath = path.join(__dirname, "..", "public", imagePath);

    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }

    await Product.findByIdAndUpdate(productId, {
      $pull: { productImage: imagePath },
    });

    res.json({ success: true, message: "Image deleted successfully." });
  } catch (error) {
    console.error("Error deleting image:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to delete image." });
  }
};




const addProductOffer = async (req, res) => {
  try {
    const { productId, percentage } = req.body;
    console.log('reqbody',req.body);
    

    if (!productId || typeof percentage === 'undefined') {
      return res.json({ status: false, message: 'Product ID and percentage are required.' });
    }

    if (percentage < 0 || percentage > 100) {
      return res.json({ status: false, message: 'Percentage must be between 0 and 100.' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.json({ status: false, message: 'Product not found.' });
    }
    console.log("full product",product);
    

    // Check if the category offer conflicts with the product offer
    // const category = await Category.findById(product.category);
    // if (category && category.categoryOffer > percentage) {
    //   return res.json({ status: false, message: 'Category offer is greater than the product offer.' });
    // }

    
    product.productOffer = percentage;
    product.salePrice = Math.floor(product.regularPrice - (product.regularPrice * percentage) / 100);
    await product.save();

    res.json({ status: true, message: 'Product offer added successfully.' });
  } catch (error) {
    console.error('Error adding product offer:', error);
    res.status(500).json({ status: false, message: 'Internal server error.' });
  }
};


const removeProductOffer = async (req, res) => {
  try {
    const { productId } = req.body;
    console.log("Received productId:", productId);  
    console.log('jkjkkjkjk')

   
    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ status: false, message: 'Invalid Product ID.' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ status: false, message: 'Product not found.' });
    }

    
    product.productOffer = 0;
    product.salePrice = product.regularPrice; 
    await product.save();

    res.status(200).json({ status: true, message: 'Product offer removed successfully.' });
  } catch (error) {
    console.error('Error removing product offer:', error);  
    res.status(500).json({ status: false, message: 'Internal server error.' });
  }
};


module.exports = {
  getProductAddPage,
  addProducts,
  getAllProducts,
  blockProduct,
  unblockProduct,
  geteditProduct,
  editProduct,
  deleteSingleImage,
  getProductVariants,
  handleProductvariants,
  addProductOffer,
  removeProductOffer
};
