const express = require("express");
const { SERVICES } = require("../services/orchestrator");
const lock = require("../services/lock");

const router = express.Router();

router.get("/", (req, res) => {
  res.render("form", { errors: [], services: SERVICES, locked: lock.isLocked() });
});

module.exports = router;
