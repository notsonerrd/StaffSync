const mongoose = require("mongoose");
const AnnouncementSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  title: { type: String, required: true },
  content: { type: String, required: true },
}, { timestamps: true });
module.exports = mongoose.model("Announcement", AnnouncementSchema);
