require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const { getDirections, geocodeAddress } = require('./utils/routing');
const { findMatches } = require('./utils/matching');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Stockage en mémoire des trajets et positions
const trips = new Map(); // userId -> trip data
const userSockets = new Map(); // userId -> socketId
const userPositions = new Map(); // userId -> {lat, lon, timestamp}

// Port
const PORT = process.env.PORT || 3000;

// Fonction pour calculer la distance entre deux points (formule de Haversine)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Rayon de la Terre en mètres
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance en mètres
}

// Route principale
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API endpoint pour obtenir la clé API (pour le frontend)
app.get('/api/config', (req, res) => {
  res.json({
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || ''
  });
});

// API endpoint pour obtenir tous les trajets actifs
app.get('/api/trips', (req, res) => {
  const allTrips = Array.from(trips.values());
  res.json({
    count: allTrips.length,
    trips: allTrips.map(trip => ({
      userId: trip.userId,
      userName: trip.userName,
      origin: trip.origin,
      destination: trip.destination,
      departureTime: trip.departureTime,
      mode: trip.mode
    }))
  });
});

// Gestion des connexions Socket.io
io.on('connection', (socket) => {
  console.log(`✅ Nouvelle connexion: ${socket.id}`);
  
  // Envoi du nombre d'utilisateurs connectés
  io.emit('users_count', trips.size);

  // Mise à jour de la position de l'utilisateur
  socket.on('update_position', (data) => {
    const { lat, lon } = data;
    
    if (lat && lon) {
      userPositions.set(socket.id, {
        lat,
        lon,
        timestamp: Date.now()
      });
      
      console.log(`📍 Position mise à jour pour ${socket.id}: ${lat}, ${lon}`);
    }
  });

  // Demande des utilisateurs à proximité
  socket.on('get_nearby_users', () => {
    const currentUserPos = userPositions.get(socket.id);
    const nearbyUsers = [];
    
    // Parcourir TOUTES les positions (pas seulement ceux avec trajets)
    userPositions.forEach((userPos, userId) => {
      if (userId !== socket.id) {
        let distance = null;
        
        // Calculer la distance si les deux positions sont disponibles
        if (currentUserPos && userPos) {
          distance = calculateDistance(
            currentUserPos.lat,
            currentUserPos.lon,
            userPos.lat,
            userPos.lon
          );
        }
        
        // Récupérer les infos du trajet si disponible
        const trip = trips.get(userId);
        const userName = trip ? trip.userName : `User-${userId.substring(0, 6)}`;
        
        nearbyUsers.push({
          userId: userId,
          userName: userName,
          position: userPos,
          distance: distance,
          hasTrip: trip ? true : false,
          mode: trip ? trip.mode : null,
          departureTime: trip ? trip.departureTime : null
        });
      }
    });
    
    // Trier par distance (les plus proches en premier)
    nearbyUsers.sort((a, b) => {
      if (a.distance === null) return 1;
      if (b.distance === null) return -1;
      return a.distance - b.distance;
    });
    
    socket.emit('nearby_users', { users: nearbyUsers });
    console.log(`👭 Envoi de ${nearbyUsers.length} utilisateurs à proximité à ${socket.id}`);
  });

  // Réception d'un nouveau trajet
  socket.on('submit_trip', async (data) => {
    try {
      console.log(`📍 Nouveau trajet reçu de ${data.userName || socket.id}`);
      
      let { origin, destination, mode, departureTime, userName } = data;
      
      // Si les données sont des adresses (strings), les géocoder
      if (typeof origin === 'string') {
        console.log(`🔍 Géocodage de l'origine: ${origin}`);
        try {
          const originGeo = await geocodeAddress(origin);
          origin = { lat: originGeo.lat, lon: originGeo.lon, address: originGeo.formattedAddress };
        } catch (error) {
          socket.emit('error', { message: `Impossible de trouver l'adresse d'origine: ${origin}` });
          return;
        }
      }
      
      if (typeof destination === 'string') {
        console.log(`🔍 Géocodage de la destination: ${destination}`);
        try {
          const destGeo = await geocodeAddress(destination);
          destination = { lat: destGeo.lat, lon: destGeo.lon, address: destGeo.formattedAddress };
        } catch (error) {
          socket.emit('error', { message: `Impossible de trouver l'adresse de destination: ${destination}` });
          return;
        }
      }
      
      // Validation des données
      if (!origin || !destination || !origin.lat || !origin.lon || !destination.lat || !destination.lon) {
        socket.emit('error', { message: 'Données de trajet invalides' });
        return;
      }

      // Calcul de l'itinéraire via Google Maps API
      console.log('🗺️  Calcul de l\'itinéraire...');
      const routeData = await getDirections({
        origin,
        destination,
        mode: mode || 'transit',
        departureTime: departureTime || 'now'
      });

      // Création de l'objet trajet
      const trip = {
        userId: socket.id,
        userName: userName || `User-${socket.id.substring(0, 6)}`,
        origin,
        destination,
        mode: mode || 'transit',
        departureTime: departureTime || new Date().toISOString(),
        polyline: routeData.polyline,
        distance: routeData.distance,
        duration: routeData.duration,
        createdAt: new Date().toISOString(),
        isMock: routeData.isMock || false
      };

      // Stockage du trajet
      trips.set(socket.id, trip);
      userSockets.set(socket.id, socket.id);

      console.log(`✅ Trajet enregistré pour ${trip.userName}`);
      console.log(`   Distance: ${(trip.distance / 1000).toFixed(2)} km`);
      console.log(`   Durée: ${Math.round(trip.duration / 60)} min`);
      console.log(`   Points polyline: ${trip.polyline.length}`);

      // Confirmation à l'utilisateur
      socket.emit('trip_confirmed', {
        trip: {
          userId: trip.userId,
          userName: trip.userName,
          distance: trip.distance,
          duration: trip.duration,
          polyline: trip.polyline
        }
      });

      // Calcul des matches pour ce nouvel utilisateur
      const allTrips = Array.from(trips.values());
      const matches = findMatches(trip, allTrips);
      
      console.log(`🔍 ${matches.length} match(es) trouvé(s) pour ${trip.userName}`);

      // Envoi des matches à l'utilisateur
      socket.emit('matches_update', { matches });

      // Notification aux autres utilisateurs et recalcul de leurs matches
      allTrips.forEach(otherTrip => {
        if (otherTrip.userId !== socket.id) {
          const otherMatches = findMatches(otherTrip, allTrips);
          const otherSocketId = userSockets.get(otherTrip.userId);
          
          if (otherSocketId) {
            io.to(otherSocketId).emit('matches_update', { matches: otherMatches });
            io.to(otherSocketId).emit('new_user_joined', {
              userName: trip.userName,
              userId: trip.userId
            });
          }
        }
      });

      // Mise à jour du compteur d'utilisateurs
      io.emit('users_count', trips.size);

    } catch (error) {
      console.error('❌ Erreur lors du traitement du trajet:', error.message);
      socket.emit('error', { 
        message: 'Erreur lors du calcul de l\'itinéraire',
        details: error.message 
      });
    }
  });

  // Mise à jour d'un trajet existant
  socket.on('update_trip', async (data) => {
    try {
      console.log(`🔄 Mise à jour du trajet pour ${socket.id}`);
      
      // Supprimer l'ancien trajet
      trips.delete(socket.id);
      
      // Traiter comme un nouveau trajet
      socket.emit('submit_trip', data);
      
    } catch (error) {
      console.error('❌ Erreur lors de la mise à jour:', error.message);
      socket.emit('error', { message: 'Erreur lors de la mise à jour du trajet' });
    }
  });

  // Demande de recalcul des matches
  socket.on('refresh_matches', () => {
    const userTrip = trips.get(socket.id);
    
    if (userTrip) {
      const allTrips = Array.from(trips.values());
      const matches = findMatches(userTrip, allTrips);
      socket.emit('matches_update', { matches });
      console.log(`🔄 Matches recalculés pour ${userTrip.userName}`);
    }
  });

  // Envoi de message
  socket.on('send_message', (data) => {
    const { to, message, timestamp } = data;
    
    // Récupérer les infos de l'expéditeur
    const senderTrip = trips.get(socket.id);
    const senderName = senderTrip ? senderTrip.userName : `User-${socket.id.substring(0, 6)}`;
    
    console.log(`💬 Message de ${senderName} vers ${to}: ${message}`);
    
    // Envoyer le message au destinataire
    io.to(to).emit('receive_message', {
      from: socket.id,
      fromName: senderName,
      message: message,
      timestamp: timestamp || new Date().toISOString()
    });
  });

  // Déconnexion
  socket.on('disconnect', () => {
    const userTrip = trips.get(socket.id);
    
    if (userTrip) {
      console.log(`👋 Déconnexion: ${userTrip.userName}`);
      
      // Supprimer le trajet et la position
      trips.delete(socket.id);
      userSockets.delete(socket.id);
      userPositions.delete(socket.id);
      
      // Notifier les autres utilisateurs
      socket.broadcast.emit('user_left', {
        userId: socket.id,
        userName: userTrip.userName
      });
      
      // Recalculer les matches pour tous les utilisateurs restants
      const allTrips = Array.from(trips.values());
      allTrips.forEach(trip => {
        const matches = findMatches(trip, allTrips);
        const socketId = userSockets.get(trip.userId);
        if (socketId) {
          io.to(socketId).emit('matches_update', { matches });
        }
      });
    } else {
      console.log(`👋 Déconnexion: ${socket.id}`);
    }
    
    // Mise à jour du compteur
    io.emit('users_count', trips.size);
  });
});

// Démarrage du serveur
server.listen(PORT, () => {
  console.log('\n🚀 Serveur démarré!');
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`👥 En attente de connexions...\n`);
  
  if (!process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY === 'YOUR_API_KEY_HERE') {
    console.log('⚠️  ATTENTION: Clé API Google Maps non configurée');
    console.log('   Les itinéraires seront simulés (lignes droites)');
    console.log('   Configurez votre clé dans le fichier .env\n');
  }
});

// Gestion des erreurs
process.on('uncaughtException', (error) => {
  console.error('❌ Erreur non gérée:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promesse rejetée non gérée:', reason);
});
