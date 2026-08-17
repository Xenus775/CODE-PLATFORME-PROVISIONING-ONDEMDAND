// Mutex asynchrone minimal (file d'attente de promesses), utilise pour
// serialiser uniquement les operations qui touchent un etat partage
// (fichier terraform.tfstate, checkout git sur LPRANSIBLE01), sans bloquer
// le reste du pipeline d'un provisioning (decouverte IP, ansible-playbook)
// qui peut tourner en parallele entre plusieurs jobs.
function createMutex() {
  let tail = Promise.resolve();

  function runExclusive(fn) {
    const run = tail.then(fn, fn);
    tail = run.catch(() => {});
    return run;
  }

  return { runExclusive };
}

module.exports = { createMutex };
