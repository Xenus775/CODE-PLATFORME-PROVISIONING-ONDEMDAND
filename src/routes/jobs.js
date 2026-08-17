const express = require("express");
const jobsStore = require("../services/jobs");
const phases = require("../services/phases");

const router = express.Router();

router.get("/jobs/:id", (req, res) => {
  const job = jobsStore.getJob(req.params.id);
  if (!job) return res.status(404).send("Job introuvable.");
  res.render("job", { job, phases });
});

router.get("/jobs/:id/data", (req, res) => {
  const job = jobsStore.getJob(req.params.id);
  if (!job) return res.status(404).json({ error: "not found" });
  res.json({
    id: job.id,
    phase: job.phase,
    log: job.log,
    vmName: job.vmName,
    ip: job.ip,
    credentials: job.credentials,
    error: job.error,
    finishedAt: job.finishedAt,
  });
});

module.exports = router;
