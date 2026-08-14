const { execFile } = require("child_process");

function git(args, cwd) {
  return new Promise((resolve, reject) => {
    execFile("git", args, { cwd, maxBuffer: 8 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`git ${args.join(" ")} a echoue : ${error.message}\n${stderr}`));
        return;
      }
      resolve(stdout);
    });
  });
}

async function commitAndPush(repoPath, message, log) {
  await git(["add", "-A"], repoPath);
  const status = await git(["status", "--porcelain"], repoPath);
  if (!status.trim()) {
    log("Rien a committer.");
    return;
  }
  await git(["commit", "-m", message], repoPath);
  await git(["push", "origin", "main"], repoPath);
  log(`Commit + push : ${message}`);
}

module.exports = { commitAndPush };
