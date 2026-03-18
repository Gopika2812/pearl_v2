import mongoose from "mongoose";

const TallyJournalGroupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
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

// Group names must be unique per branch
TallyJournalGroupSchema.index({ name: 1, branch: 1 }, { unique: true });

const TallyJournalGroup = mongoose.model("TallyJournalGroup", TallyJournalGroupSchema);
export default TallyJournalGroup;
