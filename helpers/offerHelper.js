function applyBestOffer(product, categoryOffer = 0) {
  const productOffer = product.productOffer || 0;
  const bestOffer = Math.max(productOffer, categoryOffer);

  if (bestOffer > 0) {
    product.salePrice = Math.floor(
      product.regularPrice - (product.regularPrice * bestOffer) / 100
    );
  } else {
    product.salePrice = product.regularPrice;
  }

  return product;
}


module.exports = {applyBestOffer}