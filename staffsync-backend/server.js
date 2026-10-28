require("dotenv").config();
const crypto = require("crypto");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("./models/User");
const Leave = require("./models/Leave");
const Announcement = require("./models/Announcement");

const JWT_SECRET = process.env.JWT_SECRET;
const MONGO_URI = process.env.MONGO_URI;
const IS_PROD = process.env.NODE_ENV === "production";
if (!JWT_SECRET || !MONGO_URI) {
  console.error("JWT_SECRET and MONGO_URI must be set in environment variables.");
  process.exit(1);
}

const app = express();
app.set("trust proxy", 1); // Needed so rate limiting sees the real client IP behind Render/Heroku proxies
app.use(helmet());

// FRONTEND_URL = "https://your-frontend.com,http://localhost:3000" (comma separated)
const allowed = (process.env.FRONTEND_URL || "").split(",").map((s) => s.trim()).filter(Boolean);
if (!allowed.length) console.warn("FRONTEND_URL not set: CORS is open to all origins.");
app.use(cors(allowed.length ? { origin: allowed } : {}));
app.use(express.json({ limit: "10kb" }));

mongoose
  .connect(MONGO_URI)
  .then(() => console.log("MongoDB Connected Successfully!"))
  .catch((err) => console.error("MongoDB Error:", err.message));

// ---------- Helpers ----------
const ROLES = ["admin", "hr", "manager", "employee"];
const isAdminRole = (role) => ["admin", "hr"].includes(String(role || "").toLowerCase());
const isEmail = (s) => typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const validId = (id) => mongoose.isValidObjectId(id);
const isValidDate = (d) => !Number.isNaN(new Date(d).getTime());

// In production, internal error details are not sent to the client
const fail = (res, err, status = 500) => {
  if (err && err.code === 11000) return res.status(400).json({ message: "Email already exists" });
  if (status === 500) console.error(err);
  const message = status === 500 && IS_PROD ? "Something went wrong" : err.message || String(err);
  res.status(status).json({ message });
};

// ---------- Middleware ----------
const auth = (req, res, next) => {
  const h = req.headers.authorization || "";
  const t = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!t) return res.status(401).json({ message: "Not logged in" });
  try {
    req.user = jwt.verify(t, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: "Session expired, login again" });
  }
};

const adminOnly = (req, res, next) =>
  isAdminRole(req.user.role) ? next() : res.status(403).json({ message: "Admins only" });

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts, try again in 15 minutes" },
});

// ---------- Health ----------
app.get("/", (req, res) => res.json({ status: "ok", service: "StaffSync API" }));

// ---------- Auth ----------
app.post("/api/auth/login", loginLimiter, async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    if (!email || !password) return res.status(400).json({ message: "Email and password required" });

    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: "1d" });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    fail(res, err);
  }
});

app.put("/api/auth/password", auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (typeof newPassword !== "string" || newPassword.length < 8)
      return res.status(400).json({ message: "New password must be at least 8 characters" });

    const user = await User.findById(req.user.id);
    if (!user || !(await bcrypt.compare(String(currentPassword || ""), user.password)))
      return res.status(400).json({ message: "Current password is incorrect" });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ success: true });
  } catch (err) {
    fail(res, err);
  }
});

app.get("/api/profile", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    fail(res, err);
  }
});

// ---------- Employees ----------
app.get("/api/employees", auth, async (req, res) => {
  try {
    // Regular employees only get basic directory info (no phone/address)
    const fields = isAdminRole(req.user.role) ? "-password" : "name email role department position";
    res.json(await User.find({}).select(fields));
  } catch (err) {
    fail(res, err);
  }
});

