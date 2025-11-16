// Connexion Socket.io
const socket = io();

// Variables globales
let map;
let userPolyline;
let matchPolylines = [];
let currentTrip = null;
let originAutocomplete;
let destinationAutocomplete;
let googleMapsApiKey = '';

// Initialisation de la carte Leaflet
function initMap() {
    map = L.map('map').setView([48.8566, 2.3522], 12); // Paris par défaut
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);
}

// Initialisation au chargement de la page
document.addEventListener('DOMContentLoaded', async () => {
    initMap();
    setDefaultDepartureTime();
    setupEventListeners();
    await loadGoogleMapsAPI();
});

// Charger l'API Google Maps et initialiser l'autocomplétion
async function loadGoogleMapsAPI() {
    try {
        // Récupérer la clé API depuis le serveur
        const response = await fetch('/api/config');
        const config = await response.json();
        googleMapsApiKey = config.googleMapsApiKey;
        
        if (!googleMapsApiKey || googleMapsApiKey === 'YOUR_API_KEY_HERE') {
            console.warn('⚠️ Clé API Google Maps non configurée. Autocomplétion désactivée.');
            return;
        }
        
        // Charger le script Google Maps
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&libraries=places`;
        script.async = true;
        script.defer = true;
        script.onload = initAutocomplete;
        document.head.appendChild(script);
        
    } catch (error) {
        console.error('Erreur lors du chargement de l\'API Google Maps:', error);
    }
}

// Initialiser l'autocomplétion pour les champs d'adresse
function initAutocomplete() {
    if (typeof google === 'undefined' || !google.maps || !google.maps.places) {
        console.warn('Google Maps Places API non disponible');
        return;
    }
    
    const originInput = document.getElementById('origin');
    const destinationInput = document.getElementById('destination');
    
    // Options pour l'autocomplétion
    const autocompleteOptions = {
        types: ['geocode', 'establishment'],
        fields: ['formatted_address', 'geometry', 'name']
    };
    
    // Initialiser l'autocomplétion pour l'origine
    originAutocomplete = new google.maps.places.Autocomplete(originInput, autocompleteOptions);
    
    // Initialiser l'autocomplétion pour la destination
    destinationAutocomplete = new google.maps.places.Autocomplete(destinationInput, autocompleteOptions);
    
    // Événement quand une adresse est sélectionnée
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
    
    console.log('✅ Autocomplétion Google Places activée');
    showNotification('Autocomplétion d\'adresses activée', 'success');
}

// Configuration de l'heure de départ par défaut (maintenant)
function setDefaultDepartureTime() {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('departureTime').value = now.toISOString().slice(0, 16);
}

// Configuration des écouteurs d'événements
function setupEventListeners() {
    // Soumission du formulaire
    document.getElementById('tripForm').addEventListener('submit', handleTripSubmit);
    
    // Bouton de rafraîchissement
    document.getElementById('refreshBtn').addEventListener('click', () => {
        socket.emit('refresh_matches');
        showNotification('Actualisation des matches...', 'info');
    });
    
    // Bouton de géolocalisation
    document.getElementById('useLocationBtn').addEventListener('click', useCurrentLocation);
}

// Utiliser la position actuelle de l'utilisateur
async function useCurrentLocation() {
    const locationBtn = document.getElementById('useLocationBtn');
    const originInput = document.getElementById('origin');
    
    // Vérifier si la géolocalisation est supportée
    if (!navigator.geolocation) {
        showNotification('La géolocalisation n\'est pas supportée par votre navigateur', 'error');
        return;
    }
    
    // Désactiver le bouton et afficher le chargement
    locationBtn.disabled = true;
    locationBtn.classList.add('loading');
    locationBtn.textContent = '⏳';
    
    try {
        // Obtenir la position
        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            });
        });
        
        const { latitude, longitude } = position.coords;
        console.log(`📍 Position obtenue: ${latitude}, ${longitude}`);
        
        // Géocoder inversement pour obtenir l'adresse
        await reverseGeocode(latitude, longitude, originInput);
        
        showNotification('Position actuelle utilisée !', 'success');
        
    } catch (error) {
        console.error('Erreur de géolocalisation:', error);
        
        let errorMessage = 'Impossible d\'obtenir votre position';
        
        switch(error.code) {
            case error.PERMISSION_DENIED:
                errorMessage = 'Permission de géolocalisation refusée. Veuillez autoriser l\'accès à votre position.';
                break;
            case error.POSITION_UNAVAILABLE:
                errorMessage = 'Position non disponible. Vérifiez vos paramètres de localisation.';
                break;
            case error.TIMEOUT:
                errorMessage = 'Délai d\'attente dépassé pour obtenir votre position.';
                break;
        }
        
        showNotification(errorMessage, 'error');
        
    } finally {
        // Réactiver le bouton
        locationBtn.disabled = false;
        locationBtn.classList.remove('loading');
        locationBtn.textContent = '📍';
    }
}

// Géocodage inverse (coordonnées → adresse)
async function reverseGeocode(lat, lon, inputElement) {
    try {
        // Si Google Maps est chargé, utiliser l'API Geocoding
        if (typeof google !== 'undefined' && google.maps && google.maps.Geocoder) {
            const geocoder = new google.maps.Geocoder();
            const latlng = { lat: lat, lng: lon };
            
            const result = await new Promise((resolve, reject) => {
                geocoder.geocode({ location: latlng }, (results, status) => {
                    if (status === 'OK' && results[0]) {
                        resolve(results[0]);
                    } else {
                        reject(new Error('Geocoding failed: ' + status));
                    }
                });
            });
            
            inputElement.value = result.formatted_address;
            console.log(`📍 Adresse trouvée: ${result.formatted_address}`);
            
        } else {
            // Fallback: utiliser les coordonnées directement
            inputElement.value = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
            console.log('⚠️ Google Maps non chargé, utilisation des coordonnées');
        }
        
    } catch (error) {
        console.error('Erreur de géocodage inverse:', error);
        // En cas d'erreur, utiliser les coordonnées
        inputElement.value = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
    }
}

// Gestion de la soumission du trajet
async function handleTripSubmit(e) {
    e.preventDefault();
    
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '⏳ Calcul en cours...<span class="spinner"></span>';
    
    const originAddress = document.getElementById('origin').value.trim();
    const destinationAddress = document.getElementById('destination').value.trim();
    
    // Validation
    if (!originAddress || !destinationAddress) {
        showNotification('Veuillez remplir les adresses d\'origine et de destination', 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '🔍 Trouver des matches';
        return;
    }
    
    const tripData = {
        userName: document.getElementById('userName').value || null,
        origin: originAddress,
        destination: destinationAddress,
        mode: document.getElementById('mode').value,
        departureTime: document.getElementById('departureTime').value
    };
    
    // Envoi au serveur
    socket.emit('submit_trip', tripData);
}

// Exemples de trajets
function fillExample1() {
    document.getElementById('origin').value = 'Tour Eiffel, Paris';
    document.getElementById('destination').value = 'Musée du Louvre, Paris';
}

function fillExample2() {
    document.getElementById('origin').value = 'Gare du Nord, Paris';
    document.getElementById('destination').value = 'Gare Montparnasse, Paris';
}

function fillExample3() {
    document.getElementById('origin').value = 'Place de la République, Paris';
    document.getElementById('destination').value = 'Place de la Bastille, Paris';
}

// Affichage d'une polyline sur la carte
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

// Affichage des marqueurs origine/destination
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

// Centrer la carte sur une polyline
function fitMapToPolyline(polyline) {
    if (!polyline || polyline.length === 0) return;
    
    const bounds = L.latLngBounds(polyline.map(p => [p[0], p[1]]));
    map.fitBounds(bounds, { padding: [50, 50] });
}

// Affichage des matches
function displayMatches(matches) {
    const matchesList = document.getElementById('matchesList');
    const matchesCount = document.getElementById('matchesCount');
    const refreshBtn = document.getElementById('refreshBtn');
    
    matchesCount.textContent = `${matches.length} match${matches.length > 1 ? 'es' : ''} trouvé${matches.length > 1 ? 's' : ''}`;
    
    if (matches.length > 0) {
        refreshBtn.style.display = 'block';
    }
    
    // Effacer les polylines des matches précédents
    matchPolylines.forEach(line => map.removeLayer(line));
    matchPolylines = [];
    
    if (matches.length === 0) {
        matchesList.innerHTML = `
            <div class="no-matches">
                <p>Aucun match pour le moment.</p>
                <p class="hint">Attendez que d'autres utilisateurs se connectent ou ajustez votre trajet.</p>
            </div>
        `;
        return;
    }
    
    matchesList.innerHTML = '';
    
    matches.forEach((match, index) => {
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
                    <strong>📏 Distance moy.</strong>
                    ${(match.details.avgDistance / 1000).toFixed(2)} km
                </div>
                <div class="match-detail">
                    <strong>🔗 Chevauchement</strong>
                    ${match.details.overlapPercentage}%
                </div>
                <div class="match-detail">
                    <strong>🎯 Score spatial</strong>
                    ${match.details.spatialScore}%
                </div>
                <div class="match-detail">
                    <strong>⏰ Score temporel</strong>
                    ${match.details.temporalScore}%
                </div>
            </div>
            <div class="match-trip-info">
                <strong>Trajet :</strong> ${match.trip.origin.lat.toFixed(4)}, ${match.trip.origin.lon.toFixed(4)} 
                → ${match.trip.destination.lat.toFixed(4)}, ${match.trip.destination.lon.toFixed(4)}
                <br>
                <strong>Mode :</strong> ${getModeName(match.trip.mode)} | 
                <strong>Départ :</strong> ${formatDateTime(match.trip.departureTime)}
            </div>
        `;
        
        matchesList.appendChild(card);
    });
}

