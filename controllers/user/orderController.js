const Order = require("../../models/orderSchema");
const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const PDFDocument = require("pdfkit");
const { creditWallet, debitWallet } = require("../../helpers/wallet");
const { generateInvoice } = require("../../helpers/invoiceHelper");


const loadOrders = async (req, res)=>{
  try {

    const { status, date } = req.query;

    const search = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const sort = req.query.sort || "";
    const limit = 6;
    const skip = (page - 1) * limit;

    let query = {};

    if (search) {
      query = {
        $or: [
          { orderId: { $regex: search, $options: "i" } }, 
          { "address.name": { $regex: search, $options: "i" } } 
        ]
      };
    }

    if (status) {
      query.status = status;
    }

    if (date) {
      const now = new Date();

      if (date === "today") {
        const start = new Date(now.setHours(0,0,0,0));
        const end = new Date(now.setHours(23,59,59,999));

        query.createdOn = { $gte: start, $lte: end };
      }

      if (date === "week") {
        const start = new Date();
        start.setDate(start.getDate() - 7);

        query.createdOn = { $gte: start };
      }

      if (date === "month") {
        const start = new Date();
        start.setMonth(start.getMonth() - 1);

        query.createdOn = { $gte: start };
      }
    }

    const orders = await Order.find(query)
      .populate('orderedItems.product')
      .sort({createdOn : -1})
      .skip(skip)
      .limit(limit);

    const totalOrders = await Order.countDocuments();
    const totalPages = Math.ceil(totalOrders / limit)

    res.render("my-orders", {
      orders,
      currentPage : page,
      skip,
      search : search,
      totalPages,
      totalOrders,
      selectedStatus: status,
      selectedDate: date

    })
  } catch (error) {
    console.log("Error loading orders page : ",error);
  }
}



const loadOrderDetails = async (req, res) =>{
  try {
    const orderId = req.params.id;
    const order = await Order.findById( orderId ).populate('orderedItems.product');
    if (!order) {
      return res.redirect("/orders");
    }
    res.render('order-details', {
       order,
       razorpayKey: process.env.RAZORPAY_KEY_ID
    })
  } catch (error) {
    console.log("Error loading order-details page : ",error);
  }
}



const downloadInvoice = async (req, res) => {
  try {
    const orderId = req.params.id;
    const order = await Order.findById(orderId).populate({
      path: "orderedItems.product",
    });

    if (!order) return res.status(404).send("Order not found");

    const doc = await generateInvoice(order, res);

  } catch (err) {
    console.error(err);
    res.status(500).send("Error generating invoice");
  }
};



const cancelFullOrder = async (req,res) =>{
  try {

    const { orderId, reason } = req.body;
    const order = await Order.findById( orderId).populate("orderedItems.product")
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    if (order.status === "Delivered") {
      return res.status(400).json({ message: "Cannot cancel delivered order" });
    }
    for( let item of order.orderedItems){
      await Product.findOneAndUpdate(
        {
          _id: item.product._id,
          "variants.size": item.variant
        },
        {
            $inc: { "variants.$.stock": item.quantity }
        }
      );
      item.status = "Cancelled";
      item.returnReason = reason || "No reason";
    }

    order.status = "Cancelled";

    if (!order.paymentMethod) {
      order.paymentMethod = "COD";
    }

    await order.save();

    if(order.paymentMethod !== 'COD'){
      await creditWallet(
      order.userId,
      order.finalAmount,
      "Order Cancelled",
      order._id
    )
    }
    

    res.json({ message: "Order cancelled successfully" });

  } catch (error) {
    console.error('Error cancelling entire order : ',error);
    res.status(500).json({ message: "Error cancelling order" });
  }
}



const cancelSingleItem = async (req, res) => {
  try {
    const { orderId, productId, reason } = req.body;

    const order = await Order.findById(orderId).populate("orderedItems.product");

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const item = order.orderedItems.find(
      i => i.product._id.toString() === productId
    );

    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }

    if (item.status === "Cancelled") {
      return res.status(400).json({ message: "Item already cancelled" });
    }

    await Product.findOneAndUpdate(
      {
        _id: item.product._id,
        "variants.size": item.variant
      },
      {
        $inc: { "variants.$.stock": item.quantity }
      }
    );

    item.status = "Cancelled";
    item.returnReason = reason || "No reason";

    const refundAmount = item.finalItemPrice || (item.quantity * item.price);

    //  Wallet logic 
    if (
      order.paymentMethod === "Online" ||
      (order.paymentMethod === "COD" && order.status === "Delivered") ||
      order.paymentMethod === "Wallet"
    ) {
      await creditWallet(
        order.userId,
        refundAmount,
        "Item Cancelled",
        order._id
      );
    }

    //  Update order total
    order.finalAmount -= refundAmount;

    //  Update order status
    const allCancelled = order.orderedItems.every(
      i => i.status === "Cancelled"
    );
    console.log("All cancelled items : ",allCancelled)

    if (allCancelled) {
      order.status = "Cancelled";
    }

    await order.save();

    res.json({ message: "Item cancelled successfully" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error cancelling item" });
  }
};


const returnOrder = async (req, res) => {
  try {
    const { orderId, productId, reason } = req.body;

    const order = await Order.findById(orderId).populate('orderedItems.product');
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }
    console.log("Details : ",orderId, productId, reason );
    console.log("paths : ",req.originalUrl);
    const item = order.orderedItems.find(
      i => i.product._id.toString() === productId
    );

    if (!item) {
      return res.status(404).json({ success: false });
    }

    item.status = "Return Requested";
    item.returnReason = reason;

    await order.save();

    res.json({ success: true });

  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false });
  }
};



module.exports = {
  loadOrders,
  loadOrderDetails,
  downloadInvoice,
  cancelFullOrder,
  cancelSingleItem,
  returnOrder,
}