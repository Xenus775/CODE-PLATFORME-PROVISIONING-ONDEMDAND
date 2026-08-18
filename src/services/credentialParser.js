// Extrait les identifiants generes par les roles Ansible, affiches comme
// des lignes marqueurs machine-lisibles (voir roles/exploitation_account,
// postgresql, mysql, wordpress dans INFRA-ANSIBLE-PVE-HOME). Liste blanche
// de marqueurs connus pour eviter les faux positifs.

const MARKERS = [
  { type: "EXPLOITATION_PASSWORD", fields: ["host", "user", "password"] },
  { type: "POSTGRES_PASSWORD", fields: ["host", "user", "password"] },
  { type: "MYSQL_ROOT_PASSWORD", fields: ["host", "user", "password"] },
  { type: "WORDPRESS_DB", fields: ["host", "db_name", "db_user", "db_password"] },
  { type: "WORDPRESS_ADMIN", fields: ["host", "user", "password", "url"] },
  { type: "REDIS_PASSWORD", fields: ["host", "password"] },
  { type: "SAMBA_CREDENTIALS", fields: ["host", "share", "user", "password", "path"] },
];

function parseMarkers(output) {
  const results = [];
  for (const marker of MARKERS) {
    // Ligne type: MARKER_TYPE key1=val1 key2=val2 ... (valeurs sans espace).
    // Exclut le guillemet double : la sortie debug d'Ansible enveloppe le
    // message dans du JSON ("msg": "... valeur"), donc la derniere valeur
    // de la ligne est immediatement suivie d'un '"' sans espace - un \S+
    // naif l'inclurait dans la capture (bug deja rencontre avec
    // scripts/provision-vm.ps1 sur le depot Terraform).
    const lineRegex = new RegExp(`${marker.type}((?:\\s+\\w+=[^\\s"]+)+)`, "g");
    for (const lineMatch of output.matchAll(lineRegex)) {
      const fields = {};
      for (const fieldMatch of lineMatch[1].matchAll(/(\w+)=([^\s"]+)/g)) {
        fields[fieldMatch[1]] = fieldMatch[2];
      }
      results.push({ type: marker.type, fields });
    }
  }
  return results;
}

module.exports = { parseMarkers, MARKERS };
