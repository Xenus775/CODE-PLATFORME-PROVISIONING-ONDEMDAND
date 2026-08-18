#!/usr/bin/env node
// Cree ou met a jour un utilisateur du portail (mot de passe hache bcrypt).
// Usage : node scripts/create-user.js <username> <password>
const users = require("../src/services/users");

async function main() {
  const [username, password] = process.argv.slice(2);
  if (!username || !password) {
    console.error("Usage : node scripts/create-user.js <username> <password>");
    process.exit(1);
  }

  const existing = users.findUser(username);
  if (existing) {
    await users.setPassword(username, password);
    console.log(`Mot de passe mis a jour pour '${username}'.`);
  } else {
    await users.createUser(username, password);
    console.log(`Utilisateur '${username}' cree.`);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