// Couleur selon le score
function getScoreColor(score) {
    if (score >= 80) return '#4ade80';
    if (score >= 60) return '#fbbf24';
    if (score >= 40) return '#fb923c';
    return '#ef4444';
}

// Nom du mode de transport
function getModeName(mode) {
    const modes = {
        'transit': '🚇 Transit + Marche',
        'driving': '🚗 Voiture',
        'walking': '🚶 Marche',
        'bicycling': '🚴 Vélo'
    };
    return modes[mode] || mode;
}

// Formatage de la date/heure
function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Affichage des notifications
function showNotification(message, type = 'info') {
    const notifications = document.getElementById('notifications');
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    notifications.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}

// ===== ÉVÉNEMENTS SOCKET.IO =====

// Connexion établie
socket.on('connect', () => {
    console.log('✅ Connecté au serveur');
    const statusIndicator = document.getElementById('connectionStatus');
    statusIndicator.innerHTML = '<span class="dot"></span> Connecté';
    statusIndicator.classList.add('connected');
    showNotification('Connecté au serveur', 'success');
});

// Déconnexion
socket.on('disconnect', () => {
    console.log('❌ Déconnecté du serveur');
    const statusIndicator = document.getElementById('connectionStatus');
    statusIndicator.innerHTML = '<span class="dot"></span> Déconnecté';
    statusIndicator.classList.remove('connected');
    statusIndicator.classList.add('disconnected');
    showNotification('Déconnecté du serveur', 'error');
});

