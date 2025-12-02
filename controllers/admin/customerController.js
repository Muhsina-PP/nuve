const User = require("../../models/userSchema")

const customerInfo = async( req, res) =>{
  try {
    let search = "";
    if(req.query.search){
      search = req.query.search;
    }
    let page = 1;
    if(req.query.page){
      page = req.query.page;
    }
    const limit = 5;
    
    const userData = await User.find({
      isAdmin : false,
      $or : [
        {name : {$regex : ".*"+search+".*"}},
        {email :{$regex : ".*"+search+".*"}}
      ]
    })
    .limit(limit*1)
    .skip((page-1)*limit)
    .exec()

    const count = await User.find({
      isAdmin : false,
      $or : [
        {name : {$regex : ".*"+search+".*"}},
        {email :{$regex : ".*"+search+".*"}}
      ]
    }).countDocuments();

    res.render("customers" , {
      data : userData, 
      totalPages : Math.ceil(count/limit),
      currentPage : Number(page),
      search : search
    })

  } catch (error) {
    console.log("Error loading cusyomer info : ", error);
    res.redirect("/admin/pageNotFound")   
  }
}

const blockCustomer  = async (req,res) =>{
  try {
    let id = req.query.id;
    await User.updateOne({_id : id},{$set :{isBlocked : true}})
    return res.redirect("/admin/users")
  } catch (error) {
    console.error("Error blocking customer : ",error);
    res.redirect("/admin/pageNotFound")   
  }
}


const unblockCustomer = async (req,res) =>{
  try {
    let id = req.query.id;
    await User.updateOne({_id : id},{$set : {isBlocked : false}})
    return res.redirect("/admin/users")
  } catch (error) {
    console.error("Error blocking customer : ",error);
    res.redirect("/admin/pageNotFound")   
  }
}


module.exports = {
  customerInfo,
  blockCustomer,
  unblockCustomer
}