const Wallet = require("../models/walletSchema");

const creditWallet = async( userId, amount, reason, orderId)=>{
  return await Wallet.findOneAndUpdate(
    { userId },
    { 
      $inc : { balance : amount },
      $push : {
        transactions : {
          amount, 
          type : 'credit',
          reason,
          orderId
        }
      }
    },
    { upsert : true, new : true}
  )
}


const debitWallet = async( userId, amount, reason, orderId) =>{

  const wallet = await Wallet.findOne({ userId});
  
  if(!wallet || wallet.balance < amount){
        throw new Error("Insufficient wallet balance");
  }

  wallet.balance = wallet.balance - amount;

  wallet.transactions.push({
    amount,
    type : 'debit',
    reason,
    orderId
  })

  await wallet.save();
  return wallet;

}


const calculateWalletUsage = async( userId, amount, useWallet) =>{


  let walletUsed = 0;
  let remainingAmount = amount;

  if(useWallet){
    const wallet = await Wallet.findOne({ userId });
    const balance = wallet?.balance || 0;

    console.log("Wallet : ",wallet);
    console.log("Balance : ",balance)

    if(balance > 0){
      walletUsed = Math.min(balance, amount);
      remainingAmount = amount - walletUsed;
    }
    console.log("Total : ", amount);
    console.log("Remaining amount : ", remainingAmount)
  }

  return { walletUsed, remainingAmount }

}

module.exports = {
  creditWallet,
  debitWallet,
  calculateWalletUsage
}