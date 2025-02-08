const mongoose = require("mongoose");
const Order = require("../../models/oderSchemma");
const moment = require('moment');
const PDFDocument = require('pdfkit');
const xlsx = require('xlsx');
const fs = require('fs');
const ExcelJS = require('exceljs');
const Wallet=require('../../models/WalletSchemma')



const getAllOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1; // Get the current page from query params (default to 1)
    const limit = 10; // Number of orders per page
    const skip = (page - 1) * limit; // Number of orders to skip based on the page

    // Fetch paginated orders
    const orders = await Order.find({})
      .populate("userId")
      .populate("address")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();

    // Get the total number of orders
    const totalOrders = await Order.countDocuments({});
    const totalPages = Math.ceil(totalOrders / limit); // Calculate total pages

    res.render("oder", {
      orders,
      currentPage: page, // Pass current page to the view
      totalPages, // Pass total pages to the view
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).send("Server Error");
  }
};

const getOrderDetails = async (req, res) => {
  const orderId = req.params.orderId;

  try {
    const order = await Order.findById(orderId)
      .populate("userId")
      .populate("address")
      .exec();
    if (!order) {
      return res.status(404).send("Order not found");
    }
    res.render("oderDetails", { order });
  } catch (error) {
    console.error("Error fetching order details:", error);
    res.status(500).send("Server Error");
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const orderId = req.query.id;
    const status = req.body.orderStatus;
    console.log('orderId is here', orderId);
    console.log('status is here', status);
    
    const validStatuses = ["Pending", "Shipped", "Delivered", "canceled"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid order status" });
    }
    
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    
    if (order.status === "Delivered" || order.status === "canceled") {
      return res.status(403).json({ success: false, message: `Order status cannot be updated to '${status}'` });
    }
    
    if (status === "canceled" && order.paymentStatus === "Paid") {
      // Process refund if payment status is 'Paid'
      const wallet = await Wallet.findOne({ userId: order.userId });
      if (wallet) {
        wallet.balance += order.totalAmount;
        wallet.transactions.push({
          type: "credit",
          amount: order.totalAmount,
          description: `Refund for order cancellation (Order ID: ${orderId})`,
        });
        await wallet.save();
        console.log(`Refund of ${order.totalAmount} has been added to user's wallet`);
      }
    }
    
    order.status = status;
    await order.save();
    
    res.status(200).json({ success: true, message: "Order status updated successfully", newStatus: order.status });
    
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const approveReturn = async (req, res) => {
  try {
    const { orderId } = req.params;

   
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }

    
    const order = await Order.findById(orderId).populate('items.productId');
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    console.log("Order fetched: ", order);
    
    
    const hasPendingReturnRequests = order.returnStatus === "Requested" || order.items.some(item => item.returnStatus === "Requested");

    if (hasPendingReturnRequests) {
     
      order.returnStatus = "Approved";

   
      order.items.forEach(item => {
        if (item.returnStatus === "Requested") {
          item.returnStatus = "Approved"; 
        }
      });

      
      await order.save();

      console.log("Updated order: ", order);

      return res.status(200).json({
        success: true,
        message: "Return request approved successfully.",
        order,
      });
    } else {
      return res.status(400).json({
        message: "No pending return request at the order level or for individual items.",
      });
    }
  } catch (error) {
    console.error("Error in approveReturn:", error);
    res.status(500).json({ message: "Server error" });
  }
};


const loadReport = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1); 
    const limit = 6; 
    const skip = (page - 1) * limit;
    

    console.log('Requested Page:', page); 

    
    const orders = await Order.find({
      $or: [
        { status: 'Delivered' },
        { items: { $elemMatch: { cancelStatus: 'Cancelled' } } }
      ]
    })
      .populate('userId', 'name email') 
      .populate('items.productId', 'productName price') 
      .sort({ createdAt: -1 }) 
      .limit(limit)
      .skip(skip);

    console.log('Fetched Orders:', orders); 

   
    const totalOrders = await Order.countDocuments({
      $or: [
        { status: 'Delivered' },
        { items: { $elemMatch: { cancelStatus: 'Cancelled' } } }
      ]
    });

    console.log('Total Orders Count:', totalOrders); 

    const totalPages = Math.ceil(totalOrders / limit);

   
    const salesMetrics = await Order.aggregate([
      {
        $match: {
          $or: [
            { status: 'Delivered' },
            { items: { $elemMatch: { cancelStatus: 'Cancelled' } } }
          ]
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' },
          totalOrders: { $sum: 1 },
          averageOrderValue: { $avg: '$totalAmount' }
        }
      }
    ]);

    console.log('Sales Metrics:', salesMetrics); 

    const { totalRevenue, totalOrders: totalOrderCount, averageOrderValue } = salesMetrics[0] || {
      totalRevenue: 0,
      totalOrders: 0,
      averageOrderValue: 0
    };

    
    console.log('Render Data:', {
      orders,
      totalPages,
      currentPage: page,
      totalRevenue,
      totalOrderCount,
      averageOrderValue
    });

   
    res.render('reports', {
      orders,
      totalPages,
      currentPage: page,
      totalRevenue,
      totalOrderCount,
      averageOrderValue
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.redirect('/admin/pageerror'); 
  }
};




