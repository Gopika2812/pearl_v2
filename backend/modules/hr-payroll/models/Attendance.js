import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BranchUser",
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["Present", "Absent", "Leave"],
      default: "Present",
    },
    overtimeHours: {
      type: Number,
      default: 0,
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },
    presentTime: {
      type: Date,
    },
    leaveTime: {
      type: Date,
    },
    presentLocation: {
      lat: Number,
      lng: Number,
      address: String,
    },
    leaveLocation: {
      lat: Number,
      lng: Number,
      address: String,
    },
    workingHours: {
      type: Number,
      default: 0,
    },
    comment: {
      type: String,
    },
  },
  { timestamps: true }
);

// Unique attendance per employee per day
attendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true });

const Attendance = mongoose.model("Attendance", attendanceSchema);
export default Attendance;
