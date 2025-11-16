# Maps MVP - Application de Matching de Trajets en Temps Réel

Application simple de matching de trajets entre utilisateurs en temps réel utilisant Socket.io et Google Maps Directions API.

## Fonctionnalités

- 🚀 **Matching de trajets en temps réel** entre utilisateurs
- 📍 **Calcul d'itinéraires** via Google Maps Directions API
- 🔍 **Autocomplétion d'adresses** avec Google Places API
- 🌍 **Géolocalisation** : Utilisation de la position actuelle comme point de départ
- 🗺️ **Géocodage automatique** : Conversion adresses ↔ coordonnées
- 🔄 **Communication temps réel** avec Socket.io
- 📊 **Calcul de similarité** basé sur polylines et proximité temporelle
- 🎯 **Interface intuitive** avec suggestions d'adresses en temps réel
- 🗺️ **Visualisation sur carte** avec Leaflet

## Stack Technique

- **Backend**: Node.js + Express + Socket.io
- **Frontend**: HTML/CSS/JavaScript vanilla
- **API**: Google Maps Directions API
- **Calculs géométriques**: Turf.js

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

## Utilisation

### 📍 Saisie du trajet

**Option 1 : Utiliser votre position actuelle**
1. Cliquer sur le bouton 📍 à côté du champ "Origine"
2. Autoriser l'accès à votre position dans le navigateur
3. Votre adresse actuelle sera automatiquement remplie

**Option 2 : Saisir une adresse manuellement**
1. Commencer à taper une adresse dans le champ "Origine" (ex: "Tour Eiffel, Paris")
2. Sélectionner une suggestion dans la liste d'autocomplétion
3. Répéter pour la destination (ex: "Musée du Louvre, Paris")

### 🚀 Lancer le matching

4. Sélectionner le mode de transport (transit+marche par défaut)
5. Choisir l'heure de départ
6. Cliquer sur "Trouver des matches"
7. Voir en temps réel les autres utilisateurs avec leur pourcentage de similarité

### 📊 Comprendre les résultats

Chaque match affiche :
- **Score global** (0-100%) : Similarité globale du trajet
- **Distance moyenne** : Distance entre les deux trajets
- **Chevauchement** : Pourcentage de trajet en commun
- **Score spatial** : Similarité géographique
- **Score temporel** : Proximité de l'heure de départ

**Note**: 
- L'application utilise **Google Maps Geocoding API** pour convertir les adresses en coordonnées
- L'**autocomplétion d'adresses** utilise **Google Places API** pour suggérer des adresses pendant la saisie
- La **géolocalisation** utilise l'API Geolocation du navigateur (nécessite HTTPS en production)
- Sans clé API configurée, l'autocomplétion est désactivée et des coordonnées aléatoires autour de Paris sont utilisées

## Architecture

```
maps_mvp/
├── server.js              # Serveur Express + Socket.io
├── utils/
│   ├── routing.js         # Appels API Google Maps
│   └── matching.js        # Calcul de similarité
└── public/
    ├── index.html         # Interface utilisateur
    ├── style.css          # Styles
    └── client.js          # Logique frontend + Socket.io
```

## Algorithme de Matching

Le score de similarité (0-100%) est calculé en combinant:
- **Similarité de trajet** (70%): Distance moyenne entre les polylines
- **Proximité temporelle** (30%): Différence d'heure de départ

## Notes

- Pas de base de données: les trajets sont stockés en mémoire
- Les données sont perdues au redémarrage du serveur
- MVP pour tester le concept de matching en temps réel

## Licence

ISC
