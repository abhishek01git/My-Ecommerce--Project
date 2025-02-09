const { default: mongoose } = require('mongoose');
const Coupon = require('../../models/couponSchema');

const loadCoupon = async (req, res) => {
  
  
  try {
      
      let page = parseInt(req.query.page) || 1;
      const limit = 4; 

      const skip = (page - 1) * limit;
      const findCoupons = await Coupon.find({})
          .skip(skip) 
          .limit(limit); 

      
      const totalCoupons = await Coupon.countDocuments({});

      
      const totalPages = Math.ceil(totalCoupons / limit);

     
      return res.render('coupon', {
          Coupons: findCoupons,
          currentPage: page,
          totalPages: totalPages,
      });
  } catch (error) {
      console.error(error); 
      return res.redirect("/PageError");
  }
};


     
const createCoupon = async (req, res) => {
  try {
      
      const existingCoupons = await Coupon.find({}, 'name');       
      if (existingCoupons) {
        return res.status(400).json({ 
            success: false, 
            message: "Coupon already exists!" 
        });
    }
    

      const data = {
          couponName: req.body.couponName,
          startDate: new Date(req.body.startDate + "T00:00:00"),
          endDate: new Date(req.body.endDate + "T00:00:00"), 
          offerPrice: parseFloat(req.body.offerPrice), 
          minimumPrice: parseInt(req.body.minimumPrice),
         
      };

      console.log("Coupon Data:", data);

      const newCoupon = new Coupon({
          name: data.couponName,
          createdOn: data.startDate,
          expireOn: data.endDate,
          offerPrice: data.offerPrice,
          minimumPrice: data.minimumPrice,
          isActive: new Date() >= data.startDate,
      });

      console.log("newcoupon", newCoupon);

      await newCoupon.save();

      return res.redirect('/admin/coupon');
  } catch (error) {
      console.error(error);
      res.redirect("/PageError");
  }
};




const editCoupon = async (req, res) => {
    try {
        const id = req.query.id;
        
       
        const findCoupon = await Coupon.findById(id);
        
        if (!findCoupon) {
            return res.redirect('/PageError');  
        }

        res.render('editCoupon', {
            findCoupon: findCoupon
        });
    } catch (error) {
        console.error(error); 
        res.redirect('/PageError');
    }
};

const updatecoupon = async (req, res) => {
    try {
  
      const { couponId, couponName, startDate, endDate, offerPrice, minimumPrice } = req.body;
  
      if (!couponId || !couponName || !startDate || !endDate || !offerPrice || !minimumPrice) {
        return res.status(400).send("Missing required fields");
      }
  
      const id = new mongoose.Types.ObjectId(couponId);
  
    
      const selectedCoupon = await Coupon.findOne({ _id: id });
      if (!selectedCoupon) {
        return res.status(404).send("Coupon not found");
      }
  
   
      const updateCoupon = await Coupon.findOneAndUpdate(
        { _id: id },
        {
          $set: {
            name: couponName,
                    createdOn: new Date(startDate + "T00:00:00Z"),
                    expireOn: new Date(endDate + "T23:59:59Z"), // Ensures the coupon is valid till the end of the day
                    offerPrice: parseFloat(offerPrice),
                    minimumPrice: parseInt(minimumPrice),
                    isActive: new Date() >= new Date(startDate),
          },
        },
        { new: true } 
      );
  
      if (updateCoupon) {
        res.send("Coupon updated successfully");
      } else {
        res.status(500).send("Coupon update failed");
      }
    } catch (error) {
      console.error("Error updating coupon:", error);
      res.status(500).send("Internal Server Error");
    }
  };




  const deletecoupon = async (req, res) => {
    try {
      const id = req.query.id;
      console.log(id);
      
  
      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).send({ success: false, message: "Invalid coupon ID" });
      }
  
     
      const result = await Coupon.deleteOne({ _id: id });
  
      if (result.deletedCount === 0) {
       
        return res.status(404).send({ success: false, message: "Coupon not found" });
      }
  
      res.status(200).send({ success: true, message: "Coupon deleted successfully" });
    } catch (error) {
      console.error("Error deleting coupon:", error);
      res.status(500).send({ success: false, message: "Failed to delete coupon" });
    }
  };
  
  

module.exports = {
    loadCoupon,
    createCoupon,
    editCoupon,
    updatecoupon,
    deletecoupon
};
