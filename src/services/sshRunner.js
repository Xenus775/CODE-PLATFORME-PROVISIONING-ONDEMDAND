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
        resolve(stdout + stderr);
      }
    );
  });
}

module.exports = { runRemote };
