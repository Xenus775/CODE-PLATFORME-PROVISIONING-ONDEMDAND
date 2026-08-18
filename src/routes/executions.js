const express = require("express");
const jobsStore = require("../services/jobs");
const phases = require("../services/phases");
const { SERVICES } = require("../services/orchestrator");

const router = express.Router();

router.get("/executions", (req, res) => {
  res.render("executions", { jobs: jobsStore.listJobs(), phases, services: SERVICES, user: req.session.user });
});

module.exports = router;
