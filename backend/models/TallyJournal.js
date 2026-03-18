import mongoose from "mongoose";

const TallyJournalSchema = new mongoose.Schema(
  {
    group: {
      type: String,
      required: true,
      trim: true,
      description: "Name of the journal group (e.g., Indirect Expenses)",
    },
    journalName: {
      type: String,
      required: true,
      trim: true,
      description: "Name of the ledger account",
    },
    address: {
      type: String,
      trim: true,
      default: "",
    },
    state: {
      type: String,
      trim: true,
      default: "",
    },
    registrationType: {
      type: String,
      trim: true,
      default: "",
    },
    gstin: {
      type: String,
      trim: true,
      default: "",
    },
    credit: {
      type: Number,
      default: 0,
      description: "Credit Opening Balance",
    },
    debit: {
      type: Number,
      default: 0,
      description: "Debit Opening Balance",
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BranchUser",
    },
  },
  { timestamps: true }
);

// Journal names must be unique per branch
TallyJournalSchema.index({ journalName: 1, branch: 1 }, { unique: true });

const TallyJournal = mongoose.model("TallyJournal", TallyJournalSchema);
export default TallyJournal;
