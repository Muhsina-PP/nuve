const User = require("../../models/userSchema")
const Order = require("../../models/orderSchema")
const mongoose = require("mongoose")
const bcrypt = require("bcrypt")

const pageNotFound = async (req, res) => {
  try {
    return res.render("pageError");
  } catch (error) {
    console.log("Error getting page-404 : ", error);
    return res.status(500).send("Something went wrong");
  }
};


const loadLogin = (req, res) =>{
  try {  
    if(req.session.admin){
      return res.redirect("/admin/dashboard")
    }
    return res.render("admin-login", {message : null})
  } catch (error) {
    console.error("Admin login page loading error : ",error);  
    return res.redirect("/admin/pageNotFound")   
  }
}


const login = async (req, res) => {
  try {
    const email = req.body.email.trim().toLowerCase();
    const password = req.body.password;

    const admin = await User.findOne({ email, isAdmin: true });

    if (!admin) {
      return res.redirect("/admin/login");
    }

    const passwordMatch = await bcrypt.compare(password, admin.password);

    if (!passwordMatch) {
      return res.redirect("/admin/login");
    }

    req.session.admin = admin._id;

    return res.redirect("/admin/dashboard");

  } catch (error) {
    console.log("Admin login error:", error);
    return res.redirect("/admin/pageNotFound");
  }
};


const loadDashboard = async(req,res) =>{
    try {

      if(!req.session.admin){
         return res.redirect("/admin/login");
      }

      const totalOrders = await Order.countDocuments();
      const deliveredOrders = await Order.countDocuments({
        status : 'Delivered'
      })
      
      const totalUsers = await User.countDocuments({
        isAdmin : false
      })

      const revenueData = await Order.aggregate([
        {
          $match: {
            status: "Delivered"
          }
        },
        {
          $unwind: "$orderedItems"
        },
        {
          $match: {
            "orderedItems.status": {
              $nin: ["Returned", "Cancelled"]
            }
          }
        },
        {
          $group: {
            _id: null,
            totalRevenue: {
              $sum: "$orderedItems.finalItemPrice"
            }
          }
        }
      ]);

      const totalRevenue = revenueData.length > 0 ? revenueData[0].totalRevenue : 0;

      // Top 10 Best Selling Products
      const topProducts = await Order.aggregate([
        { $match: { status: "Delivered" } },
        { $unwind: "$orderedItems" },
        {
          $group: {
            _id: "$orderedItems.product",
            totalSold: { $sum: "$orderedItems.quantity" }
          }
        },
        { $sort: { totalSold: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: "products",
            localField: "_id",
            foreignField: "_id",
            as: "productDetails"
          }
        },
        { $unwind: "$productDetails" }
      ]);

      // Top 10 Best Selling Categories
      const topCategories = await Order.aggregate([
        { $match: { status: "Delivered" } },
        { $unwind: "$orderedItems" },
        {
          $lookup: {
            from: "products",
            localField: "orderedItems.product",
            foreignField: "_id",
            as: "productInfo"
          }
        },
        { $unwind: "$productInfo" },
        {
          $group: {
            _id: "$productInfo.category",
            totalSold: { $sum: "$orderedItems.quantity" }
          }
        },
        { $sort: { totalSold: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: "categories",
            localField: "_id",
            foreignField: "_id",
            as: "categoryDetails"
          }
        },
        { $unwind: "$categoryDetails" }
      ]);

      // Top 10 Best Selling Brands
      const topBrands = await Order.aggregate([
        { $match: { status: "Delivered" } },
        { $unwind: "$orderedItems" },
        {
          $lookup: {
            from: "products",
            localField: "orderedItems.product",
            foreignField: "_id",
            as: "productInfo"
          }
        },
        { $unwind: "$productInfo" },
        {
          $group: {
            _id: "$productInfo.brand",
            totalSold: { $sum: "$orderedItems.quantity" }
          }
        },
        { $sort: { totalSold: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: "brands",
            localField: "_id",
            foreignField: "_id",
            as: "brandDetails"
          }
        },
        { $unwind: "$brandDetails" }
      ]);

      return res.render("dashboard", {
        title : 'Dashboard',
        totalOrders,
        deliveredOrders,
        totalUsers,
        totalRevenue,
        topProducts,
        topCategories,
        topBrands
       }) 

    } catch (error) {
      console.log("Loading dashboard error : ",error);
      return res.redirect("/admin/pageNotFound")   
    }
}

const logout = async (req,res) =>{
  try {
    req.session.destroy (err =>{
      if(err){
        console.log("Error destroying session : ",err);   
        return res.redirect("/admin/pageNotFound")    
      }
      res.redirect("/admin/login")
    })
  } catch (error) {
    console.log("Error logging out admin : ",error);
    return res.redirect("/admin/pageNotFound")
  }
}


const getSalesChart = async (req, res) => {
  try {
    const filter = req.query.filter || "monthly";
    const now = new Date();
    let startDate;
    let grouping;

    if (filter === "yearly") {
      startDate = new Date(now.getFullYear(), 0, 1);
      grouping = { $month: "$createdOn" };
    } else if (filter === "monthly") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      grouping = { $dayOfMonth: "$createdOn" };
    } else if (filter === "weekly") {
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 7);
      grouping = { $dayOfWeek: "$createdOn" };
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      grouping = { $hour: "$createdOn" };
    }

    const salesData = await Order.aggregate([
      {
        $match: {
          status: "Delivered",
          createdOn: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: grouping,
          totalSales: { $sum: "$finalAmount" }
        }
      },
      { $sort: { "_id": 1 } }
    ]);

    const labels = salesData.map(d => {
      if (filter === "yearly") {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return months[d._id - 1];
      } else if (filter === "weekly") {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return days[d._id - 1];
      }
      return d._id;
    });

    res.json({
      success: true,
      labels,
      data: salesData.map(d => d.totalSales)
    });

  } catch (error) {
    console.error("Error fetching chart data:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

const getLedgerBook = async (req, res) => {
  try {
    const orders = await Order.find({})
      .populate('userId', 'name')
      .sort({ createdOn: -1 });

    const ledgerData = orders.map(order => ({
      orderId: order.orderId ? order.orderId.slice(0, 8).toUpperCase() : 'N/A',
      date: order.createdOn.toISOString().split('T')[0],
      customer: order.userId ? order.userId.name : 'Unknown',
      totalPrice: order.totalPrice,
      discount: order.discount,
      couponDiscount: order.couponDiscount || 0,
      walletUsed: order.walletUsed || 0,
      gstAmount: order.gstAmount || 0,
      finalAmount: order.finalAmount,
      paymentMethod: order.paymentMethod,
      status: order.status
    }));

    res.render("ledger-book", {
      title: 'Ledger Book',
      data: ledgerData
    });

  } catch (error) {
    console.log("Error loading ledger book : ", error);
    res.status(500).send("Internal Server Error");
  }
}

module.exports = {
  pageNotFound,
  loadLogin,
  login,
  loadDashboard,
  logout,
  getSalesChart,
  getLedgerBook
}