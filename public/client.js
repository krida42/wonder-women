// Connexion Socket.io
const socket = io();

// Variables globales
let map;
let nearbyMap;
let userPolyline;
let matchPolylines = [];
let currentTrip = null;
let originAutocomplete;
let destinationAutocomplete;
let googleMapsApiKey = '';
let userMarkers = new Map();
let currentUserPosition = null;
let myMarker = null;
let currentChatUserId = null;
let currentChatUserName = null;

// Initialisation de la carte Leaflet (trajet)
function initMap() {
    const mapElement = document.getElementById('map');
    if (!mapElement) {
        console.warn('Map element not found');
        return;
    }
    
    try {
        map = L.map('map').setView([48.8566, 2.3522], 12);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap',
            maxZoom: 19
        }).addTo(map);
    } catch (error) {
        console.error('Error initializing map:', error);
    }
}

// Initialisation de la carte de proximité
function initNearbyMap() {
    const nearbyMapElement = document.getElementById('nearbyMap');
    if (!nearbyMapElement) {
        console.warn('Nearby map element not found');
        return;
    }
    
    try {
        nearbyMap = L.map('nearbyMap').setView([48.8566, 2.3522], 13);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap',
            maxZoom: 19
        }).addTo(nearbyMap);
        
        console.log('✅ Carte de proximité initialisée');
    } catch (error) {
        console.error('Error initializing nearby map:', error);
    }
}

// Initialisation au chargement
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Initialisation de l\'application...');
    
    // Initialiser les cartes
    initNearbyMap();
    // initMap(); // Carte de trajet initialisée plus tard si nécessaire
    
    setDefaultDepartureTime();
    setupEventListeners();
    await loadGoogleMapsAPI();
    
    // Géolocalisation automatique
    autoGetCurrentLocation();
    
    console.log('✅ Application initialisée');
});

// Configuration des événements
function setupEventListeners() {
    // Tabs navigation
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            switchTab(btn.dataset.tab);
        });
    });
    
    // Formulaire
    document.getElementById('tripForm').addEventListener('submit', handleTripSubmit);
    
    // Boutons
    document.getElementById('refreshBtn').addEventListener('click', () => {
        socket.emit('refresh_matches');
        showNotification('Actualisation...', 'info');
    });
    
    document.getElementById('useLocationBtn').addEventListener('click', useCurrentLocation);
    
    // Chat
    document.getElementById('closeChatBtn').addEventListener('click', closeChat);
    document.getElementById('sendMessageBtn').addEventListener('click', sendMessage);
    document.getElementById('chatInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
}

// Changer de tab
function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tab === tabName) {
            btn.classList.add('active');
        }
    });
    
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    const activeTab = document.getElementById(`${tabName}Tab`);
    if (activeTab) {
        activeTab.classList.add('active');
        
        if (tabName === 'nearby' && nearbyMap) {
            setTimeout(() => {
                nearbyMap.invalidateSize();
                requestNearbyUsers();
            }, 100);
        } else if (tabName === 'trip') {
            // Initialiser la carte de trajet si elle n'existe pas encore
            if (!map) {
                setTimeout(() => {
                    initMap();
                }, 100);
            } else {
                setTimeout(() => {
                    map.invalidateSize();
                }, 100);
            }
        }
    }
}

// Demander les utilisateurs à proximité
function requestNearbyUsers() {
    socket.emit('get_nearby_users');
}

