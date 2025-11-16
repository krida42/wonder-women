# Plan des Nouvelles Fonctionnalités 🚨

## Vue d'ensemble
Refonte de l'UI avec une navbar en bas et ajout d'un système d'alerte SOS pour la sécurité des femmes.

## Changements à Implémenter

### 1. Navigation Bar en Bas (Bottom Navigation)
**3 boutons avec icônes + texte:**

#### Bouton 1: "Rentrer" 🏠
- Position: Gauche de la navbar
- Action: Ouvre un bottom sheet (fenêtre glissante du bas)
- Contenu du bottom sheet:
  - Position de départ (par défaut: position actuelle)
  - Destination (avec autocomplétion existante)
  - Quand? (style Uber - sélecteur de temps)
  - **RETIRER**: Le champ "Comment?" (mode de transport)
  - Raison: On sait que c'est transport + à pied
- Animation: Slide up from bottom (ne couvre pas toute la page)

#### Bouton 2: "SOS" 🚨
- Position: Centre de la navbar (bouton principal)
- Style: Plus grand, couleur rouge/alerte
- Action: Envoie une alerte d'urgence
- Fonctionnalité:
  - Trouve les 20 femmes les plus proches
  - Envoie notification à ces 20 femmes
  - Message: "Une femme a besoin d'aide près de vous"
  - Les femmes peuvent:
    - Voir la position en temps réel de la personne en détresse
    - Créer un itinéraire vers elle
    - Voir la distance
- Backend: Calcul des 20 plus proches par distance

#### Bouton 3: "Paramètres" ⚙️
- Position: Droite de la navbar
- Action: Ouvre les paramètres du compte
- Contenu (à définir):
  - Profil utilisateur
  - Préférences
  - Notifications
  - Déconnexion

### 2. Modifications de l'UI Existante

#### Supprimer:
- Les deux tabs actuels ("À proximité" et "Mon trajet")
- Le formulaire de trajet visible en permanence
- Le sélecteur de mode de transport

#### Garder:
- La carte en plein écran
- Les marqueurs des utilisatrices
- Le système de chat (click sur marqueur)
- La géolocalisation automatique

#### Ajouter:
- Navbar fixe en bas (3 boutons)
- Bottom sheet pour le formulaire de trajet
- Système d'alerte SOS
- Notifications d'urgence

### 3. Structure des Fichiers à Modifier

#### HTML (public/index.html)
```
- Supprimer: tab-navigation, tab-content
- Ajouter: 
  * <nav class="bottom-navbar">
  * <div class="bottom-sheet" id="tripSheet">
  * <div class="bottom-sheet" id="settingsSheet">
  * <div class="sos-alert-modal">
```

#### CSS (public/style.css)
```
- Ajouter:
  * .bottom-navbar (fixed bottom, 3 buttons)
  * .bottom-sheet (slide up animation)
  * .sos-button (special styling)
  * .sos-alert-modal
  * .sos-notification
```

#### JavaScript (public/client.js)
```
- Ajouter:
  * openTripSheet() / closeTripSheet()
  * openSettingsSheet() / closeSettingsSheet()
  * sendSOSAlert()
  * handleSOSReceived()
  * find20NearestUsers()
  * showSOSNotification()
  * createRouteToUser()
```

#### Server (server.js)
```
- Ajouter:
  * socket.on('send_sos')
  * calculateNearestUsers(position, count=20)
  * broadcastSOSAlert(userId, nearestUsers)
  * socket.on('sos_response')
```

### 4. Flux de l'Alerte SOS

```
1. User A clique sur bouton SOS
   ↓
2. Client envoie position + alerte au serveur
   ↓
3. Serveur calcule les 20 femmes les plus proches
   ↓
4. Serveur envoie notification à ces 20 femmes
   ↓
5. Chaque femme reçoit:
   - Notification visuelle + sonore
   - Position de User A en temps réel
   - Bouton "Créer itinéraire"
   - Distance actuelle
   ↓
6. Si une femme clique "Aider":
   - Itinéraire créé vers User A
   - User A notifié qu'une personne arrive
   - Suivi en temps réel
```

### 5. Design de la Bottom Navbar

```
┌─────────────────────────────────────┐
│                                     │
│         CARTE PLEIN ÉCRAN           │
│                                     │
│                                     │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│  🏠        🚨 SOS 🚨        ⚙️      │
│ Rentrer    URGENCE      Paramètres  │
└─────────────────────────────────────┘
```

### 6. Design du Bottom Sheet (Trajet)

```
┌─────────────────────────────────────┐
│  ━━━  (handle pour glisser)         │
│                                     │
│  📍 D'où partez-vous?               │
│  [Position actuelle ▼]              │
│                                     │
│  🏠 Où allez-vous?                  │
│  [Entrez votre destination...]      │
│                                     │
│  🕐 Quand?                          │
│  [Maintenant ▼] [Dans 15 min ▼]    │
│                                     │
│  [💜 Trouver des compagnes]         │
│                                     │
└─────────────────────────────────────┘
```

### 7. Design de l'Alerte SOS

```
┌─────────────────────────────────────┐
│  🚨 ALERTE D'URGENCE                │
│                                     │
│  Sarah a besoin d'aide!             │
│  📍 À 450m de vous                  │
│                                     │
│  [👁️ Voir sa position]              │
│  [🗺️ Créer un itinéraire]           │
│  [❌ Ignorer]                        │
│                                     │
└─────────────────────────────────────┘
```

## Priorités d'Implémentation

### Phase 1: Refonte UI (Navbar + Bottom Sheet)
1. Créer la bottom navbar avec 3 boutons
2. Supprimer les tabs existants
3. Créer le bottom sheet pour le trajet
4. Adapter le formulaire existant dans le bottom sheet
5. Retirer le sélecteur de mode de transport

### Phase 2: Système SOS
1. Créer le bouton SOS avec style spécial
2. Implémenter la logique de calcul des 20 plus proches
3. Créer le système de notification d'urgence
4. Ajouter le suivi en temps réel
5. Implémenter la création d'itinéraire vers la personne

### Phase 3: Paramètres
1. Créer le bottom sheet des paramètres
2. Ajouter les options de base
3. Implémenter la gestion du profil

## Questions à Clarifier

1. **Bouton SOS**: Faut-il une confirmation avant d'envoyer l'alerte?
2. **Notifications**: Son + vibration pour les alertes SOS?
3. **Paramètres**: Quelles options spécifiques voulez-vous?
4. **Itinéraire SOS**: Utiliser Google Maps ou afficher sur notre carte?
5. **Durée alerte**: Combien de temps l'alerte SOS reste active?

## Estimation

- Phase 1 (UI): ~2-3 heures
- Phase 2 (SOS): ~2-3 heures  
- Phase 3 (Paramètres): ~1 heure
- Tests: ~1 heure

**Total**: ~6-8 heures de développement
