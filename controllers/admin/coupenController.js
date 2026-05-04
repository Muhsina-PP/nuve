const Coupen = require("../../models/coupenSchema");


const loadCoupen = async (req, res) =>{
  try {
    const coupon = await Coupen.find()
    res.render("coupen",{
       coupons : coupon
    })
  } catch (error) {
    console.log("Error loading coupen page : ",error);
    res.json({ success: false, message: "Error loading coupon page" });
  }
}

const createCoupen = async (req, res) =>{
  try {
    
    const { code, discount, minAmount, expiry } = req.body;

    const existing = await Coupen.findOne({ code });
    if (existing) {
      return res.json({ success: false, message: "Coupon already exists" });
    }

    await Coupen.create({
      code, 
      discount,
      minAmount,
      expiry
    })

    return res.status(200).json({
      success : true,
      message : 'Coupen created succesfully'
    })

  } catch (error) {
     console.log("Error creating coupon : " ,error);
     res.json({ success: false, message: "Error creating coupon" });
  }
}


const deleteCoupon = async (req, res) =>{
  try {
    const couponId  = req.params.id;
    await Coupen.findByIdAndDelete(couponId );
    return res.status(200).json({
      success : true,
      message : 'Coupen deleten succesfully'
    })
  } catch (error) {
    console.log("Error deleting coupon : ",error);
    res.send("Error deleting coupon");
  }
}

module.exports = {
  createCoupen,
  loadCoupen,
  deleteCoupon
}