// Charger Google Maps API
async function loadGoogleMapsAPI() {
    try {
        const response = await fetch('/api/config');
        const config = await response.json();
        googleMapsApiKey = config.googleMapsApiKey;
        
        if (!googleMapsApiKey || googleMapsApiKey === 'YOUR_API_KEY_HERE') {
            console.warn('⚠️ Clé API non configurée');
            return;
        }
        
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&libraries=places`;
        script.async = true;
        script.defer = true;
        script.onload = initAutocomplete;
        document.head.appendChild(script);
        
    } catch (error) {
        console.error('Erreur API:', error);
    }
}

// Autocomplétion
function initAutocomplete() {
    if (typeof google === 'undefined' || !google.maps || !google.maps.places) {
        return;
    }
    
    const originInput = document.getElementById('origin');
    const destinationInput = document.getElementById('destination');
    
    const options = {
        types: ['geocode', 'establishment'],
        fields: ['formatted_address', 'geometry', 'name']
    };
    
    originAutocomplete = new google.maps.places.Autocomplete(originInput, options);
    destinationAutocomplete = new google.maps.places.Autocomplete(destinationInput, options);
    
    originAutocomplete.addListener('place_changed', () => {
        const place = originAutocomplete.getPlace();
        if (place.formatted_address) {
            originInput.value = place.formatted_address;
        }
    });
    
    destinationAutocomplete.addListener('place_changed', () => {
        const place = destinationAutocomplete.getPlace();
        if (place.formatted_address) {
            destinationInput.value = place.formatted_address;
        }
    });
    
    console.log('✅ Autocomplétion activée');
}

// Heure par défaut
function setDefaultDepartureTime() {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('departureTime').value = now.toISOString().slice(0, 16);
}

// Géolocalisation automatique
async function autoGetCurrentLocation() {
    const originInput = document.getElementById('origin');
    
    if (!navigator.geolocation) {
        return;
    }
    
    originInput.placeholder = '📍 Détection...';
    
    try {
        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            });
        });
        
        const { latitude, longitude } = position.coords;
        currentUserPosition = { lat: latitude, lon: longitude };
        
        console.log(`📍 Position: ${latitude}, ${longitude}`);
        
        await reverseGeocode(latitude, longitude, originInput);
        
        // Centrer la carte de proximité
        if (nearbyMap) {
            nearbyMap.setView([latitude, longitude], 14);
            
            // Marqueur utilisateur
            if (myMarker) {
                nearbyMap.removeLayer(myMarker);
            }
            
            const userIcon = L.divIcon({
                className: 'user-marker',
                html: '💜',
                iconSize: [40, 40]
            });
            
            myMarker = L.marker([latitude, longitude], { icon: userIcon })
                .addTo(nearbyMap)
                .bindPopup('<b>Vous êtes ici</b>');
        }
        
        // Envoyer au serveur
        socket.emit('update_position', { lat: latitude, lon: longitude });
        
        showNotification('📍 Position détectée', 'success');
        
    } catch (error) {
        console.log('⚠️ Géolocalisation échouée');
        originInput.placeholder = 'Ex: Tour Eiffel, Paris';
    }
}

// Bouton géolocalisation
async function useCurrentLocation() {
    const locationBtn = document.getElementById('useLocationBtn');
    const originInput = document.getElementById('origin');
    
    if (!navigator.geolocation) {
        showNotification('Géolocalisation non supportée', 'error');
        return;
    }
    
    locationBtn.disabled = true;
    locationBtn.textContent = '⏳';
    
    try {
        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            });
        });
        
        const { latitude, longitude } = position.coords;
        currentUserPosition = { lat: latitude, lon: longitude };
        
        await reverseGeocode(latitude, longitude, originInput);
        
        socket.emit('update_position', { lat: latitude, lon: longitude });
        
        showNotification('Position utilisée !', 'success');
        
    } catch (error) {
        showNotification('Erreur de géolocalisation', 'error');
    } finally {
        locationBtn.disabled = false;
        locationBtn.textContent = '📍';
    }
}

// Géocodage inverse
async function reverseGeocode(lat, lon, inputElement) {
    try {
        if (typeof google !== 'undefined' && google.maps && google.maps.Geocoder) {
            const geocoder = new google.maps.Geocoder();
            const latlng = { lat: lat, lng: lon };
            
            const result = await new Promise((resolve, reject) => {
                geocoder.geocode({ location: latlng }, (results, status) => {
                    if (status === 'OK' && results[0]) {
                        resolve(results[0]);
                    } else {
                        reject(new Error('Geocoding failed'));
                    }
                });
            });
            
            inputElement.value = result.formatted_address;
        } else {
            inputElement.value = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
        }
    } catch (error) {
        inputElement.value = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
    }
}

// Soumission trajet
async function handleTripSubmit(e) {
    e.preventDefault();
    
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '⏳ Calcul...<span class="spinner"></span>';
    
    const originAddress = document.getElementById('origin').value.trim();
    const destinationAddress = document.getElementById('destination').value.trim();
    
    if (!originAddress || !destinationAddress) {
        showNotification('Remplissez les adresses', 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '💜 Trouver des compagnes';
        return;
    }
    
    const tripData = {
        userName: document.getElementById('userName').value || null,
        origin: originAddress,
        destination: destinationAddress,
        mode: document.getElementById('mode').value,
        departureTime: document.getElementById('departureTime').value
    };
    
    socket.emit('submit_trip', tripData);
}

// Afficher utilisateurs à proximité
function displayNearbyUsers(users) {
    const nearbyCount = document.getElementById('nearbyCount');
    
    nearbyCount.textContent = users.length;
    
    // Effacer anciens marqueurs
    userMarkers.forEach(marker => nearbyMap.removeLayer(marker));
    userMarkers.clear();
    
    if (users.length === 0) {
        return;
    }
    
    users.forEach(user => {
        // Marqueur sur la carte
        if (user.position) {
            const markerIcon = L.divIcon({
                className: 'user-marker',
                html: '👤',
                iconSize: [35, 35]
            });
            
            const distance = user.distance ? `${(user.distance / 1000).toFixed(1)} km` : '?';
            const hasTrip = user.hasTrip ? '🚶‍♀️ En trajet' : '📍 En ligne';
            
            const marker = L.marker([user.position.lat, user.position.lon], { icon: markerIcon })
                .addTo(nearbyMap)
                .bindPopup(`<b>${user.userName}</b><br>${hasTrip}<br>${distance}`);
            
            // Ajouter un événement de clic sur le marqueur
            marker.on('click', () => {
                openChat(user.userId, user.userName);
            });
            
            userMarkers.set(user.userId, marker);
        }
    });
}

// Afficher polyline
function displayPolyline(polyline, color = '#667eea', weight = 4, opacity = 0.7) {
    if (!polyline || polyline.length === 0) return null;
    
    const latLngs = polyline.map(point => [point[0], point[1]]);
    const line = L.polyline(latLngs, {
        color: color,
        weight: weight,
        opacity: opacity
    }).addTo(map);
    
    return line;
}

// Afficher marqueurs
function displayMarkers(origin, destination, color = '#667eea') {
    const originIcon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="background: ${color}; width: 12px; height: 12px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>`,
        iconSize: [18, 18]
    });
    
    const destIcon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="background: ${color}; width: 16px; height: 16px; border-radius: 50%; border: 4px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>`,
        iconSize: [24, 24]
    });
    
    L.marker([origin.lat, origin.lon], { icon: originIcon }).addTo(map);
    L.marker([destination.lat, destination.lon], { icon: destIcon }).addTo(map);
}

