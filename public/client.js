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
let currentUserName = localStorage.getItem('userName') || `User-${Date.now().toString().slice(-6)}`;
let selectedDepartureTime = 'now';
let sosAlertActive = false;
let sosUserId = null;
let sosMarker = null;
let currentMatches = [];

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
    
    // Initialiser la carte
    initNearbyMap();
    
    setDefaultDepartureTime();
    setupEventListeners();
    await loadGoogleMapsAPI();
    
    // Géolocalisation automatique
    autoGetCurrentLocation();
    
    // Charger le pseudo sauvegardé
    const savedName = localStorage.getItem('userName');
    if (savedName) {
        document.getElementById('userName').value = savedName;
        currentUserName = savedName;
    }
    
    console.log('✅ Application initialisée');
});

// Configuration des événements
function setupEventListeners() {
    // Bottom navbar
    document.getElementById('tripBtn').addEventListener('click', openTripSheet);
    document.getElementById('sosBtn').addEventListener('click', openSOSModal);
    document.getElementById('settingsBtn').addEventListener('click', openSettingsSheet);
    
    // Formulaire
    document.getElementById('tripForm').addEventListener('submit', handleTripSubmit);
    document.getElementById('useLocationBtn').addEventListener('click', useCurrentLocation);
    
    // Time selector
    document.querySelectorAll('.time-option').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.time-option').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            selectedDepartureTime = e.target.dataset.time;
            
            if (selectedDepartureTime === 'custom') {
                document.getElementById('departureTime').style.display = 'block';
            } else {
                document.getElementById('departureTime').style.display = 'none';
            }
        });
    });
    
    // Settings
    document.getElementById('saveUserNameBtn').addEventListener('click', saveUserName);
    
    // SOS Modal
    document.getElementById('cancelSosBtn').addEventListener('click', closeSOSModal);
    document.getElementById('confirmSosBtn').addEventListener('click', sendSOSAlert);
    
    // SOS Alert
    document.getElementById('ignoreSosBtn').addEventListener('click', closeSOSAlert);
    document.getElementById('helpSosBtn').addEventListener('click', helpSOSUser);
    
    // Chat
    document.getElementById('closeChatBtn').addEventListener('click', closeChat);
    document.getElementById('sendMessageBtn').addEventListener('click', sendMessage);
    document.getElementById('chatInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
    
    // Matches modal
    document.getElementById('matchesToggleBtn').addEventListener('click', openMatchesModal);
    document.getElementById('closeMatchesBtn').addEventListener('click', closeMatchesModal);
    document.getElementById('matchesModal').addEventListener('click', (e) => {
        if (e.target.id === 'matchesModal') {
            closeMatchesModal();
        }
    });
    
    // Close bottom sheets on background click
    document.getElementById('tripSheet').addEventListener('click', (e) => {
        if (e.target.id === 'tripSheet') {
            closeTripSheet();
        }
    });
    
    document.getElementById('settingsSheet').addEventListener('click', (e) => {
        if (e.target.id === 'settingsSheet') {
            closeSettingsSheet();
        }
    });
}

// Bottom Sheet Functions
function openTripSheet() {
    document.getElementById('tripSheet').classList.add('active');
}

function closeTripSheet() {
    document.getElementById('tripSheet').classList.remove('active');
}

function openSettingsSheet() {
    document.getElementById('settingsSheet').classList.add('active');
}

function closeSettingsSheet() {
    document.getElementById('settingsSheet').classList.remove('active');
}

// Settings Functions
function saveUserName() {
    const userName = document.getElementById('userName').value.trim();
    if (userName) {
        currentUserName = userName;
        localStorage.setItem('userName', userName);
        showNotification('Pseudo enregistré !', 'success');
        closeSettingsSheet();
    } else {
        showNotification('Veuillez entrer un pseudo', 'error');
    }
}

// SOS Functions
function openSOSModal() {
    document.getElementById('sosModal').classList.add('active');
    // Play alert sound if available
    playAlertSound();
}

function closeSOSModal() {
    document.getElementById('sosModal').classList.remove('active');
}

function sendSOSAlert() {
    if (!currentUserPosition) {
        showNotification('Position non disponible', 'error');
        closeSOSModal();
        return;
    }
    
    // Envoyer l'alerte au serveur
    socket.emit('send_sos', {
        position: currentUserPosition,
        userName: currentUserName,
        timestamp: new Date().toISOString()
    });
    
    sosAlertActive = true;
    closeSOSModal();
    showNotification('🚨 Alerte SOS envoyée !', 'success');
    
    // Vibration si disponible
    if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200]);
    }
}

