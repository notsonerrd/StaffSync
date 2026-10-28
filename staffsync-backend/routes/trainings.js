const express = require("express");
const Training = require("../models/Training");

module.exports = (auth, adminOnly) => {
  const router = express.Router();
  router.use(auth);

  const isAdm = (u) => ["admin", "hr"].includes(String(u.role).toLowerCase());

  router.get("/", async (req, res) => {
    try {
      const list = await Training.find({}).populate("enrolled", "name email").sort({ startDate: 1 });
      res.json(list.map((t) => {
        const o = t.toObject();
        const enrolled = o.enrolled || [];
        return {
          ...o,
          enrolled: undefined,
          enrolledCount: enrolled.length,
          isEnrolled: enrolled.some((e) => String(e._id) === String(req.user.id)),
          participants: isAdm(req.user) ? enrolled : undefined,
        };
      }));
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  router.post("/", adminOnly, async (req, res) => {
    try {
      const { title, description, trainer, team, mode, startDate, endDate } = req.body;
      if (new Date(endDate) < new Date(startDate))
        return res.status(400).json({ message: "End date cannot be before start date" });
      const t = await Training.create({
        title, description, trainer, team, mode, startDate, endDate, createdBy: req.user.id,
      });
      res.status(201).json({ success: true, data: t });
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  });

  // Enroll / unenroll (toggle)
  router.post("/:id/enroll", async (req, res) => {
    try {
      const t = await Training.findById(req.params.id);
      if (!t) return res.status(404).json({ message: "Training not found" });
      const uid = String(req.user.id);
      const already = t.enrolled.some((e) => String(e) === uid);
      t.enrolled = already ? t.enrolled.filter((e) => String(e) !== uid) : [...t.enrolled, req.user.id];
      await t.save();
      res.json({ success: true, enrolled: !already });
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  });

  router.delete("/:id", adminOnly, async (req, res) => {
    try {
      await Training.findByIdAndDelete(req.params.id);
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  return router;
};
