const Order = require("../../models/orderSchema");
const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const PDFDocument = require("pdfkit");
const { creditWallet, debitWallet } = require("../../helpers/wallet");


const loadOrders = async  (req, res)=>{
  try {

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

    let sortOption = { createdOn: -1 }; 

    if (sort === "oldest") {
      sortOption = { createdOn: 1 };
    } else if (sort === "total-high") {
      sortOption = { finalAmount: -1 };
    } else if (sort === "total-low") {
      sortOption = { finalAmount: 1 };
    }

    const orders = await Order.find(query)
          .populate('orderedItems.product')
          .sort(sortOption)
          .skip(skip)
          .limit(limit);

    const totalOrders = await Order.countDocuments(query);
    const totalPages = Math.ceil(totalOrders / limit)

    res.render("orders", {
      orders,
      currentPage : page,
      skip,
      search : search,
      totalPages,
      totalOrders,
      sort
    })

  } catch (error) {
    console.log("Error loading orders page : ",error);
    res.status(500).json({ message: "Error loading orders" });
  }
}


const  updateOrderStatus = async (req, res) =>{
  try {
    const {orderId} = req.params;
    const {status} = req.body;

     const validStatuses = [
      "Pending",
      "Shipped",
      "Out Of Delivery",
      "Delivered",
      "Cancelled"
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status"
      });
    }
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }
    const flow = {
      "Pending": ["Shipped", "Cancelled"],
      "Shipped": ["Out Of Delivery"],
      "Out Of Delivery": ["Delivered"],
      "Delivered": [],
      "Cancelled": []
    };
    if (!flow[order.status].includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot change from ${order.status} to ${status}`
      });
    }

    order.status = status;
    await order.save();

    res.json({
      success: true,
      message: "Order status updated successfully"
    });

  } catch (error) {
    console.log("Error updating status : ",error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
}


const loadOrderDetails = async (req, res)=>{
  try {

    const {orderId} = req.params;
    const order = await Order.findById( orderId ) 
      .populate("orderedItems.product");

    if (!order) {
      return res.status(404).send("Order not found");
    }

    const totalPrice = order.totalPrice;
    const discount = order.discount || 0;

    const shippingCharge = totalPrice < 999 ? 99 : 0;
    const finalAmount = totalPrice - discount + shippingCharge;

    res.render("single-order-details", {
      order , 
      shippingCharge,
      finalAmount, 
    });


  } catch (error) {
    console.log("Error getting order details page : ",error);
    res.status(500).send("Server error");
  }
}

const downloadInvoice = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate({
      path: "orderedItems.product",
    });

    if (!order) return res.status(404).send("Order not found");

    const doc = new PDFDocument({ margin: 40 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=invoice-${order.orderId}.pdf`
    );

    doc.pipe(res);

    /* ---------------- HEADER ---------------- */
    doc
      .fontSize(22)
      .text("NUVE", 40, 40) // your brand name
      .fontSize(16)
      .text("INVOICE", 400, 40);

    doc.moveDown(2);

    doc
      .fontSize(10)
      .text(`Order ID: ${order.orderId}`)
      .text(`Date: ${new Date(order.createdOn).toLocaleDateString()}`);

    doc.moveDown();

    /* ---------------- ADDRESS ---------------- */
    doc.fontSize(12).text("Shipping Address:", 40);
    doc
      .fontSize(10)
      .text(order.address.name)
      .text(order.address.landMark)
      .text(`${order.address.city}, ${order.address.state}`)
      .text(`PIN: ${order.address.pincode}`)
      .text(`Phone: ${order.address.phone}`);

    doc.moveDown();

    /* ---------------- TABLE HEADER ---------------- */
    const tableTop = doc.y;

    doc.fontSize(11);
    doc.text("Item", 40, tableTop);
    doc.text("Qty", 300, tableTop);
    doc.text("Price", 350, tableTop);
    doc.text("Total", 450, tableTop);

    doc.moveTo(40, tableTop + 15)
      .lineTo(550, tableTop + 15)
      .stroke();

    /* ---------------- ITEMS ---------------- */
    let y = tableTop + 25;

    order.orderedItems.forEach((item) => {
      doc.fontSize(10);

      doc.text(item.product.productName, 40, y, { width: 240 });
      doc.text(item.quantity, 300, y);
      doc.text(`₹${item.price}`, 350, y);
      doc.text(`₹${item.price * item.quantity}`, 450, y);

      y += 25;
    });

    /* ---------------- TOTALS ---------------- */
    const totalMRP = order.orderedItems.reduce(
      (sum, i) => sum + (i.regularPrice || i.price) * i.quantity,
      0
    );

    const totalSale = order.orderedItems.reduce(
      (sum, i) => sum + i.price * i.quantity,
      0
    );

    const discount = totalMRP - totalSale;
    const delivery = totalSale >= 999 ? 0 : 99;
    const grandTotal = totalSale + delivery;

    doc.moveDown(2);

    doc.text(`Subtotal: ₹${totalMRP}`, { align: "right" });
    doc.text(`Discount: -₹${discount}`, { align: "right" });
    doc.text(`Delivery: ₹${delivery}`, { align: "right" });

    doc.moveDown();

    doc
      .fontSize(14)
      .text(`TOTAL: ₹${grandTotal}`, { align: "right" });

    doc.moveDown();

    doc.fontSize(10).text("Thank you for shopping with us!", {
      align: "center",
    });

    doc.end();

  } catch (err) {
    console.error(err);
    res.status(500).send("Error generating invoice");
  }
};

const verifyReturn = async (req, res)  =>{
  try {
    
    const { orderId, itemId} = req.body;

    const order = await Order.findById( orderId )
      .populate('orderedItems.product')

    if(!order){
      return res.status(400).json({success : false, message : 'This order not found'})
    }
    

    const item = order.orderedItems.find(
      i => i._id.toString() === itemId
    )

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found"
      });
    }

    if(item.status !== "Return Requested"){
      return res.status(400).json({
        success: false,
        message: "Return not requested"
      });
    }


    item.status = 'Returned';
    
     //  Restore stock
    await Product.findOneAndUpdate(
      {
      _id : item.product._id,
      'variants.size' : item.variant
      },
      {
        $inc  : { 'variants.$.stock' : item.quantity }
      }
    )

    const itemAmount = item.quantity * item.price;

    if(item.status === 'Returned'){
        await creditWallet(
          order.userId,
          itemAmount,
          "Item Returned",
          order._id
        )
    }

    const allReturned  = order.orderedItems.every(
      i => i.status === 'Returned'
    )

    if(allReturned){
      order.status = 'Returned'
    }

    console.log("Crediting wallet:", order.userId, itemAmount);

    await order.save();

    res.json({
      success: true
    });

  } catch (error) {
      console.error("verifyReturn error:", error);
      res.status(500).json({
        success: false,
        message: "Server error"
      });
  }
}



module.exports = {
  loadOrders,
  updateOrderStatus,
  loadOrderDetails,
  downloadInvoice,
  verifyReturn
}