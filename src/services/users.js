const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const config = require("../config");

// Utilisateurs stockes dans un simple fichier JSON local (mot de passe
// hache bcrypt, jamais en clair) - pas de base de donnees pour un usage a
// quelques comptes, meme logique que le reste du portail (pas de DB, voir
// DECISIONS.txt). Le fichier vit hors git (voir .gitignore), permissions
// restreintes a l'utilisateur systeme portal.

function loadUsers() {
  if (!fs.existsSync(config.usersFilePath)) return [];
  return JSON.parse(fs.readFileSync(config.usersFilePath, "utf-8"));
}

function saveUsers(users) {
  fs.mkdirSync(path.dirname(config.usersFilePath), { recursive: true });
  fs.writeFileSync(config.usersFilePath, JSON.stringify(users, null, 2), { mode: 0o600 });
}

function findUser(username) {
  return loadUsers().find((u) => u.username === username);
}

async function verifyPassword(username, password) {
  const user = findUser(username);
  if (!user) return false;
  return bcrypt.compare(password, user.passwordHash);
}

async function createUser(username, password) {
  const users = loadUsers();
  if (users.some((u) => u.username === username)) {
    throw new Error(`L'utilisateur '${username}' existe deja.`);
  }
  const passwordHash = await bcrypt.hash(password, 12);
  users.push({ username, passwordHash, createdAt: new Date().toISOString() });
  saveUsers(users);
}

async function setPassword(username, password) {
  const users = loadUsers();
  const user = users.find((u) => u.username === username);
  if (!user) throw new Error(`Utilisateur '${username}' introuvable.`);
  user.passwordHash = await bcrypt.hash(password, 12);
  saveUsers(users);
}

function hasAnyUser() {
  return loadUsers().length > 0;
}

module.exports = { findUser, verifyPassword, createUser, setPassword, hasAnyUser };
