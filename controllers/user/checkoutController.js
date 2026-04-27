const User = require("../../models/userSchema");
const Cart = require("../../models/cartSchema");
const Address = require("../../models/addressSchema");
const Order = require("../../models/orderSchema");
const Product = require("../../models/productSchema")

const deleteAddress = async (req, res) =>{
  try {
    const {addressId} = req.body;
    const userId = req.session.user;
    const addressData = await Address.findOne({userId : userId})
    if(!addressData){
        return res.json({ success: false });   
    }
    addressData.address.pull({_id : addressId})
    await addressData.save();
    res.json({ success: true }); 
  }
   catch (error) {
    console.log("Error deleting address:", error)
    res.status(500).json({
      success: false,
      message: "Error deleting address"
    })
  }
}

const loadCheckoutPage = async(req,res) =>{
  try {
    const userId = req.session.user;
    const cart = await Cart.findOne({userId}).populate('items.productId');
    const addresses = await Address.findOne({ userId })
    if(!cart || cart.items.length === 0){
      return res.redirect("/cart")
    }
    const validItems = [];
    const invalidItems = [];

    for(let item of cart.items){
      const product = item.productId;

      const variant = product.variants.find(
        v => v.size === item.variant
      )
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
    await cart.save();

    res.render("checkout",{
      cartItems : validItems,
      addresses : addresses ? addresses.address : []
    })
  } catch (error) {
    console.error("error loading checkout page : ",error);
    res.redirect("/pageNotFound");
  }
}

const placeOrder = async (req, res) =>{
  try {
    const userId = req.session.user;
    const { addressId, paymentMethod} = req.body;
    const cart = await Cart.findOne({userId}).populate('items.productId');

    if (!cart || cart.items.length === 0) {
      return res.json({ success: false, message: "Cart is empty" });
    }

    const addressData = await Address.findOne({ userId });
    if (!addressData) {
      return res.json({ success: false, message: "No address found" });
    }
    const selectedAddress = addressData.address.id(addressId);
    console.log("selected address  : ", selectedAddress )
     if (!selectedAddress) {
      return res.json({ success: false, message: "Invalid address" });
    }

    const totalPrice = cart.items.reduce((sum, item) => {
      const price = item.productId.salePrice || item.productId.regularPrice;
      return sum + (price * item.quantity);
    }, 0);

    for (let item of cart.items) {
      const product = item.productId;

      const variant = product.variants.find(
        v => v.size === item.variant
      )
      
      if (!product || !variant || variant.stock <= 0) {
        return res.json({
          success: false,
          message: `${product?.productName || "Product"} (${item.variant}) is out of stock`
        });
      }

      if (item.quantity > variant.stock) {
        item.quantity = variant.stock;
        item.totalPrice = item.price * item.quantity;
      }
    }

    for (let item of cart.items) {
      if (!item.productId) {
        return res.json({
          success: false,
          message: "Some products are no longer available"
        });
      }

      const updated = await Product.findOneAndUpdate(
        {
          _id: item.productId,
          'variants.size' : item.variant,
          'variants.stock' : { $gte : item.quantity}
        },
        {
          $inc: { 'variants.$.stock': -item.quantity }
        }
      );

      if (!updated) {
        return res.json({
          success: false,
          message: `Stock changed for ${item.productId.productName}, try again`
        });
      }
    }
    

    const newOrder = new Order({
      orderedItems : cart.items.map( item =>({
        product : item.productId,
        variant: item.variant, 
        quantity : item.quantity,
        price: item.productId.salePrice || item.productId.regularPrice,
        regularPrice: item.productId.regularPrice
      })),

      totalPrice : totalPrice,
      finalAmount : totalPrice,
      status : 'Pending',

      address: {
        addressType: selectedAddress.addressType,
        name: selectedAddress.name,
        city: selectedAddress.city,
        landMark: selectedAddress.landMark,
        state: selectedAddress.state,
        pincode: selectedAddress.pincode,
        phone: selectedAddress.phone,
        altPhone: selectedAddress.altPhone
      }
    })
    await newOrder.save();
    //  Clear cart
    cart.items = [];
    await cart.save();

    res.json({
      success: true,
      orderId: newOrder._id
    });

  } catch (error) {
    console.error("error placing order:", error);
    res.status(500).json({
      success: false,
      message: "Order failed"
    });
  }
}

const orderSuccess = async (req, res) =>{
  try {
    const orderId = req.query.orderId;
    if(!orderId){
      return res.redirect("/shop")
    }
    const order = await Order.findById(orderId).populate('orderedItems.product');
    if(!order){
      return res.redirect("/shop")
    }
    return res.render("order-success", {
      orderId,
      orderedItems : order.orderedItems
    })
  } catch (error) {
    console.error("Error loading order success:", error);
    res.redirect('/shop');
  }
}


module.exports = {
  loadCheckoutPage,
  placeOrder,
  deleteAddress,
  orderSuccess
}