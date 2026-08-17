const config = require("../config");
const jobsStore = require("./jobs");
const vmid = require("./vmid");
const terraformTemplate = require("./terraformTemplate");
const terraformRunner = require("./terraformRunner");
const gitOps = require("./gitOps");
const ipDiscovery = require("./ipDiscovery");
const { runRemote } = require("./sshRunner");
const { parseMarkers } = require("./credentialParser");

const SERVICES = {
  apache: { group: "webservers", playbook: "webserver.yml" },
  wordpress: { group: "wordpress_servers", playbook: "wordpress.yml" },
  postgres: { group: "postgres_servers", playbook: "postgres.yml" },
  mysql: { group: "mysql_servers", playbook: "mysql.yml" },
};

function buildRemoteCommand({ group, vmName, ip, playbook }) {
  const repo = config.controlNodeRepoPath;
  const steps = [
    `cd ${repo}`,
    "git pull",
    `python3 scripts/add-host.py --group ${group} --name ${vmName} --ip ${ip}`,
    "git add -A",
    `git commit -m "Ajouter ${vmName} (portail de provisioning on-demand)"`,
    "git push origin main",
    `ansible-playbook site.yml --limit ${vmName}`,
    `ansible-playbook ${playbook} --limit ${vmName}`,
    `ansible-playbook exploitation-account.yml --limit ${vmName}`,
  ];
  return steps.join(" && ");
}

async function runProvisioning(job) {
  const log = (line) => jobsStore.appendLog(job, line);
  const { vmName, cpuCores, memoryMb, network, service } = job.input;
  const serviceDef = SERVICES[service];

  try {
    jobsStore.setPhase(job, "allocating_vmid");
    const vmId = vmid.allocateVmid(config.terraformRepoPath);
    log(`VMID alloue : ${vmId}`);

    jobsStore.setPhase(job, "writing_terraform");
    const hcl = terraformTemplate.renderGeneratedTf({
      vmName,
      vmId,
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

    jobsStore.setPhase(job, "discovering_ip");
    const ip = await ipDiscovery.discoverIp({ vmId, network }, (line) => log(line));
    job.ip = ip;
    log(`IP decouverte : ${ip}`);

    jobsStore.setPhase(job, "configuring_ansible");
    const remoteCommand = buildRemoteCommand({
      group: serviceDef.group,
      vmName,
      ip,
      playbook: serviceDef.playbook,
    });
    const remoteResult = await runRemote({
      host: config.controlNodeHost,
      user: config.controlNodeUser,
      keyPath: config.controlNodeSshKeyPath,
      command: remoteCommand,
      timeoutMs: 20 * 60 * 1000,
    });
    const output = remoteResult.stdout + remoteResult.stderr;
    log(output);

    job.credentials = parseMarkers(output);
    jobsStore.finish(job, null);
  } catch (err) {
    log(`ERREUR : ${err.message}`);
    jobsStore.finish(job, err);
  }
}

module.exports = { runProvisioning, SERVICES };
