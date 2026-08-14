const { randomUUID } = require("crypto");

// Etat des jobs de provisioning en memoire (pas de DB : le process ne vit
// que le temps d'un provisioning, cf. DECISIONS.txt).
const jobs = new Map();

function createJob(input) {
  const id = randomUUID();
  const job = {
    id,
    input,
    phase: "queued",
    log: [],
    vmName: input.vmName,
    ip: null,
    credentials: [],
    error: null,
    startedAt: new Date().toISOString(),
    finishedAt: null,
  };
  jobs.set(id, job);
  return job;
}

function getJob(id) {
  return jobs.get(id);
}

function appendLog(job, line) {
  job.log.push(line);
}

function setPhase(job, phase) {
  job.phase = phase;
}

function finish(job, error) {
  job.finishedAt = new Date().toISOString();
  job.phase = error ? "failed" : "done";
  job.error = error ? String(error.message || error) : null;
}

module.exports = { createJob, getJob, appendLog, setPhase, finish };
