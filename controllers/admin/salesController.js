const Order = require("../../models/orderSchema");

const getSalesReport = async (req, res) => {
  try {
    const { filter, startDate: qStart, endDate: qEnd } = req.query;

    let startDate;
    let endDate = new Date();
    let today = new Date();

    if (filter === 'today') {
      startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date();
      endDate.setHours(23, 59, 59, 999);
    } else if (filter === 'week') {
      startDate = new Date();
      startDate.setDate(today.getDate() - 7);
    } else if (filter === 'month') {
      startDate = new Date(today.getFullYear(), today.getMonth(), 1);
    } else if (filter === 'year') {
      startDate = new Date(today.getFullYear(), 0, 1);
    } else if (filter === 'custom' && qStart && qEnd) {
      startDate = new Date(qStart);
      endDate = new Date(qEnd);
      endDate.setHours(23, 59, 59, 999);
    } else {
      // Default to last 30 days if no filter
      startDate = new Date();
      startDate.setDate(today.getDate() - 30);
    }

    const query = {
      status: 'Delivered',
      createdOn: { $gte: startDate, $lte: endDate }
    };

    const orders = await Order.find(query)
      .populate('userId', 'name')
      .populate('orderedItems.product', 'productName')
      .sort({ createdOn: -1 });

    const reportData = [];
    orders.forEach(order => {
      // Kept items are those that were delivered and NOT returned/cancelled
      const keptItems = order.orderedItems.filter(item => 
        !['Returned', 'Cancelled', 'Return Requested', 'Return Approved'].includes(item.status)
      );

      if (keptItems.length === 0) return;

      const itemNames = keptItems.map(item => item.product ? item.product.productName : 'Unknown').join(', ');
      
      // Amount without any discount (MRP)
      const orderAmount = keptItems.reduce((sum, item) => sum + (item.regularPrice || item.price) * item.quantity, 0);
      
      // Product/Category discount (MRP - Sale Price)
      const discount = keptItems.reduce((sum, item) => sum + ((item.regularPrice || item.price) - item.price) * item.quantity, 0);
      
      // Coupon discount share for kept items
      const coupon = keptItems.reduce((sum, item) => sum + (item.couponShare || 0), 0);
      
      // Net amount for kept items (Sale Price - Coupon Share)
      const net = keptItems.reduce((sum, item) => sum + (item.finalItemPrice || (item.price * item.quantity - (item.couponShare || 0))), 0);

      reportData.push({
        orderId: order.orderId ? order.orderId.slice(0, 8).toUpperCase() : 'N/A',
        date: order.createdOn.toISOString().split('T')[0],
        customer: order.userId ? order.userId.name : 'Unknown',
        itemNames,
        items: keptItems.length,
        orderAmount,
        discount,
        coupon,
        couponCode: order.coupon || '—',
        net,
        status: order.status.toLowerCase()
      });
    });

    if (req.query.json === 'true') {
      return res.json({
        success: true,
        data: reportData,
        summary: {
          totalSales: reportData.length,
          totalAmount: reportData.reduce((s, r) => s + r.orderAmount, 0),
          totalDiscount: reportData.reduce((s, r) => s + r.discount, 0),
          totalCoupon: reportData.reduce((s, r) => s + r.coupon, 0),
          totalNet: reportData.reduce((s, r) => s + r.net, 0)
        }
      });
    }

    res.render("sales-report", {
      title: 'Sales Report',
      data: reportData
    });

  } catch (error) {
    console.log("Error loading sales report : ", error);
    if (req.query.json === 'true') {
      return res.status(500).json({ success: false, message: "Error fetching report data" });
    }
    res.status(500).send("Internal Server Error");
  }
}

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
  getSalesReport,
  getLedgerBook
}