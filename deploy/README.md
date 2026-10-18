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

## 2. Créer la stack sur le serveur

```bash
sudo mkdir -p /opt/stacks/isiscapitalist/userworlds
sudo chown -R 1000:1000 /opt/stacks/isiscapitalist/userworlds
```

Le conteneur tourne avec l'utilisateur `node` (uid 1000) : sans ce `chown`, il
ne pourrait pas écrire les sauvegardes.

Dans Dockge, créer la stack `isiscapitalist` avec le contenu de
`deploy/compose.yaml`, puis **Deploy**. Vérifier depuis le serveur :

```bash
curl -I http://localhost:3002
```

## 3. Ouvrir l'accès public (Cloudflare)

Zero Trust → Networks → Tunnels → `elitedesk` → *Public hostname* → Add :

- Subdomain : `capitalist` — Domain : `alexisdechenais.fr`
- Service : `HTTP` → `100.78.214.78:3002`

`100.78.214.78` est l'IP Tailscale du serveur : contrairement à l'IP du LAN,
elle ne change pas en cas de déménagement (box différente), et UFW autorise
déjà tout le trafic sur `tailscale0`, donc aucune règle à ajouter.

Vérifier depuis le serveur que le jeu répond sur cette adresse :

```bash
curl -I http://100.78.214.78:3002
```

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
