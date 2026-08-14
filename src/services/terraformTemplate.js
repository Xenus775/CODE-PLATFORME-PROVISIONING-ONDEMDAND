const fs = require("fs");
const path = require("path");

// Rend le bloc HCL d'une VM generee par le portail, sur le meme modele que
// les blocs ecrits a la main dans main.tf (module ./modules/vm). Fichier
// plat a la racine du depot (generated.<vm>.tf) : un sous-dossier ne
// serait pas charge automatiquement par Terraform.
function renderGeneratedTf({ vmName, vmId, cpuCores, memoryMb, network }) {
  const networkLines =
    network.mode === "static"
      ? `  ip_address     = "${network.ip}/24"\n  gateway        = var.network_gateway\n`
      : `  # dhcp (choix "DHCP" dans le formulaire)\n`;

  return `# VM de service : ${vmName} (generee automatiquement par le portail de
# provisioning on-demand le ${new Date().toISOString()}).
# NE PAS MODIFIER A LA MAIN - fichier gere par le portail
# (voir CODE-PLATFORME-PROVISIONING-ONDEMDAND).
module "${vmName}" {
  source = "./modules/vm"

  proxmox_node   = var.proxmox_node
  vm_name        = "${vmName}"
  vm_id          = ${vmId}
  template_vm_id = module.template.vm_id
  pool_id        = var.iac_pool_id

  cpu_cores    = ${cpuCores}
  memory_mb    = ${memoryMb}
  disk_size_gb = 20
  storage      = var.storage_vm

  network_bridge = var.network_bridge
${networkLines}
  ci_user        = var.ci_user
  ssh_public_key = var.ssh_public_key

  tags = ["iac", "portal", "${network.service}"]
}
`;
}

function writeGeneratedTf(terraformRepoPath, vmName, hcl) {
  const filePath = path.join(terraformRepoPath, `generated.${vmName}.tf`);
  fs.writeFileSync(filePath, hcl, "utf-8");
  return filePath;
}

module.exports = { renderGeneratedTf, writeGeneratedTf };