// Centrer carte
function fitMapToPolyline(polyline) {
    if (!polyline || polyline.length === 0) return;
    
    const bounds = L.latLngBounds(polyline.map(p => [p[0], p[1]]));
    map.fitBounds(bounds, { padding: [50, 50] });
}

// Afficher matches
function displayMatches(matches) {
    const matchesList = document.getElementById('matchesList');
    const matchesCount = document.getElementById('matchesCount');
    const refreshBtn = document.getElementById('refreshBtn');
    
    matchesCount.textContent = `${matches.length} personne${matches.length > 1 ? 's' : ''}`;
    
    if (matches.length > 0) {
        refreshBtn.style.display = 'block';
    }
    
    matchPolylines.forEach(line => map.removeLayer(line));
    matchPolylines = [];
    
    if (matches.length === 0) {
        matchesList.innerHTML = `
            <div class="no-matches">
                <p>🔍 Recherche en cours...</p>
                <p class="hint">D'autres personnes vont bientôt se connecter</p>
            </div>
        `;
        return;
    }
    
    matchesList.innerHTML = '';
    
    matches.forEach(match => {
        const card = document.createElement('div');
        card.className = 'match-card';
        
        const scoreColor = getScoreColor(match.similarity);
        
        card.innerHTML = `
            <div class="match-header">
                <div class="match-user">👤 ${match.userName}</div>
                <div class="match-score" style="color: ${scoreColor};">${match.similarity}%</div>
            </div>
            <div class="match-details">
                <div class="match-detail">
                    <strong>📏 Distance</strong>
                    ${(match.details.avgDistance / 1000).toFixed(2)} km
                </div>
                <div class="match-detail">
                    <strong>🔗 Chevauchement</strong>
                    ${match.details.overlapPercentage}%
                </div>
                <div class="match-detail">
                    <strong>🎯 Spatial</strong>
                    ${match.details.spatialScore}%
                </div>
                <div class="match-detail">
                    <strong>⏰ Temporel</strong>
                    ${match.details.temporalScore}%
                </div>
            </div>
            <div class="match-trip-info">
                <strong>Mode :</strong> ${getModeName(match.trip.mode)} | 
                <strong>Départ :</strong> ${formatDateTime(match.trip.departureTime)}
            </div>
        `;
        
        matchesList.appendChild(card);
    });
}

