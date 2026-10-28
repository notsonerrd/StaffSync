const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["admin", "hr", "manager", "employee"],
      default: "employee",
      lowercase: true,
    },
    department: { type: String, default: "General" },
    position: { type: String, default: "Employee" },
    phone: String,
    address: String,
    emergency: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);