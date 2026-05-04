const Wallet = require("../../models/walletSchema");
const User = require("../../models/userSchema");
const Order = require("../../models/orderSchema");

const loadWallet = async (req, res) =>{
  try {
    const userId = req.session.user;
    const wallet = await Wallet.findOne({ userId })
    const order = await Order.findOne({ userId })
    console.log("Wallet :", wallet )

    res.render("wallet", {
      wallet,
      order
    })
  } catch (error) {
    console.log("Error loading wallet page: ", error);
    return res.status(500).json({
      success : false,
      message : 'Error loading wallet page'
    })
  }
}

module.exports = {
  loadWallet
}