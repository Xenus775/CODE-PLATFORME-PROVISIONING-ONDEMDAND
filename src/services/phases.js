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

module.exports = { LABELS, label, badgeClass };
