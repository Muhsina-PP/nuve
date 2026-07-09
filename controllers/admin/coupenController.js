const Coupen = require("../../models/coupenSchema");

// Load all coupons (existing)
const loadCoupen = async (req, res) => {
  try {
    const coupon = await Coupen.find().sort({ createdAt: -1 });
    res.render("coupen", {
      title: "Coupon",
      coupons: coupon,
    });
  } catch (error) {
    console.log("Error loading coupen page : ", error);
    res.json({ success: false, message: "Error loading coupon page" });
  }
};

// Create a new coupon (existing)
const createCoupen = async (req, res) => {
  try {
    const { code, discount, minAmount, expiry, type, usageLimit, perUserLimit, isActive } = req.body;

    const existing = await Coupen.findOne({ code });
    if (existing) {
      return res.json({ success: false, message: "Coupon already exists" });
    }

    await Coupen.create({ code, discount, minAmount, expiry, type, usageLimit, perUserLimit, isActive });
    return res.status(200).json({ success: true, message: "Coupen created successfully" });
  } catch (error) {
    console.log("Error creating coupon : ", error);
    res.json({ success: false, message: "Error creating coupon" });
  }
};

// Delete a coupon (existing)
const deleteCoupon = async (req, res) => {
  try {
    const couponId = req.params.id;
    await Coupen.findByIdAndDelete(couponId);
    return res.status(200).json({ success: true, message: "Coupen deleted successfully" });
  } catch (error) {
    console.log("Error deleting coupon : ", error);
    res.send("Error deleting coupon");
  }
};


const editCouponForm = async (req, res) => {
  try {
    const couponId = req.params.id;
    const coupon = await Coupen.findById(couponId);
    if (!coupon) {
      return res.status(404).render("error", { message: "Coupon not found" });
    }
    res.render("edit-coupon", { title: "Edit Coupon", coupon });
  } catch (error) {
    console.log("Error loading edit coupon form : ", error);
    res.status(500).render("error", { message: "Server error" });
  }
};

// Process edit submission (POST)
const updateCoupon = async (req, res) => {
  try {
    const couponId = req.params.id;
    const { code, discount, minAmount, expiry, type, usageLimit, perUserLimit, isActive } = req.body;

    // Ensure code uniqueness when changing
    const existing = await Coupen.findOne({ code, _id: { $ne: couponId } });
    if (existing) {
      return res.json({ success: false, message: "Another coupon with this code already exists" });
    }

    await Coupen.findByIdAndUpdate(couponId, {
      code,
      discount,
      minAmount,
      expiry,
      type,
      usageLimit,
      perUserLimit,
      isActive,
    });
    // Fetch the updated coupon
    const updatedCoupon = await Coupen.findById(couponId);
    // Render the edit form with success message
    return res.render('edit-coupon', { title: 'Edit Coupon', coupon: updatedCoupon, success: 'Coupon updated successfully' });
  } catch (error) {
    console.log("Error updating coupon : ", error);
    res.json({ success: false, message: "Error updating coupon" });
  }
};

module.exports = {
  createCoupen,
  loadCoupen,
  deleteCoupon,
  editCouponForm,
  updateCoupon,
};