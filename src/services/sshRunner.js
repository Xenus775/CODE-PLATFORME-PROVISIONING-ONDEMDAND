const { execFile } = require("child_process");

// Execute une commande a distance via le client OpenSSH (pas de lib ssh2 :
// meme approche que scripts/provision-vm.ps1 sur le depot Terraform).
function runRemote({ host, user, keyPath, command, timeoutMs = 20 * 60 * 1000 }) {
  return new Promise((resolve, reject) => {
    execFile(
      "ssh",
      [
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
      ],
      { timeout: timeoutMs, maxBuffer: 32 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`SSH vers ${host} echoue : ${error.message}\n${stderr}`));
          return;
        }
        // stdout/stderr separes : le client SSH lui-meme ecrit sur stderr
        // (ex: "Permanently added 'X.X.X.X' to the list of known hosts"
        // lors d'une premiere connexion), ce qui a deja fait remonter
        // l'IP de l'hote Proxmox par erreur quand tout etait concatene et
        // parse avec une regex generique. Voir ipDiscovery.js.
        resolve({ stdout, stderr });
      }
    );
  });
}

module.exports = { runRemote };
