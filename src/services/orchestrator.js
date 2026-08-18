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

// Un service = un groupe d'inventaire Ansible + un playbook dedie. Une VM
// peut cumuler plusieurs services (voir provision.js, formulaire a cases
// a cocher) : elle appartient alors a plusieurs groupes en meme temps.
const SERVICES = {
  apache: { label: "Apache", group: "webservers", playbook: "webserver.yml" },
  nginx: { label: "nginx", group: "nginx_servers", playbook: "nginx.yml" },
  wordpress: { label: "WordPress", group: "wordpress_servers", playbook: "wordpress.yml" },
  postgres: { label: "PostgreSQL", group: "postgres_servers", playbook: "postgres.yml" },
  mysql: { label: "MySQL / MariaDB", group: "mysql_servers", playbook: "mysql.yml" },
  redis: { label: "Redis", group: "redis_servers", playbook: "redis.yml" },
  docker: { label: "Docker", group: "docker_servers", playbook: "docker.yml" },
  samba: { label: "Samba (partage fichiers)", group: "samba_servers", playbook: "samba.yml" },
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

function buildGitCommand({ groups, vmName, ip }) {
  const repo = config.controlNodeRepoPath;
  const groupFlags = groups.map((g) => `--group ${g}`).join(" ");
  return [
    `cd ${repo}`,
    "git pull",
    `python3 scripts/add-host.py ${groupFlags} --name ${vmName} --ip ${ip}`,
    "git add -A",
    `git commit -m "Ajouter ${vmName} (portail de provisioning on-demand)"`,
    "git push origin main",
  ].join(" && ");
}

function buildAnsibleCommand({ vmName, playbooks }) {
  const repo = config.controlNodeRepoPath;
  const steps = [`cd ${repo}`, `ansible-playbook site.yml --limit ${vmName}`];
  for (const playbook of playbooks) {
    steps.push(`ansible-playbook ${playbook} --limit ${vmName}`);
  }
  steps.push(`ansible-playbook exploitation-account.yml --limit ${vmName}`);
  return steps.join(" && ");
}

async function runProvisioning(job) {
  const log = (line) => jobsStore.appendLog(job, line);
  const { vmName, cpuCores, memoryMb, network, services } = job.input;
  const serviceDefs = services.map((s) => SERVICES[s]);
  const groups = [...new Set(serviceDefs.map((s) => s.group))];
  const playbooks = [...new Set(serviceDefs.map((s) => s.playbook))];

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
        network,
        services,
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
      const gitCommand = buildGitCommand({ groups, vmName, ip });
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
    const ansibleCommand = buildAnsibleCommand({ vmName, playbooks });
    const ansibleResult = await runRemote({
      host: config.controlNodeHost,
      user: config.controlNodeUser,
      keyPath: config.controlNodeSshKeyPath,
      command: ansibleCommand,
      timeoutMs: 30 * 60 * 1000,
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
