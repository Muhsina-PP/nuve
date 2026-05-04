const User = require("../../models/userSchema");
const Cart = require("../../models/cartSchema");
const Address = require("../../models/addressSchema");
const Order = require("../../models/orderSchema");
const Product = require("../../models/productSchema");
const Coupon = require("../../models/coupenSchema")
const razorpay = require("../../helpers/razorpay");
const crypto = require("crypto");
const { creditWallet, debitWallet, calculateWalletUsage } = require("../../helpers/wallet");


const deleteAddress = async (req, res) => {
  try {
    const { addressId } = req.body;
    const userId = req.session.user;
    const addressData = await Address.findOne({ userId: userId });
    if (!addressData) {
      return res.json({ success: false });
    }
    addressData.address.pull({ _id: addressId });
    await addressData.save();
    res.json({ success: true });
  } catch (error) {
    console.log("Error deleting address:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting address",
    });
  }
};

const loadCheckoutPage = async (req, res) => {
  try {
    const userId = req.session.user;
    const cart = await Cart.findOne({ userId }).populate("items.productId");
    const addresses = await Address.findOne({ userId });
    if (!cart || cart.items.length === 0) {
      return res.redirect("/cart");
    }
    const validItems = [];
    const invalidItems = [];

    for (let item of cart.items) {
      const product = item.productId;

      const variant = product.variants.find((v) => v.size === item.variant);
      if (!product || !variant || variant.stock <= 0) {
        invalidItems.push(item);
        continue;
      }

      // 🔧 adjust quantity if needed
      if (item.quantity > variant.stock) {
        item.quantity = variant.stock;
        item.totalPrice = item.price * item.quantity;
      }

      validItems.push(item);
    }

    cart.items = validItems;

    if (validItems.length === 0) {
      return res.redirect("/cart");
    }

    const totalMrp = validItems.reduce(
      (s, i) => s + i.productId.regularPrice * i.quantity,
      0,
    );
    const totalSale = validItems.reduce(
      (s, i) => s + i.productId.salePrice * i.quantity,
      0,
    );
    const delivery = totalSale >= 999 ? 0 : 99;
    const grandTotal = totalSale + delivery;

    await cart.save();

    res.render("checkout", {
      cartItems: validItems,
      addresses: addresses ? addresses.address : [],
      grandTotal,
      razorpayKey: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error("error loading checkout page : ", error);
    res.redirect("/pageNotFound");
  }
};

const placeOrder = async (req, res) => {
  try {
    const userId = req.session.user;

    const { addressId, paymentMethod , useWallet, coupon} = req.body;
    console.log("Coupon : ", coupon)

    const cart = await Cart.findOne({ userId }).populate("items.productId");

    if (!cart || cart.items.length === 0) {
      return res.json({ success: false, message: "Cart is empty" });
    }

    const addressData = await Address.findOne({ userId });
    if (!addressData) {
      return res.json({ success: false, message: "No address found" });
    }

    let selectedAddress;

    if (addressId) {
      selectedAddress = addressData.address.id(addressId);
    } else {
      selectedAddress = addressData.address.find((addr) => addr.isDefault);
    }

    if (!selectedAddress) {
      return res.json({ success: false, message: "Invalid address" });
    }

    const totalPrice = cart.items.reduce((sum, item) => {
      const price = item.productId.salePrice || item.productId.regularPrice;
      return sum + price * item.quantity;
    }, 0);

    let discount = 0;

    if(coupon?.code){
      const validCoupon = await Coupon.findOne({ code : coupon.code});

      if (
          validCoupon &&
          new Date() < validCoupon.expiry &&
          totalPrice >= validCoupon.minAmount 
        ) {
          discount = validCoupon.discount;
        }
    }

    const finalAmount = totalPrice - discount;

    console.log("Total price : ", totalPrice);
    console.log("Final amount : ", finalAmount)
    console.log("Discount : ", discount)


    for (let item of cart.items) {
      const product = await Product.findById(item.productId._id);

      const variant = product.variants.find((v) => v.size === item.variant);

      if (!product || !variant || variant.stock <= 0) {
        return res.json({
          success: false,
          message: `${product?.productName || "Product"} (${item.variant}) is out of stock`,
        });
      }

      if (item.quantity > variant.stock) {
        item.quantity = variant.stock;
        item.totalPrice = item.price * item.quantity;
      }

      const updated = await Product.findOneAndUpdate(
        {
          _id: item.productId._id,
          "variants.size": item.variant,
          // 'variants.stock' : { $gte : item.quantity}
        },
        {
          $inc: { "variants.$.stock": -item.quantity },
        },
      );

      if (!updated) {
        return res.json({
          success: false,
          message: `Stock changed for ${item.productId.productName}, try again`,
        });
      }
    }

    const { walletUsed, remainingAmount } = await calculateWalletUsage( userId, finalAmount, useWallet);

    //  wallet partially used but COD selected → block
    if (paymentMethod === "cod" && remainingAmount > 0 && walletUsed > 0) {
      return res.json({
        success: false,
        message: "Wallet + COD not allowed. Use Online payment."
      });
    }

    if( walletUsed > 0){
      await debitWallet(
        userId,
        walletUsed,
        "Wallet used",
         null
      )
    }

    const newOrder = new Order({
      couponCode: coupon?.code || null,
      userId: userId,
      paymentMethod: walletUsed === finalAmount ? "Wallet" : "COD",
      paymentStatus: walletUsed === finalAmount ? "Paid"  : "Pending",
      walletUsed,
      orderedItems: cart.items.map((item) => ({
        product: item.productId,
        variant: item.variant,
        quantity: item.quantity,
        price: item.productId.salePrice || item.productId.regularPrice,
        regularPrice: item.productId.regularPrice,
      })),

      totalPrice: totalPrice,
      finalAmount,
      status: "Pending",

      address: {
        addressType: selectedAddress.addressType,
        name: selectedAddress.name,
        city: selectedAddress.city,
        landMark: selectedAddress.landMark,
        state: selectedAddress.state,
        pincode: selectedAddress.pincode,
        phone: selectedAddress.phone,
        altPhone: selectedAddress.altPhone,
      },
    });

    await newOrder.save();
    //  Clear cart
    cart.items = [];
    await cart.save();

    res.json({
      success: true,
      orderId: newOrder._id,
    });
  } catch (error) {
    console.error("error placing order:", error);
    res.status(500).json({
      success: false,
      message: "Order failed",
    });
  }
};

const orderSuccess = async (req, res) => {
  try {
    const orderId = req.query.orderId;
    if (!orderId) {
      return res.redirect("/shop");
    }
    const order = await Order.findById(orderId).populate(
      "orderedItems.product",
    );
    if (!order) {
      return res.redirect("/shop");
    }
    return res.render("order-success", {
      orderId,
      orderedItems: order.orderedItems,
    });
  } catch (error) {
    console.error("Error loading order success:", error);
    res.redirect("/shop");
  }
};

const createRazorpayOrder = async (req, res) => {
  try {
    const { amount, useWallet, coupon } = req.body;

    const userId = req.session.user;

    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart || cart.items.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Cart is empty,  No more items " });
    }

     const totalPrice = cart.items.reduce((sum, item) => {
      const price = item.productId.salePrice || item.productId.regularPrice;
      return sum + price * item.quantity;
    }, 0)

    for (let item of cart.items) {
      if (!item.productId) {
        return res.json({
          success: false,
          message: "Some products are no longer available",
        });
      }

      const product = await Product.findById(item.productId);
      const variant = product.variants.find((v) => v.size === item.variant);

      console.log("stock : ", variant?.stock, "ordered : ", item.quantity);

      if (!variant || variant?.stock < item.quantity) {
        return res.status(500).json({
          success: false,
          message: "Selecetd quantity more thanavailable quantity",
        });
      }
    }

    let discount = 0;

    if(coupon?.code){
      const validCoupon = await Coupon.findOne({ code: coupon.code});

      if( validCoupon && 
        new Date < validCoupon.expiry &&
        totalPrice >= validCoupon.minAmount
      ){
        discount = validCoupon.discount;
      }
    }

    const finalAmount = totalPrice - discount;

    console.log("TOtal price : ", totalPrice)

    const { walletUsed, remainingAmount} = await calculateWalletUsage( userId, finalAmount, useWallet);

    console.log("Remaining amount : ",remainingAmount)

   if (remainingAmount === 0) {
      return res.json({
        success: true,
        walletOnly: true
      });
    }

    const options = {
      amount: remainingAmount * 100,
      currency: "INR",
      receipt: "receipt_" + Date.now(),
    };

    console.log("options : ", options)
    const order = await razorpay.orders.create(options);
    res.json({
      success: true,
      order,
    });
  } catch (error) {
    console.error("Razorpay order error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create Razorpay order",
    });
  }
};

const verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      addressId,
      useWallet,
      coupon
    } = req.body;

    console.log("reaching verify payment");

    const userId = req.session.user;

    // Step 1: Generate expected signature
    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    //  Compare signatures
    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Payment verification failed",
      });
    }

    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart || cart.items.length === 0) {
      return res.json({ success: false, message: "Cart is empty" });
    }

    const addressData = await Address.findOne({ userId });
    let selectedAddress;
    if (addressId) {
      selectedAddress = addressData.address.id(addressId);
    } else {
      selectedAddress = addressData.address.find((addr) => addr.isDefault);
    }
    if (!selectedAddress) {
      return res.json({ success: false, message: "Invalid address" });
    }

    const totalPrice = cart.items.reduce((sum, item) => {
      const price = item.productId.salePrice || item.productId.regularPrice;
      return sum + price * item.quantity;
    }, 0);

    let discount = 0;

    if (coupon?.code) {
      const validCoupon = await Coupon.findOne({ code: coupon.code });

      if (
        validCoupon &&
        new Date() < validCoupon.expiry &&
        totalPrice >= validCoupon.minAmount
      ) {
        discount = validCoupon.discount;
      }
    }

    const finalAmount = totalPrice - discount;

    const { walletUsed, remainingAmount } = await calculateWalletUsage(
        userId,
        finalAmount,
        useWallet
      );

    for (let item of cart.items) {
      if (!item.productId) {
        return res.json({
          success: false,
          message: "Some products are no longer available",
        });
      }

      const product = await Product.findById(item.productId);
      const variant = product.variants.find((v) => v.size === item.variant);

      console.log("stock : ", variant?.stock, "ordered : ", item.quantity);

      if (!variant || variant?.stock < item.quantity) {
        return res.status(500).json({
          success: false,
          message: "Selecetd quantity more thanavailable quantity",
        });
      }

      const updated = await Product.findOneAndUpdate(
        {
          _id: item.productId._id,
          "variants.size": item.variant,
          // 'variants.stock' : { $gte : item.quantity}
        },
        {
          $inc: { "variants.$.stock": -item.quantity },
        },
      );

      if (!updated) {
        return res.json({
          success: false,
          message: `Stock not changed for ${item.productId.productName}, try again`,
        });
      }
    }

    const newOrder = new Order({
      couponCode : coupon?.code || null,
      userId,
      paymentMethod: "Online",
      paymentStatus: "Paid",
      walletUsed,
      razorpayPaymentId: razorpay_payment_id,

      orderedItems: cart.items.map((item) => ({
        product: item.productId,
        variant: item.variant,
        quantity: item.quantity,
        price: item.productId.salePrice || item.productId.regularPrice,
        regularPrice: item.productId.regularPrice,
      })),

      totalPrice,
      finalAmount,
      status: "Pending",

      address: {
        addressType: selectedAddress.addressType,
        name: selectedAddress.name,
        city: selectedAddress.city,
        landMark: selectedAddress.landMark,
        state: selectedAddress.state,
        pincode: selectedAddress.pincode,
        phone: selectedAddress.phone,
        altPhone: selectedAddress.altPhone,
      },
    });

    await newOrder.save();

    
    if( walletUsed > 0){
      await debitWallet(
        userId,
        walletUsed,
        "Partial payment",
        null
      )
    }

    // clear cart
    cart.items = [];
    await cart.save();

    res.json({
      success: true,
      orderId: newOrder._id,
    });
  } catch (error) {
    console.error("verify payment error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

const checkCart = async (req, res) => {
  try {
    const userId = req.session.user;
    const cart = await Cart.findOne({ userId });
    if (!cart || cart.items.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Cart is empty,  No more items " });
    }
    return res.status(200).json({
      success: true,
    });
  } catch (error) {
    console.error("check cart error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

const applyCoupon = async (req, res) =>{
  try {
    
    const { code, totalAmount } = req.body;
    const coupon = await Coupon.findOne({ code });

    if (!coupon) {
      return res.json({ success: false, message: "Invalid coupon" });
    }

    if (new Date() > coupon.expiry) {
      return res.json({ success: false, message: "Coupon expired" });
    }

    if (totalAmount < coupon.minAmount ) {
      return res.json({ success: false, message: "Minimum amount not met" });
    }

    return res.json({
      success : true,
      discount: coupon.discount,
      message : 'Coupon applied succesfully'
    })

  } catch (error) {
    console.log("Error applying coupon : ",error);
    res.json({ success: false });
  }
}

module.exports = {
  loadCheckoutPage,
  placeOrder,
  deleteAddress,
  orderSuccess,
  createRazorpayOrder,
  verifyPayment,
  checkCart,
  applyCoupon
};
