require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const users = mongoose.connection.collection("users");
  const list = [
    { name: "Sana", email: "sana@staffsync.io", password: "admin123", role: "admin", department: "HR" },
    { name: "Rahul", email: "rahul@staffsync.io", password: "emp12345", role: "employee", department: "Engineering" },
  ];
  for (const u of list) {
    await users.deleteOne({ email: u.email });
    await users.insertOne({ ...u, password: await bcrypt.hash(u.password, 10), position: "Employee" });
  }
  console.log("Fake users created!");
  process.exit(0);
})();
