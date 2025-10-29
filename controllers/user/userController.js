const loadHomepage = (req,res) =>{
  try {
    res.render('home')
  } catch (error) {
    console.log(`Error loading home page : `, error);
    res.status(500).send('Error loading home page')
    
  }
}

const pageNotFound = async (req,res) =>{
  try {
    res.render("page-404")
  } catch (error) {
    res.redirect("/pageNotFound")
    console.log("Error getting page-404 : ",error)
  }
}


module.exports = {
  loadHomepage,
  pageNotFound
}