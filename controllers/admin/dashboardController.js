const Product = require("../../models/productSchema");
const Order = require("../../models/oderSchemma");
const Category = require("../../models/categotySchema");
const User = require("../../models/userSchema");

const TotalRevenu = async (req, res) => {
  try {
    const totalRevenue = await Order.aggregate([
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]);
    console.log(totalRevenue);

    const totalOrders = await Order.countDocuments();
    const totalProducts = await Product.countDocuments();
    const totalUsers = await User.countDocuments();

    res.json({
      totalRevenue: totalRevenue.length > 0 ? totalRevenue[0].total : 0,
      totalOrders,
      totalProducts,
      totalUsers,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

const SalesData = async (req, res) => {
  try {
    const { period, year, startDate, endDate } = req.query;
    console.log("Request Params:", req.query);

    let matchStage = {};

    // Handle custom date range
    if (startDate && endDate) {
      matchStage = {
        $match: {
          createdAt: {
            $gte: new Date(startDate),
            $lt: new Date(endDate),
          },
        },
      };
    }
    // Handle yearly period
    else if (period === "yearly" && year) {
      matchStage = {
        $match: {
          createdAt: {
            $gte: new Date(`${year}-01-01`),
            $lt: new Date(`${+year + 1}-01-01`),
          },
        },
      };
    }
    // Handle monthly period
    else if (period === "monthly" && year) {
      matchStage = {
        $match: {
          createdAt: {
            $gte: new Date(`${year}-01-01`),
            $lt: new Date(`${+year + 1}-01-01`),
          },
        },
      };
    }

    const salesData = await Order.aggregate([
      matchStage,
      {
        $group: {
          _id:
            period === "yearly"
              ? { year: { $year: "$createdAt" } }
              : {
                  month: { $month: "$createdAt" },
                  year: { $year: "$createdAt" },
                },
          totalSales: { $sum: "$totalAmount" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    console.log("salesData", salesData);

    res.json(salesData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching sales data" });
  }
};


const TopProducts = async (req, res) => {
  try {
    const topProducts = await Order.aggregate([
      {
        $unwind: "$items",
      },
      {
        $group: {
          _id: "$items.productId",
          totalQuantity: { $sum: "$items.quantity" },
        },
      },
      {
        $sort: { totalQuantity: -1 },
      },
      {
        $limit: 5,
      },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "productDetails",
        },
      },
      {
        $unwind: "$productDetails",
      },
    ]);

    if (topProducts.length > 0) {
      res.status(200).json({
        success: true,
        topProducts: topProducts.map((product) => ({
          productId: product._id,
          productName: product.productDetails.productName,
          sales: product.totalQuantity,
        })),
      });
    } else {
      res.status(404).json({
        success: false,
        message: "No products found",
      });
    }
  } catch (err) {
    console.error("Error fetching top 10 products by quantity:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

const TopCategory = async (req, res) => {
  try {
    const topCategories = await Order.aggregate([
      {
        $match: {
          status: { $ne: "Cancelled" },
          "items.cancelStatus": { $ne: "Cancelled" },
          "items.returnStatus": { $ne: "Requested" },
        },
      },
      { $unwind: "$items" },
      {
        $lookup: {
          from: "products",
          localField: "items.productId",
          foreignField: "_id",
          as: "productDetails",
        },
      },
      { $unwind: "$productDetails" },
      {
        $lookup: {
          from: "categories",
          localField: "productDetails.category",
          foreignField: "_id",
          as: "categoryDetails",
        },
      },
      { $unwind: "$categoryDetails" },
      {
        $group: {
          _id: "$categoryDetails._id",
          categoryName: { $first: "$categoryDetails.name" },
          totalSold: { $sum: "$items.quantity" },
        },
      },
      { $sort: { totalSold: -1 } },
      { $limit: 10 },
    ]);

    console.log("topCategories", topCategories);

    res.status(200).json({ success: true, data: topCategories });
  } catch (error) {
    console.error("Error fetching top categories:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

module.exports = { TotalRevenu, SalesData, TopProducts, TopCategory };
