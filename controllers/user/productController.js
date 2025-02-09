const Product = require('../../models/productSchema');
const Category = require('../../models/categotySchema'); 
const User = require('../../models/userSchema');
const errorHandler = require('../../middlewares/errorMiddleware');




const productDetails = async (req, res,next) => {
  try {
    const user = req.session.user;
    const userData = await User.findOne({ _id: user });
    const productId = req.query.id;

    if (!productId) {
      console.error("Product ID is missing from request.");
      return res.redirect("/pageNotFound");
    }

    
    const product = await Product.findById(productId)
      .populate("category")
      .populate({
        path: "reviews",
        populate: {
          path: "user",
          select: "name",
        },
      });

    if (!product) {
      console.error(`Product with ID ${productId} not found.`);
      return res.redirect("/pageNotFound");
    }

    
    console.log("Product Data:", product);

    
    const categoryOffer = product.category?.categoryOffer || 0; 
    const productOffer = product.productOffer || 0; 
    const effectiveOffer = Math.max(categoryOffer, productOffer); 
    const salePrice = product.salePrice - (product.salePrice * effectiveOffer) / 100;


    
    console.log("Category Offer:", categoryOffer);
    console.log("Product Offer:", productOffer);
    console.log("Effective Offer:", effectiveOffer);
    console.log(" SalePrice:", salePrice);

   
    

    
    // console.log("Offer Price Calculation:", product.regularPrice, "*", effectiveOffer, "/", 100, "=", offerPrice);
    // console.log("Sale Price Calculation:", product.regularPrice, "-", offerPrice, "=", salePrice);

  
    const formattedSalePrice = salePrice.toFixed(2);
    // const formattedOfferPrice = offerPrice.toFixed(2);

    
    const offerPercentage = `${effectiveOffer}% OFF`;

    
    console.log("Formatted Sale Price:", formattedSalePrice);
    // console.log("Formatted Offer Price:", formattedOfferPrice);
    // console.log("Offer Percentage:", offerPercentage);

    const variantsWithStock = product.variant.map((variant) => ({
      size: variant.size,
      stock: variant.quantity > 0 ? "In Stock" : "Out of Stock",
    }));
    console.log("Variants with stock:", variantsWithStock);

 
    const relatedProducts = await Product.find({
      category: product.category,
      _id: { $ne: productId },
    }).limit(4);

    res.render("product-details", {
      user: userData,
      product,
      variants: variantsWithStock,
      category: product.category,
      relatedProducts,
      effectiveOffer, 
      salePrice: formattedSalePrice, 
      // offerPrice: formattedOfferPrice, 
      offerPercentage, 
    });
  } catch (error) {
    console.error("Error in productDetails:", error);
    next(error);
    
  }
};




const shopLoad = async (req, res) => {
  try {
    const user = req.session.user;
    const userData = await User.findOne({ _id: user });

    
    const { sort = "latest", limit = 8, page = 1, search = "", category = [] } = req.query;

   
    const selectedCategory = Array.isArray(category) ? category : [category];

 
    const perPage = parseInt(limit);
    const currentPage = parseInt(page);
    const skip = (currentPage - 1) * perPage;

 
    let searchCriteria = {
      isBlocked: false,
      $or: [{ productName: { $regex: search, $options: "i" } }],
    };

   
    if (selectedCategory.length > 0 && selectedCategory[0] !== "") {
      searchCriteria.category = { $in: selectedCategory };
    }

    
    const sortOptions = {
      popularity: { popularity: -1 },
      lowToHigh: { salePrice: 1 },
      highToLow: { salePrice: -1 },
      newArrivals: { createdAt: -1 },
      aToZ: { productName: 1 },
      zToA: { productName: -1 },
      latest: { createdAt: -1 },
    };

    const sortCriteria = sortOptions[sort] || sortOptions.latest;

    
    const totalProduct = await Product.countDocuments(searchCriteria);

 
    const totalPages = Math.ceil(totalProduct / perPage);

  
    const products = await Product.find(searchCriteria)
      .populate({
        path: "category",
        match: { isListed: true },
      })
      .sort(sortCriteria)
      .skip(skip)
      .limit(perPage);

    
    const processedProducts = products
      .filter((product) => product.category)
      .map((product) => {
        const categoryOffer = product.category?.categoryOffer || 0;
        const productOffer = product.productOffer || 0;
        const effectiveOffer = Math.max(categoryOffer, productOffer);
        const salePrice = product.salePrice - (product.salePrice * effectiveOffer) / 100;

        return {
          ...product._doc,
          effectiveOffer,
          salePrice: salePrice.toFixed(2),
          displayOffer: `${effectiveOffer}% OFF`,
        };
      });

   
    const categories = await Category.find({ isListed: true });

    res.render("shope", {
      user: userData,
      products: processedProducts,
      categories,
      currentPage,
      totalPages,
      limit: perPage,
      sortOption: sort,
      searchQuery: search,
      selectedCategory,
    });
  } catch (error) {
    console.error("Error in shopLoad:", error.message);
    res.status(500).render("error", { message: "Internal server error." });
  }
};



  
  
  











module.exports = { productDetails,shopLoad, };
