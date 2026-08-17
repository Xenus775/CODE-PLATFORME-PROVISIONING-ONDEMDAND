# CODE-PLATFORME-PROVISIONING-ONDEMDAND

Portail web de provisioning de VM a la demande sur mon Proxmox personnel.
Un formulaire (nom, CPU, RAM, reseau, service) declenche automatiquement
[INFRA-TERRAFORM-PVE-HOME](https://github.com/Xenus775/INFRA-TERRAFORM-PVE-HOME)
(creation de la VM) puis
[INFRA-ANSIBLE-PVE-HOME](https://github.com/Xenus775/INFRA-ANSIBLE-PVE-HOME)
(configuration du service) et affiche les identifiants generes a la fin.

Voir `DECISIONS.txt` pour le raisonnement des choix d'architecture.

## Architecture

```
Formulaire (portal01, Express, Basic Auth)
   |
   v
1. Allouer un VMID libre (200-299) en scannant les .tf du repo Terraform
2. Ecrire generated.<vm>.tf a la racine du repo Terraform (module ./modules/vm)
3. terraform fmt/validate/plan/apply (local a portal01) + commit/push
4. Decouvrir l'IP : agent QEMU (court timeout) puis fallback ARP/tcpdump
   via SSH a l'hote Proxmox
5. SSH -> LPRANSIBLE01 : un seul appel qui fait
   git pull && scripts/add-host.py && git commit && git push
   && ansible-playbook site.yml --limit <vm>
   && ansible-playbook <service>.yml --limit <vm>
   && ansible-playbook exploitation-account.yml --limit <vm>
6. Parser les lignes marqueurs de mots de passe generes dans la sortie SSH
7. Afficher les identifiants ("a noter maintenant, rien n'est stocke")
```

Cette VM (`portal01`) est la seule a detenir le token API Proxmox et une
cle SSH vers le noeud Proxmox. Elle ne lance jamais `ansible-playbook`
elle-meme : `LPRANSIBLE01` reste l'unique control-node Ansible et
l'unique proprietaire du checkout `INFRA-ANSIBLE-PVE-HOME` (commits/push
inclus) — le portail lui envoie une seule commande SSH.

## Prerequis (bootstrap manuel)

- `portal01` provisionnee (VMID 202, IP fixe 192.168.10.121) via le depot
  Terraform, comme n'importe quelle autre VM.
- Node.js + npm sur `portal01` (installes par le role Ansible `portal`).
- Deux paires de cles SSH dediees a `portal01` : une vers l'hote Proxmox
  (`PROXMOX_SSH_KEY_PATH`), une vers `LPRANSIBLE01`
  (`CONTROL_NODE_SSH_KEY_PATH`), dont les cles publiques doivent etre
  ajoutees respectivement au `authorized_keys` de `root` sur l'hote
  Proxmox et du compte `ansible` sur `LPRANSIBLE01`.
- Un checkout local d'`INFRA-TERRAFORM-PVE-HOME` sur `portal01`
  (`TERRAFORM_REPO_PATH`), avec son propre `terraform.tfvars` et son
  propre `terraform.tfstate` (migre depuis le poste Windows lors du
  bootstrap — voir le README du depot Terraform : l'`apply` ne doit plus
  se faire depuis Windows une fois `portal01` en service).
- Un token API Proxmox (reutilisation du token Terraform existant
  acceptable, voir DECISIONS.txt) pour les appels directs a l'API Proxmox
  (decouverte d'IP).

## Configuration

```bash
cp .env.example .env
# Editez .env avec vos vraies valeurs (jamais commite)
npm install
npm start
```

## Roles/services supportes

| Service | Groupe Ansible | Playbook |
|---|---|---|
| `apache` | `webservers` | `webserver.yml` |
| `wordpress` | `wordpress_servers` | `wordpress.yml` |
| `postgres` | `postgres_servers` | `postgres.yml` |
| `mysql` | `mysql_servers` | `mysql.yml` |

## Securite

- Formulaire protege par authentification basique (identifiant unique
  partage, voir `.env`).
- Plusieurs provisionnings peuvent tourner en parallele. Seules les
  sections a etat partage (checkout Terraform, checkout Ansible sur
  LPRANSIBLE01) sont serialisees en interne par deux mutex dedies ;
  decouverte d'IP et `ansible-playbook` tournent en parallele entre jobs
  (voir `DECISIONS.txt`).
- Aucun identifiant genere n'est stocke : affiche une seule fois sur la
  page de resultat, a noter immediatement.
- Aucun secret commite (`.env` exclu par `.gitignore`, meme pattern que
  `terraform.tfvars` dans le depot Terraform).
