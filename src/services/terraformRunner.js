const { execFile } = require("child_process");
const config = require("../config");

// 25 min : l'agent QEMU peut mettre plus de 15 min a repondre pendant la
// creation d'une VM (observe plusieurs fois cette session), le provider
// bpg/proxmox attend son propre timeout interne (15m, voir agent.timeout
// dans modules/vm) avant d'abandonner - il faut de la marge au-dessus.
function run(args, log, timeoutMs = 25 * 60 * 1000) {
  return new Promise((resolve, reject) => {
    log(`$ terraform ${args.join(" ")}`);
    execFile(
      "terraform",
      args,
      { cwd: config.terraformRepoPath, timeout: timeoutMs, maxBuffer: 32 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (stdout) log(stdout.trim());
        if (stderr) log(stderr.trim());
        if (error) {
          reject(new Error(`terraform ${args[0]} a echoue : ${error.message}`));
          return;
        }
        resolve(stdout);
      }
    );
  });
}

// -refresh=false : le refresh de l'etat existant peut prendre 15+ min a
// cause de l'agent QEMU (observe plusieurs fois). Un refresh complet
// periodique manuel reste recommande pour detecter une derive reelle.
async function applyGeneratedVm(vmName, log) {
  // Chaque generated.<vm>.tf ajoute un nouveau bloc "module" : Terraform
  // doit re-executer init pour l'enregistrer avant tout plan/validate,
  // meme si le provider est deja installe (verifie manuellement cette
  // session avant d'ecrire ce code).
  await run(["init", "-input=false", "-no-color"], log);
  await run(["fmt", "-check", "-no-color"], log).catch(() => {
    // fmt -check est informatif (echoue si mal formate) - ne bloque pas l'apply
  });
  await run(["validate", "-no-color"], log);
  // -target limite l'apply au module de cette VM : evite d'appliquer un
  // changement non lie qui trainerait dans le repertoire de travail.
  await run(["plan", "-refresh=false", `-target=module.${vmName}`, "-out=tfplan", "-no-color"], log);
  await run(["apply", "-auto-approve", "-no-color", "tfplan"], log);
}

module.exports = { applyGeneratedVm };