function closeSOSAlert() {
    document.getElementById('sosAlertModal').classList.remove('active');
    sosUserId = null;
    
    // Retirer le marqueur SOS s'il existe
    if (sosMarker && nearbyMap) {
        nearbyMap.removeLayer(sosMarker);
        sosMarker = null;
    }
}

function helpSOSUser() {
    if (!sosUserId) return;
    
    closeSOSAlert();
    
    // Afficher la position de l'utilisateur en détresse sur la carte
    const sosUser = Array.from(userMarkers.entries()).find(([id]) => id === sosUserId);
    
    if (sosUser && sosUser[1]) {
        const marker = sosUser[1];
        const latLng = marker.getLatLng();
        
        // Centrer la carte sur l'utilisateur
        nearbyMap.setView(latLng, 16);
        
        // Créer un marqueur SOS spécial
        if (sosMarker) {
            nearbyMap.removeLayer(sosMarker);
        }
        
        const sosIcon = L.divIcon({
            className: 'sos-marker',
            html: '🚨',
            iconSize: [50, 50]
        });
        
        sosMarker = L.marker(latLng, { icon: sosIcon })
            .addTo(nearbyMap)
            .bindPopup('<b>🚨 URGENCE</b><br>Cette personne a besoin d\'aide!')
            .openPopup();
        
        // Créer un itinéraire si on a notre position
        if (currentUserPosition) {
            createRouteToSOS(latLng);
        }
        
        showNotification('Position affichée sur la carte', 'info');
    }
}

function createRouteToSOS(destination) {
    if (!currentUserPosition) return;
    
    // Créer une ligne entre notre position et la destination
    const line = L.polyline([
        [currentUserPosition.lat, currentUserPosition.lon],
        [destination.lat, destination.lng]
    ], {
        color: '#ef4444',
        weight: 4,
        opacity: 0.7,
        dashArray: '10, 10'
    }).addTo(nearbyMap);
    
    // Calculer la distance
    const distance = calculateDistance(
        currentUserPosition.lat,
        currentUserPosition.lon,
        destination.lat,
        destination.lng
    );
    
    showNotification(`Distance: ${(distance / 1000).toFixed(2)} km`, 'info');
}

function playAlertSound() {
    // Créer un son d'alerte simple avec Web Audio API
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
    } catch (e) {
        console.log('Audio not available');
    }
}

