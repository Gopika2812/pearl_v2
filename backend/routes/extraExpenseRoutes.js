import express from "express";
import ExtraExpense from "../models/ExtraExpense.js";
import VoucherType from "../models/VoucherType.js";

const router = express.Router();

// Helper function to get current financial year
const getCurrentFinancialYear = () => {
  const today = new Date();
  const month = today.getMonth() + 1; // JavaScript months are 0-11
  const year = today.getFullYear();

  // Financial year starts in April - format: 25-26 (short format)
  if (month >= 4) {
    const shortYear = String(year).slice(-2);
    const shortNextYear = String(year + 1).slice(-2);
    return `${shortYear}-${shortNextYear}`;
  } else {
    const shortYear = String(year - 1).slice(-2);
    const shortCurrentYear = String(year).slice(-2);
    return `${shortYear}-${shortCurrentYear}`;
  }
};

// Generate next expense ID
const generateExpenseId = async (branchId) => {
  const currentFY = getCurrentFinancialYear();
  const voucherPrefix = "EXP";
  const order_type = "EXP";
  const name = "expense";

  try {
    // Get or create voucher type for expenses
    let voucher = await VoucherType.findOne({
      branchId,
      prefix: voucherPrefix,
      orderType: order_type,
    });

    if (!voucher) {
      console.log("🆕 Creating new VoucherType for expenses");
      voucher = new VoucherType({
        branchId,
        name,
        orderType: order_type,
        prefix: voucherPrefix,
        counter: 0,
        financialYear: currentFY,
      });
      await voucher.save();
      console.log("✅ VoucherType created:", voucher);
    }

    // Increment counter
    voucher.counter += 1;
    voucher.financialYear = currentFY;
    await voucher.save();
    console.log("📈 Counter incremented to:", voucher.counter);

    // Format: PREFIX/COUNTER/FY
    const expenseId = `${voucher.prefix}/${String(voucher.counter).padStart(3, "0")}/${currentFY}`;
    return expenseId;
  } catch (error) {
    console.error("❌ Error generating expense ID:", error.message);
    throw error;
  }
};

// Create new extra expense
router.post("/", async (req, res) => {
  try {
    const {
      branchId,
      expenses,
      totalAmount,
      description,
      recordedBy,
    } = req.body;

    console.log("📊 Extra Expense POST Request:", { branchId, expenses, totalAmount });

    if (!branchId || !expenses || expenses.length === 0) {
      console.warn("⚠️ Missing required fields");
      return res.status(400).json({
        success: false,
        message: "Branch ID and at least one expense is required",
      });
    }

    // Validate expenses array
    const validExpenses = expenses.map((exp) => {
      if (!exp.name || typeof exp.price !== "number" || exp.price <= 0) {
        throw new Error("Each expense must have a valid name and price");
      }
      return {
        name: exp.name.trim(),
        price: parseFloat(exp.price),
      };
    });

    // Validate total amount
    const calculatedTotal = validExpenses.reduce((sum, exp) => sum + exp.price, 0);
    if (Math.abs(calculatedTotal - totalAmount) > 0.01) {
      console.warn("⚠️ Total amount mismatch:", { calculatedTotal, totalAmount });
      return res.status(400).json({
        success: false,
        message: "Total amount does not match sum of expenses",
      });
    }

    // Generate expense ID
    let expenseId;
    try {
      expenseId = await generateExpenseId(branchId);
      console.log("✅ Generated expense ID:", expenseId);
    } catch (idError) {
      console.error("❌ Error generating expense ID:", idError);
      return res.status(500).json({
        success: false,
        message: "Failed to generate expense ID",
        error: idError.message,
      });
    }

    const newExpense = new ExtraExpense({
      branchId,
      expenseId,
      expenses: validExpenses,
      totalAmount: calculatedTotal,
      description: description || "Extra Expenses Order",
      recordedBy,
      status: "recorded",
      date: new Date(),
    });

    console.log("💾 Saving expense:", newExpense);
    await newExpense.save();
    console.log("✅ Expense saved successfully");

    res.status(201).json({
      success: true,
      message: "Extra expense recorded successfully",
      data: newExpense,
    });
  } catch (error) {
    console.error("❌ Error creating extra expense:", error);
    res.status(500).json({
      success: false,
      message: "Error creating extra expense",
      error: error.message,
    });
  }
});

// Get all extra expenses for a branch
router.get("/branch/:branchId", async (req, res) => {
  try {
    const { branchId } = req.params;

    const expenses = await ExtraExpense.find({ branchId })
      .sort({ date: -1 })
      .limit(50);

    res.status(200).json({
      success: true,
      data: expenses,
    });
  } catch (error) {
    console.error("Error fetching extra expenses:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching extra expenses",
      error: error.message,
    });
  }
});

// Get single extra expense by ID
router.get("/:expenseId", async (req, res) => {
  try {
    const expense = await ExtraExpense.findById(req.params.expenseId);

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Extra expense not found",
      });
    }

    res.status(200).json({
      success: true,
      data: expense,
    });
  } catch (error) {
    console.error("Error fetching extra expense:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching extra expense",
      error: error.message,
    });
  }
});

// Update extra expense status
router.patch("/:expenseId", async (req, res) => {
  try {
    const { expenseId } = req.params;
    const { status } = req.body;

    if (!["recorded", "approved", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    const updatedExpense = await ExtraExpense.findByIdAndUpdate(
      expenseId,
      { status },
      { new: true }
    );

    if (!updatedExpense) {
      return res.status(404).json({
        success: false,
        message: "Extra expense not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Extra expense updated successfully",
      data: updatedExpense,
    });
  } catch (error) {
    console.error("Error updating extra expense:", error);
    res.status(500).json({
      success: false,
      message: "Error updating extra expense",
      error: error.message,
    });
  }
});

// Delete extra expense
router.delete("/:expenseId", async (req, res) => {
  try {
    const deletedExpense = await ExtraExpense.findByIdAndDelete(
      req.params.expenseId
    );

    if (!deletedExpense) {
      return res.status(404).json({
        success: false,
        message: "Extra expense not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Extra expense deleted successfully",
      data: deletedExpense,
    });
  } catch (error) {
    console.error("Error deleting extra expense:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting extra expense",
      error: error.message,
    });
  }
});

export default router;
