# Mise en ligne sur le homelab

Le jeu tourne dans un seul conteneur : le serveur NestJS sert l'API `/graphql`,
les images du monde (`/icones`) et le client Angular. Il est exposé par le
tunnel Cloudflare existant, sans ouvrir de port sur la box.

## 1. Publier l'image (une fois)

1. Pousser `main` sur GitHub : le workflow `.github/workflows/docker.yml`
   construit `ghcr.io/alexisdcn/isiscapitalist:latest`.
2. Sur GitHub, *Packages* → `isiscapitalist` → *Package settings* →
   *Change visibility* → **Public** (sinon le serveur ne peut pas la télécharger
   sans identifiants).

## 2. Créer la stack (Dockge, sans SSH)

Dans Dockge (`http://100.78.214.78:5001`) : **+ Compose**, nom
`isiscapitalist`, coller le contenu de `deploy/compose.yaml`, puis **Deploy**.

Les sauvegardes vont dans le volume Docker nommé `isiscapitalist_userworlds`,
créé automatiquement avec les bons droits. Il est conservé lors des mises à
jour et des redéploiements (seul « Delete » de la stack peut le supprimer).

Vérifier que le jeu répond : ouvrir `http://100.78.214.78:3002` depuis un
appareil connecté à Tailscale.

Sauvegarde : ce volume est dans `/var/lib/docker/volumes`, pas dans
`/opt/stacks` ; l'ajouter au cron de sauvegarde le jour où il existe.

## 3. Ouvrir l'accès public (Cloudflare)

Zero Trust → Networks → Tunnels → `elitedesk` → *Public hostname* → Add :

- Subdomain : `capitalist` — Domain : `alexisdechenais.fr`
- Service : `HTTP` → `100.78.214.78:3002`

`100.78.214.78` est l'IP Tailscale du serveur : contrairement à l'IP du LAN,
elle ne change pas en cas de déménagement (box différente), et UFW autorise
déjà tout le trafic sur `tailscale0`, donc aucune règle à ajouter.

Si `https://capitalist.alexisdechenais.fr` renvoie une erreur 502 alors que
`http://100.78.214.78:3002` marche via Tailscale, cloudflared ne joint pas
l'IP Tailscale depuis son conteneur : utiliser `192.168.1.100:3002` à la place
(et autoriser le port dans UFW).

Ne **pas** le mettre derrière Cloudflare Access : les jeux des autres
étudiants appellent `/graphql` directement et ne peuvent pas passer le code
PIN par e-mail.

Le lien à partager : `https://capitalist.alexisdechenais.fr`
(et `https://capitalist.alexisdechenais.fr/graphql` pour l'ajouter comme
monde dans un autre client).

## Mises à jour

`git push` sur `main` → nouvelle image → Watchtower la récupère (label
`com.centurylinklabs.watchtower.enable=true`). Les sauvegardes, dans
`/opt/stacks/isiscapitalist/userworlds`, ne sont pas touchées.

Penser à inclure ce dossier dans la sauvegarde hebdomadaire de `/opt/stacks`.
