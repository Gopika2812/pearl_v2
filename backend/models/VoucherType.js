import mongoose from "mongoose";

const voucherTypeSchema = new mongoose.Schema(
  {
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },

    name: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    orderType: {
      type: String,
      required: true,
      enum: ["SO", "PO", "PI", "SI", "DN", "PM", "EXP"],
    },

    prefix: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      validate: {
        validator: function(v) {
          // Max Prefix length = 16 - 1 (slash) - 3 (padded counter) - 1 (slash) - 5 (FY: 25-26) = 6 chars
          return v.length <= 6;
        },
        message: props => `Prefix "${props.value}" is too long (${props.value.length} chars). Max 6 characters allowed to keep the total Invoice Number within 16 chars.`
      }
    },

    counter: { type: Number, default: 1 },

    financialYear: { type: String, required: true },
  },
  { timestamps: true }
);

// Create composite unique index: branchId + name + orderType (ONLY allows duplicates across branches)
voucherTypeSchema.index({ branchId: 1, name: 1, orderType: 1 }, { unique: true });

const VoucherType = mongoose.model("VoucherType", voucherTypeSchema);
export default VoucherType;
