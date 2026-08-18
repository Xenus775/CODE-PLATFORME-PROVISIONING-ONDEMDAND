// Libelles humains pour chaque phase du pipeline (voir orchestrator.js).
// Duplique cote client dans job.ejs (petite duplication assumee : plus
// simple que de partager du code entre EJS server-side et le JS du
// navigateur pour une poignee de libelles).
const LABELS = {
  queued_terraform: "En attente (terraform)",
  allocating_vmid: "Allocation du VMID",
  writing_terraform: "Ecriture de la configuration",
  terraform_apply: "Creation de la VM (terraform)",
  git_push_terraform: "Publication (terraform)",
  discovering_ip: "Decouverte de l'IP",
  queued_inventory: "En attente (inventaire)",
  updating_inventory: "Mise a jour de l'inventaire",
  configuring_ansible: "Configuration (ansible)",
  done: "Termine",
  failed: "Echec",
};

function label(phase) {
  return LABELS[phase] || phase;
}

function badgeClass(phase) {
  if (phase === "done") return "badge-done";
  if (phase === "failed") return "badge-failed";
  if (phase.startsWith("queued")) return "badge-queued";
  return "badge-running";
}

// Etapes macro affichees en timeline sur la page d'execution (regroupe
// les phases fines de orchestrator.js en 4 grandes etapes lisibles).
const STEPS = [
  { key: "terraform", label: "Terraform", phases: ["queued_terraform", "allocating_vmid", "writing_terraform", "terraform_apply", "git_push_terraform"] },
  { key: "ip", label: "Decouverte IP", phases: ["discovering_ip"] },
  { key: "inventory", label: "Inventaire", phases: ["queued_inventory", "updating_inventory"] },
  { key: "ansible", label: "Ansible", phases: ["configuring_ansible"] },
];

// Retourne l'etat de chaque etape macro (done/active/pending/failed) pour
// une phase courante donnee. failedAtPhase precise la phase fine ou une
// erreur est survenue (job.phase vaut alors juste "failed", voir jobs.js).
function computeSteps(currentPhase, failedAtPhase) {
  if (currentPhase === "done") {
    return STEPS.map((s) => ({ ...s, state: "done" }));
  }
  if (currentPhase === "failed") {
    const failIndex = STEPS.findIndex((s) => s.phases.includes(failedAtPhase));
    return STEPS.map((s, i) => ({
      ...s,
      state: failIndex === -1 ? "pending" : i < failIndex ? "done" : i === failIndex ? "failed" : "pending",
    }));
  }
  const currentIndex = STEPS.findIndex((s) => s.phases.includes(currentPhase));
  return STEPS.map((s, i) => ({
    ...s,
    state: i < currentIndex ? "done" : i === currentIndex ? "active" : "pending",
  }));
}

module.exports = { LABELS, STEPS, label, badgeClass, computeSteps };
