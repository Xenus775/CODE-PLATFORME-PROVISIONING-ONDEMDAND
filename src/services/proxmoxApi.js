const https = require("https");
const config = require("../config");

const insecureAgent = new https.Agent({ rejectUnauthorized: !config.proxmoxTlsInsecure });

async function proxmoxRequest(pathSuffix) {
  const url = `${config.proxmoxApiEndpoint}${pathSuffix}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `PVEAPIToken=${config.proxmoxApiTokenId}=${config.proxmoxApiTokenSecret}`,
    },
    agent: insecureAgent,
  });
  if (!res.ok) {
    throw new Error(`Proxmox API ${pathSuffix} -> HTTP ${res.status}`);
  }
  const body = await res.json();
  return body.data;
}

async function getVmMacAddress(vmId) {
  const cfg = await proxmoxRequest(`/nodes/${config.proxmoxNode}/qemu/${vmId}/config`);
  const match = /virtio=([0-9A-Fa-f:]+)/.exec(cfg.net0 || "");
  if (!match) throw new Error(`Impossible de lire l'adresse MAC de la VM ${vmId} (net0=${cfg.net0})`);
  return match[1].toLowerCase();
}

async function getAgentIpv4(vmId, mac) {
  const data = await proxmoxRequest(`/nodes/${config.proxmoxNode}/qemu/${vmId}/agent/network-get-interfaces`);
  for (const iface of data.result || []) {
    if ((iface["hardware-address"] || "").toLowerCase() !== mac) continue;
    for (const addr of iface["ip-addresses"] || []) {
      if (addr["ip-address-type"] === "ipv4" && addr["ip-address"] !== "127.0.0.1") {
        return addr["ip-address"];
      }
    }
  }
  return null;
}

module.exports = { getVmMacAddress, getAgentIpv4 };
