const express = require('express')
const router = express.Router()
const adminController = require("../controllers/admin/adminController")
const customerController = require("../controllers/admin/customerController")
const categoryController = require("../controllers/admin/categoryController")
const brandController = require("../controllers/admin/brandController")
const productController = require("../controllers/admin/productController")
const bannerController = require("../controllers/admin/bannerController")
const orderController = require("../controllers/admin/orderController")
const coupenController = require("../controllers/admin/coupenController")
const offerController = require("../controllers/admin/offerController")
const salesController =  require("../controllers/admin/salesController")
const {userAuth , adminAuth} = require("../middlewares/auth");
const { route } = require('./userRoutes');
const multer = require("multer")
const storage = require("../helpers/multer")
// const upload = multer({storage : storage})
const upload = require("../helpers/multer")


router.get("/pageNotFound", adminController.pageNotFound);

router.get("/login", adminController.loadLogin)
router.post("/login", adminController.login)
router.get("/logout", adminController.logout)


// dashboard management
router.get("/dashboard", adminAuth, adminController.loadDashboard);
router.get("/sales-chart", adminAuth, adminController.getSalesChart);
router.get("/ledger-book", adminAuth, adminController.getLedgerBook)



// customer management
router.get("/users", adminAuth, customerController.customerInfo)
router.get("/blockCustomer", adminAuth, customerController.blockCustomer)
router.get("/unblockCustomer", adminAuth, customerController.unblockCustomer)

// category management
router.get("/category", adminAuth, categoryController.categoryInfo)
router.post("/addCategory", adminAuth, categoryController.addCategory)
router.post("/addCategoryOffer", adminAuth, categoryController.addCategoryOffer)
router.post("/removeCategoryOffer", adminAuth, categoryController.removeCategoryOffer)
router.get("/listCategory", adminAuth, categoryController.listCategory)
router.get("/unlistCategory", adminAuth, categoryController.unlistCategory)
router.get("/editCategory/:id", adminAuth, categoryController.getEditCategory)
router.post("/editCategory/:id", adminAuth, categoryController.editCategory)

// Brand management
router.get("/brands", adminAuth, brandController.getBrandPage)
router.post("/addBrand", adminAuth, upload.single("image"), brandController.addBrand)
router.get("/blockBrand", adminAuth, brandController.blockBrand);
router.get("/unblockBrand/:id", adminAuth, brandController.unblockBrand);
router.get("/deleteBrand", adminAuth, brandController.deleteBrand)

// Product management
router.get("/products", adminAuth, productController.productInfo)
router.get("/addProducts", adminAuth, productController.getAddProductPage)
router.post("/addProducts", adminAuth, upload.array("images", 4) ,productController.addProducts)
router.post("/addProductOffer", adminAuth, productController.addProductOffer)
router.post("/removeProductOffer", adminAuth, productController.removeProductOffer)
router.get("/blockProduct", adminAuth, productController.blockProduct)
router.get("/unblockProduct", adminAuth, productController.unblockProduct)
router.get("/editProduct", adminAuth, productController.getEditProductPage)
router.post("/editProduct/:id", adminAuth, upload.array("images", 4) ,productController.editProduct)

// Banner management
router.get("/banner", adminAuth, bannerController.getBannerPage)
router.get("/addBanner", adminAuth, bannerController.getAddBannerPage)
router.post("/addBanner", adminAuth, upload.single("image"), bannerController.addBanner)
router.get("/deleteBanner", adminAuth, bannerController.deleteBanner)


// Order management
router.get("/orders", adminAuth,orderController.loadOrders )
router.patch("/update-order-status/:orderId", adminAuth, orderController.updateOrderStatus);
router.get("/order-details/:orderId", adminAuth, orderController.loadOrderDetails);
router.get("/download-invoice/:id", adminAuth, orderController.downloadInvoice);
router.post("/verifyReturn", adminAuth, orderController.verifyReturn)


// Coupen management
router.get("/coupon", adminAuth, coupenController.loadCoupen);
router.post("/create-coupon", adminAuth, coupenController.createCoupen);
router.delete("/delete-coupon/:id", adminAuth, coupenController.deleteCoupon);
router.get("/edit-coupon/:id", adminAuth, coupenController.editCouponForm);
router.post("/edit-coupon/:id", adminAuth, coupenController.updateCoupon);

// Offer management
router.get("/offers", adminAuth, offerController.loadOffers);
router.post("/create-offer", adminAuth, offerController.createOffer);
router.patch("/toggle-offer/:id", adminAuth, offerController.toggleOffer);
router.delete("/delete-offer/:id", adminAuth, offerController.deleteOffer);
router.get("/active-offers", adminAuth, offerController.getActiveOffers);


// Sales report management
router.get("/sales-report", adminAuth, salesController.getSalesReport)

module.exports = router