// Fonction helper pour calculer la distance
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Rayon de la Terre en mètres
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Charger Google Maps API
async function loadGoogleMapsAPI() {
    try {
        const response = await fetch('/api/config');
        const config = await response.json();
        googleMapsApiKey = config.googleMapsApiKey;
        
        if (!googleMapsApiKey || googleMapsApiKey === 'YOUR_API_KEY_HERE') {
            console.warn('⚠️ Clé API non configurée - Utilisation de Nominatim');
            setupNominatimAutocomplete();
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
        setupNominatimAutocomplete();
    }
}

// Autocomplétion Google Maps
function initAutocomplete() {
    if (typeof google === 'undefined' || !google.maps || !google.maps.places) {
        setupNominatimAutocomplete();
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
    
    console.log('✅ Autocomplétion Google Maps activée');
}

// Autocomplétion avec Nominatim (OpenStreetMap)
function setupNominatimAutocomplete() {
    const destinationInput = document.getElementById('destination');
    let timeout;
    let suggestionsDiv = document.getElementById('destination-suggestions');
    
    // Créer le conteneur de suggestions s'il n'existe pas
    if (!suggestionsDiv) {
        suggestionsDiv = document.createElement('div');
        suggestionsDiv.id = 'destination-suggestions';
        suggestionsDiv.className = 'autocomplete-suggestions';
        destinationInput.parentElement.appendChild(suggestionsDiv);
    }
    
    destinationInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        
        clearTimeout(timeout);
        
        if (query.length < 3) {
            suggestionsDiv.style.display = 'none';
            return;
        }
        
        timeout = setTimeout(async () => {
            try {
                const response = await fetch(
                    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=fr&limit=5&addressdetails=1`,
                    {
                        headers: {
                            'User-Agent': 'WonderWomen/1.0'
                        }
                    }
                );
                
                if (response.ok) {
                    const results = await response.json();
                    
                    if (results.length > 0) {
                        suggestionsDiv.innerHTML = '';
                        suggestionsDiv.style.display = 'block';
                        
                        results.forEach(result => {
                            const item = document.createElement('div');
                            item.className = 'autocomplete-item';
                            item.textContent = result.display_name;
                            
                            item.addEventListener('click', () => {
                                destinationInput.value = result.display_name;
                                destinationInput.dataset.lat = result.lat;
                                destinationInput.dataset.lon = result.lon;
                                suggestionsDiv.style.display = 'none';
                            });
                            
                            suggestionsDiv.appendChild(item);
                        });
                    } else {
                        suggestionsDiv.style.display = 'none';
                    }
                }
            } catch (error) {
                console.error('Erreur autocomplétion:', error);
            }
        }, 300);
    });
    
    // Fermer les suggestions en cliquant ailleurs
    document.addEventListener('click', (e) => {
        if (e.target !== destinationInput && !suggestionsDiv.contains(e.target)) {
            suggestionsDiv.style.display = 'none';
        }
    });
    
    console.log('✅ Autocomplétion Nominatim activée');
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
        originInput.placeholder = 'Entrez votre position de départ';
        return;
    }
    
    originInput.placeholder = '📍 Détection en cours...';
    
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
        
        // Essayer le géocodage inverse
        const address = await reverseGeocode(latitude, longitude);
        
        if (address) {
            originInput.value = address;
            originInput.placeholder = 'Position actuelle';
        } else {
            // Si le géocodage échoue, utiliser "Position actuelle" comme texte
            originInput.value = 'Position actuelle';
            originInput.placeholder = 'Position actuelle';
        }
        
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
        originInput.placeholder = 'Entrez votre position de départ';
        originInput.value = '';
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
        
        const address = await reverseGeocode(latitude, longitude);
        
        if (address) {
            originInput.value = address;
        } else {
            originInput.value = 'Position actuelle';
        }
        
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
async function reverseGeocode(lat, lon) {
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
            
            return result.formatted_address;
        } else {
            // Si Google Maps n'est pas disponible, utiliser Nominatim (OpenStreetMap)
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
                {
                    headers: {
                        'User-Agent': 'WonderWomen/1.0'
                    }
                }
            );
            
            if (response.ok) {
                const data = await response.json();
                return data.display_name || null;
            }
            
            return null;
        }
    } catch (error) {
        console.log('Géocodage inverse échoué:', error);
        return null;
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
    
    // Calculer le temps de départ
    let departureTime;
    const now = new Date();
    
    switch(selectedDepartureTime) {
        case 'now':
            departureTime = now.toISOString();
            break;
        case '15':
            departureTime = new Date(now.getTime() + 15 * 60000).toISOString();
            break;
        case '30':
            departureTime = new Date(now.getTime() + 30 * 60000).toISOString();
            break;
        case 'custom':
            const customTime = document.getElementById('departureTime').value;
            departureTime = customTime ? new Date(customTime).toISOString() : now.toISOString();
            break;
        default:
            departureTime = now.toISOString();
    }
    
    const tripData = {
        userName: currentUserName,
        origin: originAddress,
        destination: destinationAddress,
        mode: 'transit', // Toujours transit + marche
        departureTime: departureTime
    };
    
    socket.emit('submit_trip', tripData);
}

// Afficher uniquement les matches sur la carte
function displayMatchesOnMap(matches) {
    const matchesMapCount = document.getElementById('matchesMapCount');
    
    matchesMapCount.textContent = matches.length;
    
    // Effacer anciens marqueurs
    userMarkers.forEach(marker => nearbyMap.removeLayer(marker));
    userMarkers.clear();
    
    if (matches.length === 0) {
        return;
    }
    
    matches.forEach(match => {
        // Marqueur sur la carte uniquement pour les matches
        if (match.trip && match.trip.polyline && match.trip.polyline.length > 0) {
            const firstPoint = match.trip.polyline[0];
            
            const markerIcon = L.divIcon({
                className: 'user-marker',
                html: '👤',
                iconSize: [35, 35]
            });
            
            const marker = L.marker([firstPoint[0], firstPoint[1]], { icon: markerIcon })
                .addTo(nearbyMap)
                .bindPopup(`<b>${match.userName}</b><br>🎯 Match: ${match.similarity}%`);
            
            // Ajouter un événement de clic sur le marqueur
            marker.on('click', () => {
                openChat(match.userId, match.userName);
            });
            
            userMarkers.set(match.userId, marker);
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

// Afficher matches dans la modale
function displayMatchesInModal(matches) {
    const matchesModalContent = document.getElementById('matchesModalContent');
    
    // Sauvegarder les matches actuels
    currentMatches = matches;
    
    if (matches.length === 0) {
        matchesModalContent.innerHTML = `
            <div class="no-matches">
                <p>🔍 Aucun match pour le moment</p>
                <p class="hint">Créez un trajet pour trouver des compagnes</p>
            </div>
        `;
        return;
    }
    
    matchesModalContent.innerHTML = '';
    
    matches.forEach(match => {
        const item = document.createElement('div');
        item.className = 'match-item';
        
        const scoreColor = getScoreColor(match.similarity);
        
        item.innerHTML = `
            <div class="match-item-header">
                <div class="match-item-name">👤 ${match.userName}</div>
                <div class="match-item-score" style="color: ${scoreColor};">${match.similarity}%</div>
            </div>
            <div class="match-item-details">
                <div class="match-item-detail">
                    📏 <strong>${(match.details.avgDistance / 1000).toFixed(1)} km</strong>
                </div>
                <div class="match-item-detail">
                    🔗 <strong>${match.details.overlapPercentage}%</strong>
                </div>
                <div class="match-item-detail">
                    🎯 <strong>${match.details.spatialScore}%</strong>
                </div>
                <div class="match-item-detail">
                    ⏰ <strong>${match.details.temporalScore}%</strong>
                </div>
            </div>
        `;
        
        // Cliquer sur un match pour ouvrir le chat
        item.addEventListener('click', () => {
            closeMatchesModal();
            openChat(match.userId, match.userName);
        });
        
        matchesModalContent.appendChild(item);
    });
}

// Ouvrir la modale des matches
function openMatchesModal() {
    document.getElementById('matchesModal').classList.add('active');
}

// Fermer la modale des matches
function closeMatchesModal() {
    document.getElementById('matchesModal').classList.remove('active');
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

socket.on('matches_update', (data) => {
    console.log('🎯 Matches:', data.matches);
    
    // Afficher les matches sur la carte
    displayMatchesOnMap(data.matches);
    
    // Afficher les matches dans la modale
    displayMatchesInModal(data.matches);
    
    if (data.matches.length > 0) {
        showNotification(`${data.matches.length} match${data.matches.length > 1 ? 'es' : ''} !`, 'success');
    }
});


socket.on('new_user_joined', (data) => {
    console.log('👋 Nouveau:', data.userName);
    showNotification(`${data.userName} a rejoint !`, 'info');
});

socket.on('user_left', (data) => {
    console.log('👋 Parti:', data.userName);
    showNotification(`${data.userName} est parti`, 'info');
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

socket.on('sos_alert', (data) => {
    console.log('🚨 Alerte SOS reçue:', data);
    
    // Afficher la modale d'alerte
    sosUserId = data.userId;
    document.getElementById('sosUserName').textContent = data.userName;
    document.getElementById('sosDistance').textContent = data.distance ? 
        `${(data.distance / 1000).toFixed(1)} km` : 'calcul...';
    
    document.getElementById('sosAlertModal').classList.add('active');
    
    // Son d'alerte
    playAlertSound();
    
    // Vibration
    if (navigator.vibrate) {
        navigator.vibrate([300, 100, 300, 100, 300]);
    }
    
    // Notification visuelle
    showNotification(`🚨 ${data.userName} a besoin d'aide !`, 'error');
});

socket.on('trip_confirmed', (data) => {
    console.log('✅ Trajet confirmé', data);
    
    currentTrip = data.trip;
    
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = false;
    submitBtn.innerHTML = '💜 Trouver des compagnes';
    
    // Fermer le bottom sheet
    closeTripSheet();
    
    showNotification('Trajet enregistré !', 'success');
});

socket.on('error', (data) => {
    console.error('❌ Erreur:', data.message);
    showNotification(`Erreur: ${data.message}`, 'error');
    
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = false;
    submitBtn.innerHTML = '💜 Trouver des compagnes';
});
