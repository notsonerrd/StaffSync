const mongoose = require("mongoose");
const TrainingSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, default: "" },
  trainer: { type: String, default: "TBA" },
  team: { type: String, default: "All Teams" },
  mode: { type: String, enum: ["Online", "Offline", "Hybrid"], default: "Online" },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  enrolled: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });
module.exports = mongoose.model("Training", TrainingSchema);
