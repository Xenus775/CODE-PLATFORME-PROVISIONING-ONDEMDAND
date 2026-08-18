#!/usr/bin/env node
// Cree ou met a jour un utilisateur du portail (mot de passe hache bcrypt).
// Usage : node scripts/create-user.js <username> <password> [admin|operator]
const users = require("../src/services/users");

async function main() {
  const [username, password, role] = process.argv.slice(2);
  if (!username || !password) {
    console.error("Usage : node scripts/create-user.js <username> <password> [admin|operator]");
    process.exit(1);
  }

  const existing = users.findUser(username);
  if (existing) {
    await users.setPassword(username, password);
    if (role) users.setRole(username, role);
    console.log(`Mot de passe mis a jour pour '${username}'.`);
  } else {
    await users.createUser(username, password, role || "admin");
    console.log(`Utilisateur '${username}' cree (role: ${role || "admin"}).`);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
