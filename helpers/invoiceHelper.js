const PDFDocument = require("pdfkit");

/**
 * Generates a premium PDF invoice for an order.
 * @param {Object} order - The order document from MongoDB.
 * @param {Object} res - The Express response stream.
 */
const generateInvoice = (order, res) => {
  const doc = new PDFDocument({ margin: 50, size: "A4" });

  // Colors
  const primaryColor = "#d4145a";
  const secondaryColor = "#333333";
  const mutedColor = "#666666";
  const borderColor = "#eeeeee";

  doc.pipe(res);

  // ── HEADER ──
  doc
    .fillColor(primaryColor)
    .fontSize(28)
    .text("NUVE", 50, 50, { lineGap: 5 })
    .fontSize(10)
    .fillColor(mutedColor)
    .text("Step into Style", 50, 85);

  doc
    .fillColor(secondaryColor)
    .fontSize(20)
    .text("INVOICE", 400, 50, { align: "right", width: 150 })
    .fontSize(10)
    .fillColor(mutedColor)
    .text(`Order ID: #${order.orderId.toString().slice(0, 8).toUpperCase()}`, 400, 80, { align: "right", width: 150 })
    .text(`Date: ${new Date(order.createdOn).toLocaleDateString()}`, 400, 95, { align: "right", width: 150 });

  doc.moveTo(50, 115).lineTo(550, 115).strokeColor(borderColor).stroke();

  // ── CUSTOMER & ORDER INFO ──
  const startY = 140;
  
  // Left side: Shipping Address
  doc
    .fillColor(secondaryColor)
    .fontSize(12)
    .text("Shipping Address", 50, startY)
    .fontSize(10)
    .fillColor(mutedColor)
    .moveDown(0.5)
    .text(order.address.name)
    .text(`${order.address.landMark}, ${order.address.city}`)
    .text(`${order.address.state} - ${order.address.pincode}`)
    .text(`Phone: ${order.address.phone}`);

  // Right side: Payment Method
  doc
    .fillColor(secondaryColor)
    .fontSize(12)
    .text("Order Information", 350, startY)
    .fontSize(10)
    .fillColor(mutedColor)
    .moveDown(0.5)
    .text(`Payment Method: ${order.paymentMethod || "COD"}`)
    .text(`Payment Status: ${order.paymentStatus || "Pending"}`)
    .text(`Order Status: ${order.status}`);

  doc.moveDown(2);

  // ── ITEMS TABLE ──
  const tableTop = 260;
  doc.font("Helvetica-Bold");
  
  // Table Header Background
  doc
    .rect(50, tableTop, 500, 25)
    .fill("#f9f9f9");
  
  doc
    .fillColor(primaryColor)
    .fontSize(10)
    .text("Product", 60, tableTop + 8)
    .text("Price", 250, tableTop + 8)
    .text("Qty", 330, tableTop + 8)
    .text("Status", 380, tableTop + 8)
    .text("Total", 480, tableTop + 8);

  doc.font("Helvetica");
  let y = tableTop + 35;

  order.orderedItems.forEach((item) => {
    // Check if we need a new page
    if (y > 700) {
      doc.addPage();
      y = 50;
    }

    const itemTotal = item.price * item.quantity;
    
    doc
      .fillColor(secondaryColor)
      .fontSize(9)
      .text(item.product.productName, 60, y, { width: 180 })
      .text(`₹${item.price.toLocaleString("en-IN")}`, 250, y)
      .text(item.quantity.toString(), 330, y)
      .text(item.status, 380, y, { width: 90 })
      .text(`₹${itemTotal.toLocaleString("en-IN")}`, 480, y);

    y += 30;
    doc.moveTo(50, y - 5).lineTo(550, y - 5).strokeColor(borderColor).lineWidth(0.5).stroke();
  });

  // ── SUMMARY ──
  const totalMRP = order.orderedItems.reduce((s, i) => s + (i.regularPrice || i.price) * i.quantity, 0);
  const totalSale = order.orderedItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const couponDiscount = order.couponDiscount || 0;
  const productDiscount = totalMRP - totalSale;
  const delivery = totalSale >= 999 ? 0 : 99;
  const grandTotal = totalSale + delivery - couponDiscount;

  y += 20;

  const summaryX = 350;
  const summaryValueX = 480;

  const drawSummaryRow = (label, value, isBold = false, isDiscount = false) => {
    if (isBold) doc.font("Helvetica-Bold").fillColor(secondaryColor);
    else doc.font("Helvetica").fillColor(mutedColor);
    
    if (isDiscount) doc.fillColor("#2e7d32"); // Green for discounts

    doc.fontSize(10).text(label, summaryX, y);
    doc.text(value, summaryValueX, y, { align: "right", width: 70 });
    y += 20;
  };

  drawSummaryRow("Subtotal (MRP):", `₹${totalMRP.toLocaleString("en-IN")}`);
  drawSummaryRow("Product Discount:", `-₹${productDiscount.toLocaleString("en-IN")}`, false, true);
  
  if (order.coupon) {
    drawSummaryRow(`Coupon (${order.coupon}):`, `-₹${couponDiscount.toLocaleString("en-IN")}`, false, true);
  }

  drawSummaryRow("Delivery Charges:", delivery === 0 ? "FREE" : `₹${delivery}`, false);
  
  doc.moveTo(summaryX, y).lineTo(550, y).strokeColor(borderColor).stroke();
  y += 10;
  
  drawSummaryRow("GRAND TOTAL:", `₹${grandTotal.toLocaleString("en-IN")}`, true);

  // ── FOOTER ──
  doc
    .fontSize(10)
    .fillColor(mutedColor)
    .text("Thank you for shopping with NUVE!", 50, 750, { align: "center", width: 500 })
    .fontSize(8)
    .text("This is a computer generated invoice and does not require a signature.", 50, 765, { align: "center", width: 500 });

  doc.end();
};

module.exports = {
  generateInvoice,
};
