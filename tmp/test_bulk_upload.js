const testCases = [
  {
    name: "Standard Update with Prices",
    row: { name: "Product A", purchasingprice: "100", sellingprice: "120" },
    expected: { purchasingPrice: 100, sellingPrice: 120, margin: 20, marginPercentage: 20 }
  },
  {
    name: "Update with Margin Percentage",
    row: { name: "Product B", purchasingprice: "100", marginpercentage: "15" },
    expected: { purchasingPrice: 100, sellingPrice: 115, margin: 15, marginPercentage: 15 }
  },
  {
    name: "Update with Back-calculation",
    row: { name: "Product C", sellingprice: "230", marginpercentage: "15" },
    expected: { purchasingPrice: 200, sellingPrice: 230, margin: 30, marginPercentage: 15 }
  }
];

function processRow(normalizedRow) {
  let productData = {};
  
  if (normalizedRow.purchasingprice !== undefined) {
    let pPrice = parseFloat(normalizedRow.purchasingprice.toString().replace(/[^\d.-]/g, ''));
    if (!isNaN(pPrice)) productData.purchasingPrice = Math.round(pPrice * 100) / 100;
  }

  if (normalizedRow.sellingprice !== undefined) {
    let sPrice = parseFloat(normalizedRow.sellingprice.toString().replace(/[^\d.-]/g, ''));
    if (!isNaN(sPrice)) productData.sellingPrice = Math.round(sPrice * 100) / 100;
  }

  const mRaw = normalizedRow.marginpercentage || normalizedRow.margin || normalizedRow['margin%'] || normalizedRow.marginpercent;
  if (mRaw !== undefined) {
    let marginPercent = parseFloat(mRaw.toString().replace(/[^\d.-]/g, ''));
    if (!isNaN(marginPercent)) productData.marginPercentage = Math.round(marginPercent * 100) / 100;
  }

  if (productData.purchasingPrice !== undefined && productData.sellingPrice !== undefined) {
    productData.margin = Math.round((productData.sellingPrice - productData.purchasingPrice) * 100) / 100;
    if (productData.purchasingPrice > 0) {
      productData.marginPercentage = Math.round((productData.margin / productData.purchasingPrice) * 100 * 100) / 100;
    }
  } else if (productData.purchasingPrice !== undefined && productData.marginPercentage !== undefined) {
    productData.margin = Math.round((productData.purchasingPrice * productData.marginPercentage / 100) * 100) / 100;
    productData.sellingPrice = Math.round((productData.purchasingPrice + productData.margin) * 100) / 100;
  } else if (productData.sellingPrice !== undefined && productData.marginPercentage !== undefined) {
    productData.purchasingPrice = Math.round((productData.sellingPrice / (1 + productData.marginPercentage / 100)) * 100) / 100;
    productData.margin = Math.round((productData.sellingPrice - productData.purchasingPrice) * 100) / 100;
  }

  return productData;
}

testCases.forEach(tc => {
  const result = processRow(tc.row);
  console.log(`Test: ${tc.name}`);
  console.log(`Result:`, JSON.stringify(result, null, 2));
  const success = JSON.stringify(result) === JSON.stringify(tc.expected);
  console.log(`Success: ${success}`);
  if (!success) {
    console.log(`Expected:`, JSON.stringify(tc.expected, null, 2));
  }
  console.log('---');
});
