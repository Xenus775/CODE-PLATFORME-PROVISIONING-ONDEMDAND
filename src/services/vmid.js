const fs = require("fs");
const path = require("path");

const VMID_MIN = 200;
const VMID_MAX = 299;

// Alloue le plus petit VMID libre entre 200 et 299, en scannant tous les
// .tf du dossier racine du depot Terraform (main.tf + generated.*.tf).
function allocateVmid(terraformRepoPath) {
  const used = new Set();
  const files = fs.readdirSync(terraformRepoPath).filter((f) => f.endsWith(".tf"));

  for (const file of files) {
    const content = fs.readFileSync(path.join(terraformRepoPath, file), "utf-8");
    const matches = content.matchAll(/vm_id\s*=\s*(\d+)/g);
    for (const match of matches) {
      used.add(Number(match[1]));
    }
  }

  for (let id = VMID_MIN; id <= VMID_MAX; id++) {
    if (!used.has(id)) return id;
  }

  throw new Error(`Plus aucun VMID libre entre ${VMID_MIN} et ${VMID_MAX}`);
}

module.exports = { allocateVmid, VMID_MIN, VMID_MAX };
