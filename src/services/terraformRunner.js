const { spawn } = require("child_process");
const config = require("../config");

// 25 min : l'agent QEMU peut mettre plus de 15 min a repondre pendant la
// creation d'une VM (observe plusieurs fois cette session), le provider
// bpg/proxmox attend son propre timeout interne (15m, voir agent.timeout
// dans modules/vm) avant d'abandonner - il faut de la marge au-dessus.
//
// spawn (pas execFile) : la sortie est appendee au log ligne par ligne au
// fur et a mesure, execFile ne rend la main qu'a la fin de la commande -
// pendant un apply de 15-20 min, l'UI ne montrait donc rien avant la fin.
function run(args, log, timeoutMs = 25 * 60 * 1000) {
  return new Promise((resolve, reject) => {
    log(`$ terraform ${args.join(" ")}`);
    const child = spawn("terraform", args, { cwd: config.terraformRepoPath });

    let buffer = "";
    const flushLines = (chunk) => {
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop();
      for (const line of lines) log(line);
    };

    child.stdout.on("data", (d) => flushLines(d.toString()));
    child.stderr.on("data", (d) => flushLines(d.toString()));

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
    }, timeoutMs);

    child.on("close", (code) => {
      clearTimeout(timer);
      if (buffer) log(buffer);
      if (code !== 0) {
        reject(new Error(`terraform ${args[0]} a echoue (code ${code})`));
        return;
      }
      resolve();
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`terraform ${args[0]} a echoue : ${err.message}`));
    });
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
