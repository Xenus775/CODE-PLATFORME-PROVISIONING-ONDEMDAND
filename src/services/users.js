const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const config = require("../config");

// Utilisateurs stockes dans un simple fichier JSON local (mot de passe
// hache bcrypt, jamais en clair) - pas de base de donnees pour un usage a
// quelques comptes, meme logique que le reste du portail (pas de DB, voir
// DECISIONS.txt). Le fichier vit hors git (voir .gitignore), permissions
// restreintes a l'utilisateur systeme portal.
//
// Deux roles : "admin" (peut gerer les comptes via /admin) et "operator"
// (peut provisionner, pas gerer les comptes).

const ROLES = ["admin", "operator"];

function loadUsers() {
  if (!fs.existsSync(config.usersFilePath)) return [];
  const users = JSON.parse(fs.readFileSync(config.usersFilePath, "utf-8"));
  // Compat : les tout premiers comptes crees avant l'introduction des
  // roles n'ont pas de champ role - on les traite comme admin (c'etait
  // implicitement le cas, un seul compte partage faisait tout).
  return users.map((u) => ({ role: "admin", ...u }));
}

function saveUsers(users) {
  fs.mkdirSync(path.dirname(config.usersFilePath), { recursive: true });
  fs.writeFileSync(config.usersFilePath, JSON.stringify(users, null, 2), { mode: 0o600 });
}

function findUser(username) {
  return loadUsers().find((u) => u.username === username);
}

function listUsers() {
  return loadUsers().map(({ username, role, createdAt }) => ({ username, role, createdAt }));
}

function countAdmins(users) {
  return users.filter((u) => u.role === "admin").length;
}

async function verifyPassword(username, password) {
  const user = findUser(username);
  if (!user) return false;
  return bcrypt.compare(password, user.passwordHash);
}

async function createUser(username, password, role = "operator") {
  if (!ROLES.includes(role)) throw new Error(`Role invalide : ${role}`);
  const users = loadUsers();
  if (users.some((u) => u.username === username)) {
    throw new Error(`L'utilisateur '${username}' existe deja.`);
  }
  const passwordHash = await bcrypt.hash(password, 12);
  users.push({ username, passwordHash, role, createdAt: new Date().toISOString() });
  saveUsers(users);
}

async function setPassword(username, password) {
  const users = loadUsers();
  const user = users.find((u) => u.username === username);
  if (!user) throw new Error(`Utilisateur '${username}' introuvable.`);
  user.passwordHash = await bcrypt.hash(password, 12);
  saveUsers(users);
}

function setRole(username, role) {
  if (!ROLES.includes(role)) throw new Error(`Role invalide : ${role}`);
  const users = loadUsers();
  const user = users.find((u) => u.username === username);
  if (!user) throw new Error(`Utilisateur '${username}' introuvable.`);
  if (user.role === "admin" && role !== "admin" && countAdmins(users) <= 1) {
    throw new Error("Impossible de retirer le role admin du dernier administrateur.");
  }
  user.role = role;
  saveUsers(users);
}

function deleteUser(username) {
  const users = loadUsers();
  const user = users.find((u) => u.username === username);
  if (!user) throw new Error(`Utilisateur '${username}' introuvable.`);
  if (user.role === "admin" && countAdmins(users) <= 1) {
    throw new Error("Impossible de supprimer le dernier administrateur.");
  }
  saveUsers(users.filter((u) => u.username !== username));
}

function hasAnyUser() {
  return loadUsers().length > 0;
}

module.exports = {
  ROLES,
  findUser,
  listUsers,
  verifyPassword,
  createUser,
  setPassword,
  setRole,
  deleteUser,
  hasAnyUser,
};
