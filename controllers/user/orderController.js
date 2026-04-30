const Order = require("../../models/orderSchema");
const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const PDFDocument = require("pdfkit");


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
       order
    })
  } catch (error) {
    console.log("Error loading order-details page : ",error);
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

    await order.save();

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

    //  restore stock
    await Product.findOneAndUpdate(
      {
        _id: item.product._id,
        "variants.size": item.variant
      },
      {
        $inc: { "variants.$.stock": item.quantity }
      }
    );

    await Order.updateOne(
      { _id : orderId, 'orderedItems.product' : productId },
      { $set :{ 'orderedItems.$.status' : 'Cancelled' } }
    )

    // update item
    item.status = "Cancelled";
    item.returnReason = reason || "No reason";

    const allCancelled = order.orderedItems.every(i => i.status === "Cancelled");

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