const { spawn } = require("child_process");

// Execute une commande a distance via le client OpenSSH (pas de lib ssh2 :
// meme approche que scripts/provision-vm.ps1 sur le depot Terraform).
// spawn (pas execFile) + callback `log` optionnel : la sortie est streamee
// ligne par ligne au fur et a mesure (visible en direct dans l'UI pendant
// qu'ansible-playbook tourne), plutot que d'attendre la fin de la commande.
// Retourne stdout/stderr separement : le client SSH ecrit ses propres
// messages sur stderr (ex: "Permanently added ... to the list of known
// hosts" lors d'une premiere connexion), qui ne doivent jamais etre
// melanges a la sortie de la commande distante quand on y cherche une
// information precise (voir ipDiscovery.js).
function runRemote({ host, user, keyPath, command, timeoutMs = 20 * 60 * 1000, log }) {
  return new Promise((resolve, reject) => {
    const child = spawn("ssh", [
      "-i",
      keyPath,
      "-o",
      "BatchMode=yes",
      "-o",
      "ConnectTimeout=10",
      "-o",
      "StrictHostKeyChecking=accept-new",
      `${user}@${host}`,
      command,
    ]);

    let stdout = "";
    let stderr = "";
    let stdoutBuffer = "";
    let stderrBuffer = "";

    const flush = (chunk, isErr) => {
      const text = chunk.toString();
      if (isErr) stderr += text;
      else stdout += text;
      if (!log) return;
      let buf = (isErr ? stderrBuffer : stdoutBuffer) + text;
      const lines = buf.split("\n");
      buf = lines.pop();
      if (isErr) stderrBuffer = buf;
      else stdoutBuffer = buf;
      for (const line of lines) log(line);
    };

    child.stdout.on("data", (d) => flush(d, false));
    child.stderr.on("data", (d) => flush(d, true));

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
    }, timeoutMs);

    child.on("close", (code) => {
      clearTimeout(timer);
      if (log) {
        if (stdoutBuffer) log(stdoutBuffer);
        if (stderrBuffer) log(stderrBuffer);
      }
      if (code !== 0) {
        reject(new Error(`SSH vers ${host} echoue (code ${code})\n${stderr}`));
        return;
      }
      resolve({ stdout, stderr });
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`SSH vers ${host} echoue : ${err.message}`));
    });
  });
}

module.exports = { runRemote };
