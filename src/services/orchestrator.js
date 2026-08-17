const config = require("../config");
const jobsStore = require("./jobs");
const vmid = require("./vmid");
const terraformTemplate = require("./terraformTemplate");
const terraformRunner = require("./terraformRunner");
const gitOps = require("./gitOps");
const ipDiscovery = require("./ipDiscovery");
const { runRemote } = require("./sshRunner");
const { parseMarkers } = require("./credentialParser");
const { createMutex } = require("./mutex");

const SERVICES = {
  apache: { group: "webservers", playbook: "webserver.yml" },
  wordpress: { group: "wordpress_servers", playbook: "wordpress.yml" },
  postgres: { group: "postgres_servers", playbook: "postgres.yml" },
  mysql: { group: "mysql_servers", playbook: "mysql.yml" },
};

// Deux verrous distincts, chacun scope au plus petit etat partage
// necessaire - tout le reste (decouverte IP, ansible-playbook) tourne en
// parallele entre plusieurs jobs de provisioning simultanes :
// - terraformLock : le checkout Terraform de portal01 (un seul
//   terraform.tfstate local, un seul dossier de travail).
// - controlNodeGitLock : le checkout Ansible sur LPRANSIBLE01 (git pull/
//   commit/push sur un seul repertoire local distant).
const terraformLock = createMutex();
const controlNodeGitLock = createMutex();

function buildGitCommand({ group, vmName, ip }) {
  const repo = config.controlNodeRepoPath;
  return [
    `cd ${repo}`,
    "git pull",
    `python3 scripts/add-host.py --group ${group} --name ${vmName} --ip ${ip}`,
    "git add -A",
    `git commit -m "Ajouter ${vmName} (portail de provisioning on-demand)"`,
    "git push origin main",
  ].join(" && ");
}

function buildAnsibleCommand({ vmName, playbook }) {
  const repo = config.controlNodeRepoPath;
  return [
    `cd ${repo}`,
    `ansible-playbook site.yml --limit ${vmName}`,
    `ansible-playbook ${playbook} --limit ${vmName}`,
    `ansible-playbook exploitation-account.yml --limit ${vmName}`,
  ].join(" && ");
}

async function runProvisioning(job) {
  const log = (line) => jobsStore.appendLog(job, line);
  const { vmName, cpuCores, memoryMb, network, service } = job.input;
  const serviceDef = SERVICES[service];

  try {
    jobsStore.setPhase(job, "queued_terraform");
    const vmId = await terraformLock.runExclusive(async () => {
      jobsStore.setPhase(job, "allocating_vmid");
      const allocatedId = vmid.allocateVmid(config.terraformRepoPath);
      log(`VMID alloue : ${allocatedId}`);

      jobsStore.setPhase(job, "writing_terraform");
      const hcl = terraformTemplate.renderGeneratedTf({
        vmName,
        vmId: allocatedId,
        cpuCores,
        memoryMb,
        network: { ...network, service },
      });
      terraformTemplate.writeGeneratedTf(config.terraformRepoPath, vmName, hcl);
      log(`Fichier generated.${vmName}.tf ecrit.`);

      jobsStore.setPhase(job, "terraform_apply");
      await terraformRunner.applyGeneratedVm(vmName, log);

      jobsStore.setPhase(job, "git_push_terraform");
      await gitOps.commitAndPush(
        config.terraformRepoPath,
        `Ajouter ${vmName} (portail de provisioning on-demand)`,
        log
      );

      return allocatedId;
    });

    jobsStore.setPhase(job, "discovering_ip");
    const ip = await ipDiscovery.discoverIp({ vmId, network }, (line) => log(line));
    job.ip = ip;
    log(`IP decouverte : ${ip}`);

    jobsStore.setPhase(job, "queued_inventory");
    await controlNodeGitLock.runExclusive(async () => {
      jobsStore.setPhase(job, "updating_inventory");
      const gitCommand = buildGitCommand({ group: serviceDef.group, vmName, ip });
      await runRemote({
        host: config.controlNodeHost,
        user: config.controlNodeUser,
        keyPath: config.controlNodeSshKeyPath,
        command: gitCommand,
        timeoutMs: 5 * 60 * 1000,
        log,
      });
    });

    jobsStore.setPhase(job, "configuring_ansible");
    const ansibleCommand = buildAnsibleCommand({ vmName, playbook: serviceDef.playbook });
    const ansibleResult = await runRemote({
      host: config.controlNodeHost,
      user: config.controlNodeUser,
      keyPath: config.controlNodeSshKeyPath,
      command: ansibleCommand,
      timeoutMs: 20 * 60 * 1000,
      log,
    });
    const output = ansibleResult.stdout + ansibleResult.stderr;

    job.credentials = parseMarkers(output);
    jobsStore.finish(job, null);
  } catch (err) {
    log(`ERREUR : ${err.message}`);
    jobsStore.finish(job, err);
  }
}

module.exports = { runProvisioning, SERVICES };