app.post("/api/employees", auth, adminOnly, async (req, res) => {
  try {
    const { name, department, position, password } = req.body;
    const email = String(req.body.email || "").trim().toLowerCase();
    const role = String(req.body.role || "employee").toLowerCase();

    if (!name || !String(name).trim()) return res.status(400).json({ message: "Name is required" });
    if (!isEmail(email)) return res.status(400).json({ message: "Valid email is required" });
    if (!ROLES.includes(role)) return res.status(400).json({ message: `Role must be one of: ${ROLES.join(", ")}` });
    if (password !== undefined && (typeof password !== "string" || password.length < 6))
      return res.status(400).json({ message: "Password must be at least 6 characters" });

    if (await User.findOne({ email })) return res.status(400).json({ message: "Email already exists" });

    // If no password is given, generate a random temporary one (returned once in the response)
    const tempPassword = password ? null : crypto.randomBytes(6).toString("base64url");
    const hashed = await bcrypt.hash(password || tempPassword, 10);

    const newUser = await User.create({
      name,
      email,
      role,
      department: department || "General",
      position: position || "Employee",
      password: hashed,
    });

    const data = newUser.toObject();
    delete data.password;
    res.status(201).json({ success: true, data, ...(tempPassword ? { tempPassword } : {}) });
  } catch (err) {
    fail(res, err, 400);
  }
});

app.delete("/api/employees/:id", auth, adminOnly, async (req, res) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid id" });
    if (req.params.id === String(req.user.id))
      return res.status(400).json({ message: "You cannot delete your own account" });
    const deleted = await User.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Employee not found" });
    res.status(204).send();
  } catch (err) {
    fail(res, err);
  }
});

// ---------- Leaves ----------
app.get("/api/leaves", auth, async (req, res) => {
  try {
    const filter = isAdminRole(req.user.role) ? {} : { applicant: req.user.id };
    const leaves = await Leave.find(filter).populate("applicant", "name email").sort({ createdAt: -1 });
    res.json(leaves.map((l) => ({ ...l.toObject(), employee: l.applicant?.name })));
  } catch (err) {
    fail(res, err);
  }
});

app.post("/api/leaves", auth, async (req, res) => {
  try {
    const { type, startDate, endDate, reason } = req.body;
    if (!isValidDate(startDate) || !isValidDate(endDate))
      return res.status(400).json({ message: "Valid start and end dates are required" });
    if (new Date(endDate) < new Date(startDate))
      return res.status(400).json({ message: "End date cannot be before start date" });
    if (!reason || !String(reason).trim()) return res.status(400).json({ message: "Reason is required" });

    const leave = await Leave.create({ applicant: req.user.id, type, startDate, endDate, reason });
    res.status(201).json({ success: true, data: leave });
  } catch (err) {
    fail(res, err, 400);
  }
});

app.put("/api/leaves/:id", auth, adminOnly, async (req, res) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid id" });
    const { status } = req.body;
    if (!["Pending", "Approved", "Rejected"].includes(status))
      return res.status(400).json({ message: "Status must be Pending, Approved or Rejected" });

    const leave = await Leave.findByIdAndUpdate(req.params.id, { status }, { new: true, runValidators: true });
    if (!leave) return res.status(404).json({ message: "Leave not found" });
    res.json({ success: true, data: leave });
  } catch (err) {
    fail(res, err, 400);
  }
});

// ---------- Announcements ----------
app.get("/api/announcements", auth, async (req, res) => {
  try {
    res.json(await Announcement.find({}).sort({ createdAt: -1 }));
  } catch (err) {
    fail(res, err);
  }
});

app.post("/api/announcements", auth, adminOnly, async (req, res) => {
  try {
    const { title, content } = req.body;
    if (!title || !content) return res.status(400).json({ message: "Title and content are required" });
    const ann = await Announcement.create({ title, content, author: req.user.id });
    res.status(201).json({ success: true, data: ann });
  } catch (err) {
    fail(res, err, 400);
  }
});

// ---------- Placeholders ----------
app.get("/api/attendance", auth, (req, res) => res.json([]));
app.use("/api/trainings", require("./routes/trainings")(auth, adminOnly));

// ---------- 404 + error handler ----------
app.use((req, res) => res.status(404).json({ message: "Route not found" }));
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") return res.status(400).json({ message: "Invalid JSON body" });
  fail(res, err);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));