const Offer = require("../../models/offerSchema");

const loadOffers = async (req, res) => {
  try {
    const offers = await Offer.find().sort({ createdAt: -1 });
    res.render("offer", {
      title: "Offer Management",
      offers: offers
    });
  } catch (error) {
    console.error("Error loading offers page:", error);
    res.status(500).send("Error loading offers page");
  }
};

const createOffer = async (req, res) => {
  try {
    const { name, type, discount, expiry, isActive } = req.body;

    const existing = await Offer.findOne({ name: { $regex: new RegExp("^" + name + "$", "i") } });
    if (existing) {
      return res.json({ success: false, message: "Offer name already exists" });
    }

    await Offer.create({
      name,
      type,
      discount,
      expiry,
      isActive
    });

    return res.status(200).json({
      success: true,
      message: "Offer created successfully"
    });

  } catch (error) {
    console.error("Error creating offer:", error);
    res.json({ success: false, message: "Error creating offer" });
  }
};

const deleteOffer = async (req, res) => {
  try {
    const offerId = req.params.id;
    await Offer.findByIdAndDelete(offerId);
    return res.status(200).json({
      success: true,
      message: "Offer deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting offer:", error);
    res.status(500).json({ success: false, message: "Error deleting offer" });
  }
};

const toggleOffer = async (req, res) => {
  try {
    const offerId = req.params.id;
    const offer = await Offer.findById(offerId);
    if (!offer) {
      return res.status(404).json({ success: false, message: "Offer not found" });
    }
    offer.isActive = !offer.isActive;
    await offer.save();

    return res.json({ success: true, message: `Offer ${offer.isActive ? 'activated' : 'deactivated'} successfully` });
  } catch (error) {
    console.error("Error toggling offer:", error);
    res.status(500).json({ success: false, message: "Error updating offer status" });
  }
};

const getActiveOffers = async (req, res) => {
  try {
    const type = req.query.type; // 'product' or 'category'
    const query = { isActive: true, expiry: { $gte: new Date() } };
    
    if (type) {
      query.type = type;
    }

    const offers = await Offer.find(query).sort({ createdAt: -1 });
    return res.json({ success: true, offers });
  } catch (error) {
    console.error("Error fetching active offers:", error);
    res.status(500).json({ success: false, message: "Error fetching offers" });
  }
};

module.exports = {
  loadOffers,
  createOffer,
  deleteOffer,
  toggleOffer,
  getActiveOffers
};