const loadPdf = async (req, res) => {
  try {
    const { start_date, end_date, range } = req.query;

    let startDate, endDate;

    const today = moment().startOf("day");

    if (range === "daily") {
      startDate = today.toDate();
      endDate = moment().endOf("day").toDate();
    } else if (range === "weekly") {
      startDate = today.subtract(7, "days").toDate();
      endDate = moment().endOf("day").toDate();
    } else if (range === "yearly") {
      startDate = today.startOf("year").toDate();
      endDate = moment().endOf("year").toDate();
    } else if (start_date && end_date) {
      startDate = new Date(start_date);
      endDate = new Date(end_date);
    } else {
      return res.status(400).send("Invalid date range.");
    }

    console.log(`Generating report from ${startDate} to ${endDate}`);

   
    const salesData = await Order.find({
      status: { $in: ["Delivered", "canceled"] },
      createdAt: { $gte: startDate, $lte: endDate },
    }).populate("items.productId");

    if (!salesData.length) {
      return res.status(404).send("No orders found for the selected range.");
    }

    
    const doc = new PDFDocument({ margin: 50, size: "A4" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=sales_report.pdf`);

    doc.pipe(res);

  
    doc.fontSize(20).text("Sales Report", { align: "center" });
    doc.fontSize(12).text(`Report for: ${moment(startDate).format("LL")} to ${moment(endDate).format("LL")}`, { align: "center" });
    doc.moveDown(2);

    
    const totalSales = salesData.reduce((sum, order) => sum + order.totalAmount, 0);
    const totalOrders = salesData.length;
    const avgSale = totalOrders > 0 ? totalSales / totalOrders : 0;

    doc.fontSize(14).text(`Total Sales: ${totalSales.toFixed(2)}`);
    doc.text(`Total Orders: ${totalOrders}`);
    doc.text(`Average Sale Value: ${avgSale.toFixed(2)}`);
    doc.moveDown(1);

   
    doc.fontSize(10).text("Date", 50, doc.y, { width: 80 });
    doc.text("Order ID", 130, doc.y, { width: 120 });
    doc.text("Status", 250, doc.y, { width: 80 });
    doc.text("Items", 330, doc.y, { width: 150 });
    doc.text("Amount", 480, doc.y, { width: 80, align: "right" });

    doc.moveDown(1);

    
    salesData.forEach((order) => {
      const orderDate = moment(order.createdAt).format("YYYY-MM-DD");
      const itemsSummary = order.items.map((item) => `${item.quantity}x ${item.productId.productName}`).join(", ");
      doc.text(orderDate, 50, doc.y, { width: 80 });
      doc.text(order._id.toString().slice(-8), 130, doc.y, { width: 120 });
      doc.text(order.status, 250, doc.y, { width: 80 });
      doc.text(itemsSummary, 330, doc.y, { width: 150 });
      doc.text(`${order.totalAmount.toFixed(2)}`, 480, doc.y, { width: 80, align: "right" });
      doc.moveDown(1);
    });

    doc.end();
  } catch (error) {
    console.error("Error generating PDF:", error);
    res.status(500).send("Error generating report.");
  }
};

const loadExcel = async (req, res) => {
  try {
      const { filterType, startDate, endDate } = req.query;
      let filter = { status: { $in: ["Delivered", "Returned"] } };
      
      const currentDate = new Date();
      let start, end;

      if (filterType === "daily") {
          start = new Date(currentDate.setHours(0, 0, 0, 0)); 
          end = new Date(currentDate.setHours(23, 59, 59, 999));
      } else if (filterType === "weekly") {
          start = new Date();
          start.setDate(start.getDate() - 7);
          end = new Date();
      } else if (filterType === "yearly") {
          start = new Date(currentDate.getFullYear(), 0, 1);
          end = new Date(currentDate.getFullYear(), 11, 31, 23, 59, 59);
      } else if (filterType === "custom" && startDate && endDate) {
          start = new Date(startDate);
          end = new Date(endDate);
      }

      if (start && end) {
          filter.createdAt = { $gte: start, $lte: end };
      }

      
      const orders = await Order.find(filter).lean().populate('userId');

     
      const data = orders.map(order => ({
          ID: order._id.toString(),
          Name: order.userId?.name || 'N/A',
          Email: order.userId?.email || 'N/A',
          Total: `${order.totalAmount.toFixed(2)}`,
          Status: order.status,
          Date: new Date(order.createdAt).toLocaleDateString(),
      }));

      
      const workbook = xlsx.utils.book_new();
      const worksheet = xlsx.utils.json_to_sheet(data);
      xlsx.utils.book_append_sheet(workbook, worksheet, 'Orders');

    
      const excelBuffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Disposition', 'attachment; filename=orders.xlsx');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.send(excelBuffer);

  } catch (error) {
      console.error('Error generating Excel file:', error);
      res.status(500).send('Could not generate Excel file');
  }
};






module.exports = {
  getAllOrders,
  getOrderDetails,
  updateOrderStatus,
  approveReturn,
  loadReport,
  loadPdf,
  loadExcel
  
};
