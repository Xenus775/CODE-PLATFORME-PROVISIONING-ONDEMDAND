const express = require("express");
const fs = require("fs");
const path = require("path");
const config = require("../config");
const jobsStore = require("../services/jobs");
const phases = require("../services/phases");
const { runProvisioning, SERVICES } = require("../services/orchestrator");

const router = express.Router();

const VM_NAME_RE = /^[a-z][a-z0-9-]{1,30}$/;
const RESERVED_NAMES = new Set(["lpransible01", "web01", "portal01", "template"]);

function validateInput(body) {
  const errors = [];
  const vmName = (body.vmName || "").trim().toLowerCase();
  const cpuCores = Number(body.cpuCores);
  const memoryMb = Number(body.memoryMb);
  const networkMode = body.networkMode;
  const staticIp = (body.staticIp || "").trim();
  const service = body.service;

  if (!VM_NAME_RE.test(vmName)) {
    errors.push("Nom de VM invalide (minuscules/chiffres/tirets, doit commencer par une lettre, 2-31 caracteres).");
  } else if (RESERVED_NAMES.has(vmName)) {
    errors.push(`Le nom '${vmName}' est reserve.`);
  } else if (fs.existsSync(path.join(config.terraformRepoPath, `generated.${vmName}.tf`))) {
    errors.push(`Une VM '${vmName}' a deja ete generee par le portail.`);
  } else if (jobsStore.isVmNameInFlight(vmName)) {
    errors.push(`Un provisioning pour '${vmName}' est deja en cours.`);
  }

  if (!Number.isInteger(cpuCores) || cpuCores < 1 || cpuCores > 8) {
    errors.push("CPU invalide (1 a 8 coeurs).");
  }
  if (!Number.isInteger(memoryMb) || memoryMb < 512 || memoryMb > 16384) {
    errors.push("RAM invalide (512 a 16384 Mo).");
  }

  if (!["dhcp", "static"].includes(networkMode)) {
    errors.push("Mode reseau invalide.");
  }
  if (networkMode === "static" && !/^192\.168\.10\.\d{1,3}$/.test(staticIp)) {
    errors.push("IP fixe invalide (attendu : 192.168.10.x).");
  }

  if (!Object.keys(SERVICES).includes(service)) {
    errors.push("Service invalide.");
  }

  return {
    errors,
    input: {
      vmName,
      cpuCores,
      memoryMb,
      service,
      network: networkMode === "static" ? { mode: "static", ip: staticIp } : { mode: "dhcp" },
    },
  };
}

// Plusieurs provisionings peuvent tourner en meme temps : seules les
// sections a etat partage (terraform, checkout git distant) sont
// serialisees en interne par l'orchestrateur (voir orchestrator.js), pas
// la soumission elle-meme.
router.post("/provision", (req, res) => {
  const { errors, input } = validateInput(req.body);

  if (errors.length > 0) {
    return res.status(400).render("form", { errors, services: SERVICES, jobs: jobsStore.listJobs(), phases });
  }

  const job = jobsStore.createJob(input);
  runProvisioning(job);

  res.redirect(`/jobs/${job.id}`);
});

module.exports = router;