// Couleur score
function getScoreColor(score) {
    if (score >= 80) return '#4ade80';
    if (score >= 60) return '#fbbf24';
    if (score >= 40) return '#fb923c';
    return '#ef4444';
}

// Nom mode
function getModeName(mode) {
    const modes = {
        'transit': '🚇 Métro/Bus',
        'driving': '🚗 Voiture',
        'walking': '🚶 Marche',
        'bicycling': '🚴 Vélo'
    };
    return modes[mode] || mode;
}

// Format date
function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Ouvrir le chat
function openChat(userId, userName) {
    currentChatUserId = userId;
    currentChatUserName = userName;
    
    const chatModal = document.getElementById('chatModal');
    const chatUserName = document.getElementById('chatUserName');
    const chatMessages = document.getElementById('chatMessages');
    
    chatUserName.textContent = userName;
    chatModal.classList.add('active');
    
    // Réinitialiser les messages (afficher le message de bienvenue)
    chatMessages.innerHTML = `
        <div class="chat-welcome">
            <p>💬 Commencez la conversation</p>
            <p class="hint">Soyez respectueuse et bienveillante</p>
        </div>
    `;
    
    // Focus sur l'input
    document.getElementById('chatInput').focus();
    
    console.log(`💬 Chat ouvert avec ${userName} (${userId})`);
}

// Fermer le chat
function closeChat() {
    const chatModal = document.getElementById('chatModal');
    chatModal.classList.remove('active');
    currentChatUserId = null;
    currentChatUserName = null;
    
    // Vider l'input
    document.getElementById('chatInput').value = '';
}

// Envoyer un message
function sendMessage() {
    const chatInput = document.getElementById('chatInput');
    const message = chatInput.value.trim();
    
    if (!message || !currentChatUserId) {
        return;
    }
    
    // Envoyer via socket
    socket.emit('send_message', {
        to: currentChatUserId,
        message: message,
        timestamp: new Date().toISOString()
    });
    
    // Afficher le message envoyé
    displayMessage(message, 'sent');
    
    // Vider l'input
    chatInput.value = '';
    chatInput.focus();
    
    console.log(`📤 Message envoyé à ${currentChatUserName}: ${message}`);
}

