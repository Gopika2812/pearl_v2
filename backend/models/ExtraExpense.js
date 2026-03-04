import mongoose from "mongoose";

const ExpenseItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
});

const ExtraExpenseSchema = new mongoose.Schema(
  {
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
      index: true,
    },
    expenseId: {
      type: String,
      required: true,
    },
    expenses: [ExpenseItemSchema],
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    description: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["recorded", "approved", "rejected"],
      default: "recorded",
    },
    recordedBy: {
      type: String,
      trim: true,
    },
    date: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

// Compound unique index for branchId and expenseId per financial year
ExtraExpenseSchema.index({ branchId: 1, expenseId: 1 }, { unique: true });
ExtraExpenseSchema.index({ branchId: 1, date: -1 });

export default mongoose.model("ExtraExpense", ExtraExpenseSchema);