// Mise à jour du nombre d'utilisateurs
socket.on('users_count', (count) => {
    document.getElementById('usersCount').textContent = count;
});

// Confirmation du trajet
socket.on('trip_confirmed', (data) => {
    console.log('✅ Trajet confirmé', data);
    
    currentTrip = data.trip;
    
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = false;
    submitBtn.innerHTML = '🔍 Trouver des matches';
    
    // Afficher les informations du trajet
    const tripInfoSection = document.getElementById('tripInfoSection');
    const tripInfo = document.getElementById('tripInfo');
    
    tripInfo.innerHTML = `
        <p><strong>Distance :</strong> ${(data.trip.distance / 1000).toFixed(2)} km</p>
        <p><strong>Durée estimée :</strong> ${Math.round(data.trip.duration / 60)} minutes</p>
        <p><strong>Points de trajet :</strong> ${data.trip.polyline.length}</p>
        ${data.trip.isMock ? '<p style="color: #fb923c;"><strong>⚠️ Trajet simulé</strong> (API non configurée)</p>' : ''}
    `;
    
    tripInfoSection.style.display = 'block';
    
    // Afficher la polyline sur la carte
    if (userPolyline) {
        map.removeLayer(userPolyline);
    }
    
    userPolyline = displayPolyline(data.trip.polyline, '#667eea', 5, 0.8);
    
    // Afficher les marqueurs
    const origin = {
        lat: data.trip.polyline[0][0],
        lon: data.trip.polyline[0][1]
    };
    const destination = {
        lat: data.trip.polyline[data.trip.polyline.length - 1][0],
        lon: data.trip.polyline[data.trip.polyline.length - 1][1]
    };
    displayMarkers(origin, destination, '#667eea');
    
    // Centrer la carte
    fitMapToPolyline(data.trip.polyline);
    
    showNotification('Trajet enregistré avec succès !', 'success');
});

// Mise à jour des matches
socket.on('matches_update', (data) => {
    console.log('🎯 Matches mis à jour', data.matches);
    displayMatches(data.matches);
    
    if (data.matches.length > 0) {
        showNotification(`${data.matches.length} match${data.matches.length > 1 ? 'es' : ''} trouvé${data.matches.length > 1 ? 's' : ''} !`, 'success');
    }
});

// Nouvel utilisateur rejoint
socket.on('new_user_joined', (data) => {
    console.log('👋 Nouvel utilisateur:', data.userName);
    showNotification(`${data.userName} a rejoint !`, 'info');
});

// Utilisateur parti
socket.on('user_left', (data) => {
    console.log('👋 Utilisateur parti:', data.userName);
    showNotification(`${data.userName} est parti`, 'info');
});

// Erreur
socket.on('error', (data) => {
    console.error('❌ Erreur:', data.message);
    showNotification(`Erreur: ${data.message}`, 'error');
    
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = false;
    submitBtn.innerHTML = '🔍 Trouver des matches';
});
