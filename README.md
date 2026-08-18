# CODE-PLATFORME-PROVISIONING-ONDEMDAND

Portail web de provisioning de VM a la demande sur mon Proxmox personnel.
Un formulaire (nom, CPU, RAM, reseau, un ou plusieurs services) declenche
automatiquement
[INFRA-TERRAFORM-PVE-HOME](https://github.com/Xenus775/INFRA-TERRAFORM-PVE-HOME)
(creation de la VM) puis
[INFRA-ANSIBLE-PVE-HOME](https://github.com/Xenus775/INFRA-ANSIBLE-PVE-HOME)
(configuration des services) et affiche les identifiants generes a la
fin. Interface inspiree des outils d'execution de jobs type Rundeck
(sidebar, historique des executions, timeline d'etapes, journal en
direct).

Voir `DECISIONS.txt` pour le raisonnement des choix d'architecture.

## Architecture

```
Formulaire (portal01, Express, session authentifiee)
   |
   v
1. Allouer un VMID libre (200-299) en scannant les .tf du repo Terraform
2. Ecrire generated.<vm>.tf a la racine du repo Terraform (module ./modules/vm)
3. terraform init/fmt/validate/plan/apply (local a portal01) + commit/push
4. Decouvrir l'IP : agent QEMU (court timeout) puis fallback ARP/tcpdump
   via SSH a l'hote Proxmox
5. SSH -> LPRANSIBLE01 : git pull && scripts/add-host.py (un --group par
   service selectionne) && git commit && git push
6. SSH -> LPRANSIBLE01 : ansible-playbook site.yml --limit <vm>
   && ansible-playbook <service>.yml --limit <vm> (un par service choisi)
   && ansible-playbook exploitation-account.yml --limit <vm>
7. Parser les lignes marqueurs de mots de passe generes dans la sortie SSH
8. Afficher les identifiants ("a noter maintenant, rien n'est stocke")
```

Cette VM (`portal01`) est la seule a detenir le token API Proxmox et une
cle SSH vers le noeud Proxmox. Elle ne lance jamais `ansible-playbook`
elle-meme : `LPRANSIBLE01` reste l'unique control-node Ansible et
l'unique proprietaire du checkout `INFRA-ANSIBLE-PVE-HOME` (commits/push
inclus) — le portail lui envoie des commandes SSH.

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
npm run create-user -- admin "un-mot-de-passe-solide"
npm start
```

## Comptes utilisateurs

Pas de Basic Auth : une vraie session (cookie signe, `express-session`)
apres connexion via `/login`, avec des mots de passe **haches** (bcrypt,
jamais en clair) stockes dans `data/users.json` (hors git, permissions
restreintes). Deux roles :

- `admin` : peut se connecter, provisionner, **et** gerer les comptes via
  la page `/admin` (creer, changer role/mot de passe, supprimer).
- `operator` : peut se connecter et provisionner, pas d'acces a `/admin`.

Bootstrap du tout premier compte en ligne de commande sur `portal01`
(les suivants se creent ensuite depuis `/admin`) :

```bash
npm run create-user -- <username> <password> [admin|operator]   # role par defaut : admin
```

## Services supportes

Le formulaire permet de choisir **un ou plusieurs** services a la fois
pour une meme VM (elle rejoint alors plusieurs groupes d'inventaire
Ansible en meme temps) :

| Service | Groupe Ansible | Playbook | Identifiant genere |
|---|---|---|---|
| Apache | `webservers` | `webserver.yml` | — |
| nginx | `nginx_servers` | `nginx.yml` | — |
| WordPress | `wordpress_servers` | `wordpress.yml` | base + compte admin |
| PostgreSQL | `postgres_servers` | `postgres.yml` | mot de passe `postgres` |
| MySQL / MariaDB | `mysql_servers` | `mysql.yml` | mot de passe root |
| Redis | `redis_servers` | `redis.yml` | mot de passe (`requirepass`) |
| Docker | `docker_servers` | `docker.yml` | — |
| Samba (partage fichiers) | `samba_servers` | `samba.yml` | compte + mot de passe du partage |

## Securite

- Authentification par session (cookie signe, mots de passe haches
  bcrypt) — voir "Comptes utilisateurs" ci-dessus.
- Plusieurs provisionnings peuvent tourner en parallele. Seules les
  sections a etat partage (checkout Terraform, checkout Ansible sur
  LPRANSIBLE01) sont serialisees en interne par deux mutex dedies ;
  decouverte d'IP et `ansible-playbook` tournent en parallele entre jobs
  (voir `DECISIONS.txt`).
- Aucun identifiant de service genere n'est stocke : affiche une seule
  fois sur la page de resultat, a noter immediatement.
- Aucun secret commite (`.env` et `data/` exclus par `.gitignore`, meme
  pattern que `terraform.tfvars` dans le depot Terraform).
