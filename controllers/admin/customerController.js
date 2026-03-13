const User = require("../../models/userSchema")

const customerInfo = async( req, res) =>{
  try {

    let search = req.query.search?.trim() || "";
    let page = parseInt(req.query.page) || 1;
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
    .sort({createdOn : -1})
    .exec()

    const count = await User.find({
      isAdmin : false,
      $or : [
        {name : {$regex : ".*"+search+".*"}},
        {email :{$regex : ".*"+search+".*"}}
      ]
    }).countDocuments();

    const noUserFound = search !== "" && userData.length === 0;

    res.render("customers" , {
      data : userData, 
      totalPages : Math.ceil(count/limit),
      currentPage : Number(page),
      search : search,
      noUserFound
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