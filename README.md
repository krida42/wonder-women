# 💜 Wonder Women - Rentrez en Sécurité Ensemble

Application mobile de matching de trajets en temps réel pour aider les femmes à rentrer en sécurité après une soirée. Trouvez des personnes qui rentrent dans votre direction et voyagez ensemble !

## 🛡️ Fonctionnalités

- 💜 **Sécurité avant tout** : Trouvez des compagnes de route pour rentrer ensemble
- 🚀 **Matching en temps réel** : Connexion instantanée avec d'autres personnes
- 📍 **Géolocalisation automatique** : Votre position est détectée automatiquement
- 🗺️ **Calcul d'itinéraires intelligents** : Via Google Maps Directions API
- 🔍 **Autocomplétion d'adresses** : Suggestions en temps réel avec Google Places API
- 📊 **Matching précis** : Basé sur la similarité des trajets et l'heure de départ
- 💬 **Interface moderne** : Design pensé pour les jeunes femmes
- 🔄 **Temps réel** : Mises à jour instantanées via Socket.io
- 🗺️ **Visualisation sur carte** : Carte interactive avec Leaflet

## Stack Technique

- **Backend**: Node.js + Express + Socket.io
- **Frontend**: HTML/CSS/JavaScript vanilla
- **APIs**: Google Maps (Directions, Places, Geocoding)
- **Calculs géométriques**: Turf.js
- **Carte**: Leaflet

## Installation

1. Cloner le repository
```bash
git clone <repo-url>
cd maps_mvp
```

2. Installer les dépendances
```bash
npm install
```

3. Configurer la clé API Google Maps
- Copier `.env.example` vers `.env`
- Remplacer `YOUR_API_KEY_HERE` par votre clé API Google Maps
- Activer les APIs : Directions, Places, Geocoding

4. Lancer le serveur
```bash
npm start
```

Ou en mode développement avec auto-reload:
```bash
npm run dev
```

5. Ouvrir l'application
```
http://localhost:3000
```

## 💡 Comment ça marche ?

### 1️⃣ Votre position est détectée automatiquement
- Au chargement de la page, l'application détecte votre position actuelle
- Autorisez l'accès à votre localisation pour une expérience optimale
- Vous pouvez aussi saisir une adresse manuellement

### 2️⃣ Indiquez où vous allez
1. **D'où partez-vous ?** - Votre position actuelle (détectée automatiquement)
2. **Où allez-vous ?** - Entrez votre destination (ex: "Gare du Nord, Paris")
3. **Comment rentrez-vous ?** - Métro, à pied, vélo, voiture...
4. **Quand partez-vous ?** - Sélectionnez l'heure de départ

### 3️⃣ Trouvez vos compagnes de route
- Cliquez sur **"💜 Trouver des compagnes de route"**
- L'application trouve automatiquement les personnes qui :
  - Rentrent dans la même direction que vous
  - Partent à peu près au même moment
  - Utilisent le même mode de transport

### 4️⃣ Voyez les matches en temps réel
- **Score de similarité** : Plus il est élevé, plus le trajet est proche du vôtre
- **Détails du trajet** : Origine, destination, heure de départ
- **Carte interactive** : Visualisez tous les trajets
- **Mises à jour en direct** : Nouvelles personnes qui se connectent

## 🛡️ Conseils de sécurité

- ✅ Restez toujours en groupe dans les lieux publics
- ✅ Partagez votre position en temps réel avec un proche
- ✅ Gardez votre téléphone chargé et accessible
- ✅ Faites confiance à votre instinct
- ✅ En cas d'urgence : 17 (Police) ou 112

## Architecture

```
maps_mvp/
├── server.js              # Serveur Express + Socket.io
├── utils/
│   ├── routing.js         # Appels API Google Maps
│   └── matching.js        # Calcul de similarité
└── public/
    ├── index.html         # Interface utilisateur
    ├── style.css          # Styles modernes
    └── client.js          # Logique frontend + Socket.io
```

## Algorithme de Matching

Le score de similarité (0-100%) est calculé en combinant:
- **Similarité spatiale** (70%): Distance moyenne entre les polylines + chevauchement
- **Proximité temporelle** (30%): Différence d'heure de départ (fenêtre de 2h)

Plus le score est élevé, plus les trajets sont similaires et les personnes peuvent voyager ensemble en sécurité.

## 🎨 Design

L'interface a été spécialement conçue pour les jeunes femmes avec :
- Palette de couleurs rose/violet rassurante
- Typographie moderne (Inter)
- Animations fluides et élégantes
- Messages de sécurité intégrés
- Interface intuitive et accessible

## Notes Techniques

- **Pas de base de données** : Les trajets sont stockés en mémoire (MVP)
- **Données volatiles** : Perdues au redémarrage du serveur
- **Géolocalisation** : Nécessite HTTPS en production
- **APIs Google Maps** : Clé API requise pour fonctionnement complet

## Licence

ISC

---

💜 **Wonder Women** - Parce que rentrer en sécurité est un droit, pas un privilège
