const mongoose = require("mongoose");
const LeaveSchema = new mongoose.Schema({
  applicant: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  type: { type: String, enum: ["Casual", "Sick", "Annual", "Unpaid"], default: "Casual" },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  reason: { type: String, required: true },
  status: { type: String, enum: ["Pending", "Approved", "Rejected"], default: "Pending" },
}, { timestamps: true });
module.exports = mongoose.model("Leave", LeaveSchema);
