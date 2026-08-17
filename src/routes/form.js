const express = require("express");
const { SERVICES } = require("../services/orchestrator");
const jobsStore = require("../services/jobs");
const phases = require("../services/phases");

const router = express.Router();

router.get("/", (req, res) => {
  res.render("form", { errors: [], services: SERVICES, jobs: jobsStore.listJobs(), phases });
});

module.exports = router;
