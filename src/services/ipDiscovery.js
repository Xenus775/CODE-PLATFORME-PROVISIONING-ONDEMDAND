const config = require("../config");
const proxmoxApi = require("./proxmoxApi");
const { runRemote } = require("./sshRunner");

const AGENT_POLL_INTERVAL_MS = 10 * 1000;
const AGENT_POLL_TIMEOUT_MS = 90 * 1000; // l'agent QEMU s'est montre peu fiable (observe a 15+ min voire jamais)
const ARP_ATTEMPT_TIMEOUT_S = 60;
const ARP_MAX_ATTEMPTS = 3; // ~3 min

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollAgent(vmId, mac, log) {
  const deadline = Date.now() + AGENT_POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const ip = await proxmoxApi.getAgentIpv4(vmId, mac);
      if (ip) return ip;
    } catch (err) {
      log(`  (agent QEMU pas encore pret : ${err.message})`);
    }
    await sleep(AGENT_POLL_INTERVAL_MS);
  }
  return null;
}

// Fallback ARP/tcpdump via l'hote Proxmox : la methode qui a fonctionne de
// facon fiable cette session, quand l'agent QEMU ne repondait pas.
//
// IMPORTANT : on ne parse que stdout, jamais stderr. La toute premiere
// connexion SSH du compte portal vers l'hote Proxmox ecrit sur stderr
// "Permanently added 'X.X.X.X' (ED25519) to the list of known hosts" -
// avec stdout+stderr concatenes et une regex generique, cette IP de
// l'hote Proxmox lui-meme a ete confondue avec celle de la VM lors du
// premier test de bout en bout via le formulaire. Les regex ci-dessous
// sont aussi ancrees au format exact de la ligne attendue plutot que de
// chercher n'importe quelle sequence de chiffres/points.
async function pollArp(mac, log) {
  const neighResult = await runRemote({
    host: config.proxmoxSshHost,
    user: config.proxmoxSshUser,
    keyPath: config.proxmoxSshKeyPath,
    command: `ip neigh show | grep -i ${mac} || true`,
  });
  const instant = /^(\d{1,3}(?:\.\d{1,3}){3})\s/m.exec(neighResult.stdout);
  if (instant) return instant[1];

  for (let attempt = 0; attempt < ARP_MAX_ATTEMPTS; attempt++) {
    log(`  capture tcpdump ${attempt + 1}/${ARP_MAX_ATTEMPTS} (${ARP_ATTEMPT_TIMEOUT_S}s)...`);
    const tcpdumpResult = await runRemote({
      host: config.proxmoxSshHost,
      user: config.proxmoxSshUser,
      keyPath: config.proxmoxSshKeyPath,
      // pas de 2>&1 : la banniere tcpdump ("listening on...") reste sur
      // stderr, seules les lignes de paquets capturees vont sur stdout.
      command: `timeout ${ARP_ATTEMPT_TIMEOUT_S} tcpdump -i vmbr0 -en ether host ${mac} -c 5 || true`,
      timeoutMs: (ARP_ATTEMPT_TIMEOUT_S + 10) * 1000,
    });
    // Reponse ARP explicite ("Reply <ip> is-at <mac>") : confirme que la
    // VM revendique bien cette IP, contrairement a une simple requete.
    const reply = /Reply\s+(\d{1,3}(?:\.\d{1,3}){3})\s+is-at/.exec(tcpdumpResult.stdout);
    if (reply) return reply[1];
  }
  return null;
}

// Point d'entree : IP fixe -> retour immediat. DHCP -> agent QEMU (court),
// puis fallback ARP/tcpdump (~5 min au total). Echec propre si rien trouve
// (la VM existe, seule cette etape echoue - cf. plan de provisioning).
async function discoverIp({ vmId, network }, log) {
  if (network.mode === "static") {
    return network.ip;
  }

  const mac = await proxmoxApi.getVmMacAddress(vmId);
  log(`Adresse MAC de la VM : ${mac}`);

  log("Recherche de l'IP via l'agent QEMU...");
  const agentIp = await pollAgent(vmId, mac, log);
  if (agentIp) return agentIp;

  log("Agent QEMU sans reponse, fallback ARP/tcpdump via l'hote Proxmox...");
  const arpIp = await pollArp(mac, log);
  if (arpIp) return arpIp;

  throw new Error(
    `Impossible de determiner l'IP de la VM ${vmId} (agent QEMU et ARP tous deux sans reponse apres ~5 min). ` +
      "La VM existe (verifiez la console Proxmox) - terminez la configuration manuellement si besoin."
  );
}

module.exports = { discoverIp };