// Afficher un message dans le chat
function displayMessage(message, type = 'received', timestamp = null) {
    const chatMessages = document.getElementById('chatMessages');
    
    // Supprimer le message de bienvenue s'il existe
    const welcome = chatMessages.querySelector('.chat-welcome');
    if (welcome) {
        welcome.remove();
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${type}`;
    
    const time = timestamp ? new Date(timestamp) : new Date();
    const timeString = time.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    
    messageDiv.innerHTML = `
        <div class="chat-message-text">${escapeHtml(message)}</div>
        <div class="chat-message-time">${timeString}</div>
    `;
    
    chatMessages.appendChild(messageDiv);
    
    // Scroll vers le bas
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Échapper le HTML pour éviter les injections XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Notifications
function showNotification(message, type = 'info') {
    const notifications = document.getElementById('notifications');
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    notifications.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideDown 0.3s ease-out reverse';
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}

// ===== SOCKET.IO =====

socket.on('connect', () => {
    console.log('✅ Connecté');
    showNotification('Connecté', 'success');
});

socket.on('disconnect', () => {
    console.log('❌ Déconnecté');
    showNotification('Déconnecté', 'error');
});

socket.on('users_count', (count) => {
    document.getElementById('usersCount').textContent = count;
});

socket.on('nearby_users', (data) => {
    console.log('👭 Utilisateurs à proximité:', data.users);
    displayNearbyUsers(data.users);
});

socket.on('trip_confirmed', (data) => {
    console.log('✅ Trajet confirmé', data);
    
    currentTrip = data.trip;
    
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = false;
    submitBtn.innerHTML = '💜 Trouver des compagnes';
    
    const tripInfoSection = document.getElementById('tripInfoSection');
    const tripInfo = document.getElementById('tripInfo');
    
    tripInfo.innerHTML = `
        <p><strong>Distance :</strong> ${(data.trip.distance / 1000).toFixed(2)} km</p>
        <p><strong>Durée :</strong> ${Math.round(data.trip.duration / 60)} min</p>
        <p><strong>Points :</strong> ${data.trip.polyline.length}</p>
        ${data.trip.isMock ? '<p style="color: #fb923c;"><strong>⚠️ Simulé</strong></p>' : ''}
    `;
    
    tripInfoSection.style.display = 'block';
    
    if (userPolyline) {
        map.removeLayer(userPolyline);
    }
    
    userPolyline = displayPolyline(data.trip.polyline, '#ff6b9d', 5, 0.8);
    
    const origin = {
        lat: data.trip.polyline[0][0],
        lon: data.trip.polyline[0][1]
    };
    const destination = {
        lat: data.trip.polyline[data.trip.polyline.length - 1][0],
        lon: data.trip.polyline[data.trip.polyline.length - 1][1]
    };
    displayMarkers(origin, destination, '#ff6b9d');
    
    fitMapToPolyline(data.trip.polyline);
    
    showNotification('Trajet enregistré !', 'success');
});

socket.on('matches_update', (data) => {
    console.log('🎯 Matches:', data.matches);
    displayMatches(data.matches);
    
    if (data.matches.length > 0) {
        showNotification(`${data.matches.length} match${data.matches.length > 1 ? 'es' : ''} !`, 'success');
    }
});

socket.on('new_user_joined', (data) => {
    console.log('👋 Nouveau:', data.userName);
    showNotification(`${data.userName} a rejoint !`, 'info');
    requestNearbyUsers();
});

socket.on('user_left', (data) => {
    console.log('👋 Parti:', data.userName);
    showNotification(`${data.userName} est parti`, 'info');
    requestNearbyUsers();
});

socket.on('receive_message', (data) => {
    console.log('📨 Message reçu:', data);
    
    // Si le chat avec cet utilisateur est ouvert, afficher le message
    if (currentChatUserId === data.from) {
        displayMessage(data.message, 'received', data.timestamp);
    } else {
        // Sinon, afficher une notification
        showNotification(`💬 Message de ${data.fromName}`, 'info');
    }
});

socket.on('error', (data) => {
    console.error('❌ Erreur:', data.message);
    showNotification(`Erreur: ${data.message}`, 'error');
    
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = false;
    submitBtn.innerHTML = '💜 Trouver des compagnes';
});
