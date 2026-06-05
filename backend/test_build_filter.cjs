const mongoose = require('mongoose');

const customerGroupId = "none";
const customerCategoryId = "";
const riskStatus = "";
const search = "";
const branchId = "69cb755611501727ed6ec9cb";

const andConditions = [{ branchId: new mongoose.Types.ObjectId(branchId) }];

const isFilterSet = (val) => val && val !== "All" && val !== "null" && val !== "undefined" && val !== "";

if (isFilterSet(customerGroupId)) {
  if (customerGroupId === "none") {
    andConditions.push({
      $or: [
        { customerGroups: { $size: 0 } },
        { customerGroups: { $exists: false } },
        { customerGroups: null },
        { customerGroup: null },
        { customerGroup: { $exists: false } }
      ]
    });
  } else {
    try {
      const gId = new mongoose.Types.ObjectId(customerGroupId);
      andConditions.push({
        $or: [
          { customerGroups: gId },
          { customerGroup: gId }
        ]
      });
    } catch (e) {
      console.error("Invalid Group ID in filter:", customerGroupId);
    }
  }
}

if (isFilterSet(customerCategoryId)) {
  if (customerCategoryId === "none") {
    andConditions.push({
      $or: [
        { customerCategories: { $size: 0 } },
        { customerCategories: { $exists: false } },
        { customerCategories: null },
        { customerCategory: null },
        { customerCategory: { $exists: false } }
      ]
    });
  } else {
    try {
      const cId = new mongoose.Types.ObjectId(customerCategoryId);
      andConditions.push({
        $or: [
          { customerCategories: cId },
          { customerCategory: cId }
        ]
      });
    } catch (e) {
      console.error("Invalid Category ID in filter:", customerCategoryId);
    }
  }
}

const filter = andConditions.length > 1 ? { $and: andConditions } : andConditions[0];

console.log(JSON.stringify(filter, null, 2));
