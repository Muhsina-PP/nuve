const Order = require("../../models/orderSchema");
const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const PDFDocument = require("pdfkit");
const { creditWallet, debitWallet } = require("../../helpers/wallet");
const { generateInvoice } = require("../../helpers/invoiceHelper");


const loadOrders = async (req, res) => {
  try {

    const search = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const sort = req.query.sort || "";
    const statusFilter = req.query.status || "";
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

    if (statusFilter) {
      if (statusFilter === "Return Requested") {
        if (query.$or && query.$or.length > 0) {
          query = {
            $and: [
              { $or: query.$or },
              {
                $or: [
                  { status: "Return Requested" },
                  { "orderedItems.status": "Return Requested" }
                ]
              }
            ]
          };
        } else {
          query = {
            $or: [
              { status: "Return Requested" },
              { "orderedItems.status": "Return Requested" }
            ]
          };
        }
      } else {
        query.status = statusFilter;
      }
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
      title: 'Orders',
      orders,
      currentPage: page,
      skip,
      search: search,
      totalPages,
      totalOrders,
      sort,
      status: statusFilter,
    })

  } catch (error) {
    console.log("Error loading orders page : ", error);
    res.status(500).json({ message: "Error loading orders" });
  }
}


const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    const validStatuses = [
      "Pending",
      "Shipped",
      "Out Of Delivery",
      "Delivered",
      "Cancelled",
      "Returned",
      "Return Requested"
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
      "Delivered": ["Returned", "Return Requested"],
      "Return Requested": ["Returned"],
      "Returned": [],
      "Cancelled": []
    };
    if (!flow[order.status].includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot change from ${order.status} to ${status}`
      });
    }

    order.status = status;

    if (status === "Cancelled") {
      for (let item of order.orderedItems) {
        await Product.findOneAndUpdate(
          {
            _id: item.product,
            "variants.size": item.variant
          },
          {
            $inc: { "variants.$.stock": item.quantity }
          }
        );
        item.status = "Cancelled";
        item.returnReason = "Cancelled by Admin";
      }

      if (order.paymentMethod !== "COD") {
        await creditWallet(
          order.userId,
          order.finalAmount,
          "Order Cancelled by Admin",
          order._id
        );
      }
    } else {
      for (let item of order.orderedItems) {
        if (item.status !== "Cancelled" && item.status !== "Returned" && item.status !== "Return Requested") {
          item.status = status;
        }
      }
    }

    await order.save();

    res.json({
      success: true,
      message: "Order status updated successfully"
    });

  } catch (error) {
    console.log("Error updating status : ", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
}


const loadOrderDetails = async (req, res) => {
  try {

    const { orderId } = req.params;
    const order = await Order.findById(orderId)
      .populate("orderedItems.product");

    if (!order) {
      return res.status(404).send("Order not found");
    }

    const totalPrice = order.totalPrice;
    const discount = order.discount || 0;

    const shippingCharge = totalPrice < 999 ? 99 : 0;
    const finalAmount = totalPrice - discount + shippingCharge;

    res.render("single-order-details", {
      title: 'Order Details',
      order,
      shippingCharge,
      finalAmount,
    });


  } catch (error) {
    console.log("Error getting order details page : ", error);
    res.status(500).send("Server error");
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


const verifyReturn = async (req, res) => {
  try {

    const { orderId, itemId } = req.body;

    const order = await Order.findById(orderId)
      .populate('orderedItems.product')

    if (!order) {
      return res.status(400).json({ success: false, message: 'This order not found' })
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

    if (item.status !== "Return Requested") {
      return res.status(400).json({
        success: false,
        message: "Return not requested"
      });
    }


    item.status = 'Returned';

    //  Restore stock
    await Product.findOneAndUpdate(
      {
        _id: item.product._id,
        'variants.size': item.variant
      },
      {
        $inc: { 'variants.$.stock': item.quantity }
      }
    )

    const itemAmount = item.finalItemPrice || (item.quantity * item.price);

    if (item.status === 'Returned') {
      await creditWallet(
        order.userId,
        itemAmount,
        "Item Returned",
        order._id
      )
    }

    const allReturned = order.orderedItems.every(
      i => i.status === 'Returned'
    )

    if (allReturned) {
      order.status = 'Returned'
    } else {
      const hasPendingReturn = order.orderedItems.some(
        i => i.status === 'Return Requested'
      )
      if (!hasPendingReturn) {
        order.status = 'Delivered'
      }
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