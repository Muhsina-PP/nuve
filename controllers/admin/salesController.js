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
      .sort({ createdOn: -1 });

    const reportData = orders.map(order => ({
      orderId: order.orderId ? order.orderId.slice(0, 8).toUpperCase() : 'N/A',
      date: order.createdOn.toISOString().split('T')[0],
      customer: order.userId ? order.userId.name : 'Unknown',
      items: order.orderedItems.length,
      orderAmount: order.totalPrice,
      discount: order.discount || 0,
      coupon: order.couponDiscount || 0,
      couponCode: order.coupon || '—',
      net: order.finalAmount,
      status: order.status.toLowerCase()
    }));

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

module.exports = {
  getSalesReport
}