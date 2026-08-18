const path = require("path");
require("dotenv").config();

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variable d'environnement manquante : ${name} (voir .env.example)`);
  }
  return value;
}

module.exports = {
  port: Number(process.env.PORT || 3000),

  sessionSecret: required("SESSION_SECRET"),
  usersFilePath: process.env.USERS_FILE_PATH || path.join(__dirname, "..", "data", "users.json"),

  terraformRepoPath: required("TERRAFORM_REPO_PATH"),

  proxmoxApiEndpoint: required("PROXMOX_API_ENDPOINT"),
  proxmoxApiTokenId: required("PROXMOX_API_TOKEN_ID"),
  proxmoxApiTokenSecret: required("PROXMOX_API_TOKEN_SECRET"),
  proxmoxNode: required("PROXMOX_NODE"),
  proxmoxTlsInsecure: process.env.PROXMOX_TLS_INSECURE === "true",

  proxmoxSshHost: required("PROXMOX_SSH_HOST"),
  proxmoxSshUser: required("PROXMOX_SSH_USER"),
  proxmoxSshKeyPath: required("PROXMOX_SSH_KEY_PATH"),

  controlNodeHost: required("CONTROL_NODE_HOST"),
  controlNodeUser: required("CONTROL_NODE_USER"),
  controlNodeSshKeyPath: required("CONTROL_NODE_SSH_KEY_PATH"),
  controlNodeRepoPath: process.env.CONTROL_NODE_REPO_PATH || "~/INFRA-ANSIBLE-PVE-HOME",
};
