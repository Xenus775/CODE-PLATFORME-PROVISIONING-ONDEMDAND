// Verrou global : un seul provisioning a la fois (terraform + git + ssh ne
// supportent pas des runs concurrents propres sur ce depot/state).
let locked = false;

function tryAcquire() {
  if (locked) return false;
  locked = true;
  return true;
}

function release() {
  locked = false;
}

function isLocked() {
  return locked;
}

module.exports = { tryAcquire, release, isLocked };
