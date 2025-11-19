// Connexion Socket.io
const socket = io();

// Classe personnalisée pour les cercles avec taille fixe en pixels
class FixedSizeCircle {
    constructor(options) {
        this.center = options.center;
        this.radiusPixels = options.radiusPixels || 20; // Rayon en pixels
        this.fillColor = options.fillColor || '#ff1493';
        this.fillOpacity = options.fillOpacity || 0.7;
        this.strokeColor = options.strokeColor || '#ff1493';
        this.strokeWeight = options.strokeWeight || 2;
        this.strokeOpacity = options.strokeOpacity || 0.9;
        this.title = options.title || '';
        this.map = options.map;
        this.overlay = null;
        this.listeners = [];

        if (this.map) {
            this.setMap(this.map);
        }
    }

    setMap(map) {
        this.map = map;

        if (this.overlay) {
            this.overlay.setMap(null);
        }

        if (!map) return;

        // Créer l'overlay personnalisé
        this.overlay = new google.maps.OverlayView();
        const self = this;

        this.overlay.onAdd = function() {
            // Conteneur principal
            const container = document.createElement('div');
            container.style.position = 'absolute';
            container.style.width = (self.radiusPixels * 2 + 20) + 'px';
            container.style.height = (self.radiusPixels * 2 + 20) + 'px';
            container.style.pointerEvents = 'none';

            // Halo de dégradé
            const halo = document.createElement('div');
            halo.style.position = 'absolute';
            halo.style.width = '100%';
            halo.style.height = '100%';
            halo.style.borderRadius = '50%';
            halo.style.background = `radial-gradient(circle, ${self.fillColor}33 0%, ${self.fillColor}11 70%, transparent 100%)`;
            container.appendChild(halo);

            // Cercle intérieur
            const layer = document.createElement('div');
            layer.style.position = 'absolute';
            layer.style.width = (self.radiusPixels * 2) + 'px';
            layer.style.height = (self.radiusPixels * 2) + 'px';
            layer.style.borderRadius = '50%';
            layer.style.backgroundColor = self.fillColor;
            layer.style.opacity = self.fillOpacity;
            layer.style.border = self.strokeWeight + 'px solid ' + self.strokeColor;
            layer.style.borderOpacity = self.strokeOpacity;
            layer.style.left = '10px';
            layer.style.top = '10px';
            layer.style.cursor = 'pointer';
            layer.style.zIndex = '10';
            layer.title = self.title;

            // Ajouter les événements au cercle intérieur
            layer.addEventListener('click', function(e) {
                if (self.clickListener) {
                    self.clickListener(e);
                }
            });

            container.appendChild(layer);
            self.layer = layer;
            self.container = container;
            this.getPanes().overlayLayer.appendChild(container);
        };

        this.overlay.draw = function() {
            if (!self.container || !self.center) return;

            const projection = this.getProjection();
            const pos = projection.fromLatLngToDivPixel(self.center);

            self.container.style.left = (pos.x - self.radiusPixels - 10) + 'px';
            self.container.style.top = (pos.y - self.radiusPixels - 10) + 'px';
        };

        this.overlay.onRemove = function() {
            if (self.container && self.container.parentNode) {
                self.container.parentNode.removeChild(self.container);
            }
            self.layer = null;
            self.container = null;
        };

        this.overlay.setMap(map);
    }

    setCenter(center) {
        this.center = center;
        if (this.overlay) {
            this.overlay.draw();
        }
    }

    getCenter() {
        return this.center;
    }

    setRadius(radiusPixels) {
        this.radiusPixels = radiusPixels;
        if (this.layer) {
            this.layer.style.width = (radiusPixels * 2) + 'px';
            this.layer.style.height = (radiusPixels * 2) + 'px';
            if (this.overlay) {
                this.overlay.draw();
            }
        }
    }

    addListener(eventName, callback) {
        if (this.layer) {
            this.layer.addEventListener(eventName, callback);
            this.listeners.push({ event: eventName, callback });
        }
    }
}

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
let emergencyContacts = [];
let safePlaces = [];
let safePlaceMarkers = new Map();

// Safe places data - Locations in Paris with different types
const SAFE_PLACES_DATA = [
    { id: 1, name: "Café du Marais", type: "bar", lat: 48.8595, lng: 2.3640, emoji: "🍷" },
    { id: 2, name: "Pharmacie Centrale", type: "pharmacie", lat: 48.8585, lng: 2.3510, emoji: "💊" },
    { id: 3, name: "Boulangerie Ronde", type: "boulangerie", lat: 48.8555, lng: 2.3480, emoji: "🥐" },
    { id: 4, name: "La Bistrot d'Amis", type: "restaurant", lat: 48.8620, lng: 2.3520, emoji: "🍽️" },
    { id: 5, name: "Bar le Sunset", type: "bar", lat: 48.8575, lng: 2.3600, emoji: "🍸" },
    { id: 6, name: "Police Île-de-France", type: "police", lat: 48.8610, lng: 2.3560, emoji: "🚔" },
    { id: 7, name: "Pharmacie Saint-Paul", type: "pharmacie", lat: 48.8570, lng: 2.3650, emoji: "💊" },
    { id: 8, name: "Restaurant Le Petit Pont", type: "restaurant", lat: 48.8530, lng: 2.3490, emoji: "🍽️" },
    { id: 9, name: "Café Lumière", type: "bar", lat: 48.8650, lng: 2.3600, emoji: "☕" },
    { id: 10, name: "Boulangerie du Centre", type: "boulangerie", lat: 48.8610, lng: 2.3480, emoji: "🥐" },
    { id: 11, name: "Station RATP Notre-Dame", type: "transport", lat: 48.8530, lng: 2.3500, emoji: "🚇" },
    { id: 12, name: "Hôpital Saint-Louis", type: "hopital", lat: 48.8720, lng: 2.3640, emoji: "🏥" },
    { id: 13, name: "Commissariat 4e Arrondissement", type: "police", lat: 48.8550, lng: 2.3550, emoji: "🚔" },
    { id: 14, name: "Pharmacie Rivoli", type: "pharmacie", lat: 48.8620, lng: 2.3450, emoji: "💊" },
    { id: 15, name: "Bistro des Vosges", type: "bar", lat: 48.8610, lng: 2.3700, emoji: "🍷" },
    { id: 16, name: "Métro Guy Moquet", type: "transport", lat: 48.8864, lng: 2.3407, emoji: "🚇" },
    { id: 17, name: "Café Opéra - 9e Arrondissement", type: "bar", lat: 48.8730, lng: 2.3410, emoji: "☕" },
    { id: 18, name: "Café Parc Monceau", type: "bar", lat: 48.8807, lng: 2.3015, emoji: "☕" },
    { id: 19, name: "Brasserie Avenue de Clichy", type: "restaurant", lat: 48.8861, lng: 2.3260, emoji: "🍽️" }
];

// Initialisation de la carte Google Maps avec l'API native
function initNearbyMap() {
    const nearbyMapElement = document.getElementById('nearbyMap');
    if (!nearbyMapElement) {
        console.warn('Nearby map element not found');
        return;
    }

    try {
        // Vérifier que Google Maps est chargé
        if (typeof google === 'undefined' || !google.maps) {
            console.error('❌ Google Maps API non disponible');
            return;
        }

        // Créer une nouvelle carte Google Maps native
        nearbyMap = new google.maps.Map(nearbyMapElement, {
            zoom: 13,
            center: { lat: 48.8566, lng: 2.3522 },
            mapTypeId: 'roadmap',
            gestureHandling: 'greedy',
            scrollwheel: true,
            draggableCursor: 'grab',
            draggingCursor: 'grabbing',
            disableDefaultUI: true,
            zoomControl: false,
            mapTypeControl: false,
            scaleControl: false,
            fullscreenControl: false,
            streetViewControl: false,
            styles: [
              {
                "elementType": "geometry",
                "stylers": [
                  {"color": "#f5f5f5"}
                ]
              },
              {
                "elementType": "labels.icon",
                "stylers": [
                  {"visibility": "off"}
                ]
              },
              {
                "elementType": "labels.text.fill",
                "stylers": [
                  {"color": "#616161"}
                ]
              },
              {
                "elementType": "labels.text.stroke",
                "stylers": [
                  {"color": "#f5f5f5"}
                ]
              },
              {
                "featureType": "administrative",
                "elementType": "geometry.stroke",
                "stylers": [
                  {"color": "#bdbdbd"}
                ]
              },
              {
                "featureType": "landscape",
                "elementType": "geometry",
                "stylers": [
                  {"color": "#eeeeee"}
                ]
              },
              {
                "featureType": "poi",
                "elementType": "geometry",
                "stylers": [
                  {"color": "#eeeeee"}
                ]
              },
              {
                "featureType": "poi.park",
                "elementType": "geometry",
                "stylers": [
                  {"color": "#c8e6c9"}
                ]
              },
              {
                "featureType": "road",
                "elementType": "geometry",
                "stylers": [
                  {"color": "#ffffff"}
                ]
              },
              {
                "featureType": "road.arterial",
                "elementType": "geometry",
                "stylers": [
                  {"color": "#f5f5f5"}
                ]
              },
              {
                "featureType": "road.highway",
                "elementType": "geometry",
                "stylers": [
                  {"color": "#f0e3e3"}
                ]
              },
              {
                "featureType": "road.highway",
                "elementType": "geometry.stroke",
                "stylers": [
                  {"color": "#e5998c"}
                ]
              },
              {
                "featureType": "transit",
                "elementType": "geometry",
                "stylers": [
                  {"color": "#f0f0f0"}
                ]
              },
              {
                "featureType": "water",
                "elementType": "geometry",
                "stylers": [
                  {"color": "#b3e5fc"}
                ]
              }
            ]
        });

        console.log('✅ Google Maps initialisée sur la carte de proximité');
    } catch (error) {
        console.error('Error initializing nearby map:', error);
    }
}

// Initialisation de la carte principale (non utilisée pour le moment)
function initMap() {
    const mapElement = document.getElementById('map');
    if (!mapElement) {
        console.warn('Map element not found');
        return;
    }

    try {
        if (typeof google === 'undefined' || !google.maps) {
            console.warn('Google Maps API non disponible');
            return;
        }

        map = new google.maps.Map(mapElement, {
            zoom: 12,
            center: { lat: 48.8566, lng: 2.3522 },
            mapTypeId: 'roadmap',
            gestureHandling: 'greedy',
            scrollwheel: true,
            draggableCursor: 'grab',
            draggingCursor: 'grabbing',
            disableDefaultUI: true,
            zoomControl: false,
            mapTypeControl: false,
            scaleControl: false,
            fullscreenControl: false,
            streetViewControl: false
        });

        console.log('✅ Google Maps chargée sur la carte principale');
    } catch (error) {
        console.error('Error initializing map:', error);
    }
}

// Initialisation au chargement
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Initialisation de l\'application...');

    setDefaultDepartureTime();
    setupEventListeners();

    // Charger l'API Google Maps EN PREMIER
    await loadGoogleMapsAPI();

    // Initialiser la carte APRÈS avoir chargé Google Maps
    initNearbyMap();

    // Attendre un petit peu que la carte soit vraiment prête
    await new Promise(resolve => setTimeout(resolve, 500));

    // Géolocalisation automatique
    autoGetCurrentLocation();
    
    // Charger le pseudo sauvegardé
    const savedName = localStorage.getItem('userName');
    if (savedName) {
        document.getElementById('userName').value = savedName;
        currentUserName = savedName;
    }

    // Charger les contacts de secours
    loadEmergencyContacts();

    console.log('✅ Application initialisée');
});

// Configuration des événements
function setupEventListeners() {
    // Bottom navbar
    document.getElementById('tripBtn').addEventListener('click', openTripSheet);
    document.getElementById('sosBtn').addEventListener('click', openSOSModal);
    document.getElementById('safePlacesBtn').addEventListener('click', openSafePlacesSheet);
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
    document.getElementById('addEmergencyContactBtn').addEventListener('click', openAddEmergencyContactModal);
    
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
        // Fermer si on clique sur le fond (pas sur le conteneur)
        if (e.currentTarget === e.target || e.target.id === 'matchesModal') {
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

    document.getElementById('safePlacesSheet').addEventListener('click', (e) => {
        if (e.target.id === 'safePlacesSheet') {
            closeSafePlacesSheet();
        }
    });


    // Close bottom sheets by clicking on the top overlay area
    document.addEventListener('click', (e) => {
        const tripSheet = document.getElementById('tripSheet');
        const settingsSheet = document.getElementById('settingsSheet');
        const safePlacesSheet = document.getElementById('safePlacesSheet');
        const navBar = document.querySelector('.bottom-navbar');

        // Don't close if clicking on nav buttons or inside an open sheet
        if (navBar.contains(e.target)) {
            return;
        }

        // Check if click is on the overlay (pseudo-element) of an active bottom sheet
        if (tripSheet.classList.contains('active') && !tripSheet.contains(e.target)) {
            closeTripSheet();
        } else if (settingsSheet.classList.contains('active') && !settingsSheet.contains(e.target)) {
            closeSettingsSheet();
        } else if (safePlacesSheet.classList.contains('active') && !safePlacesSheet.contains(e.target)) {
            closeSafePlacesSheet();
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

function openSafePlacesSheet() {
    document.getElementById('safePlacesSheet').classList.add('active');
    displaySafePlaces();
}

function closeSafePlacesSheet() {
    document.getElementById('safePlacesSheet').classList.remove('active');
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

// Charger les contacts de secours depuis localStorage
function loadEmergencyContacts() {
    const saved = localStorage.getItem('emergencyContacts');
    if (saved) {
        emergencyContacts = JSON.parse(saved);
    }
    displayEmergencyContacts();
}

// Afficher les contacts de secours
function displayEmergencyContacts() {
    const list = document.getElementById('emergencyContactsList');
    list.innerHTML = '';

    if (emergencyContacts.length === 0) {
        list.innerHTML = '<p class="settings-hint">Aucun contact enregistré</p>';
        return;
    }

    emergencyContacts.forEach((contact, index) => {
        const contactDiv = document.createElement('div');
        contactDiv.className = 'emergency-contact-item';
        contactDiv.innerHTML = `
            <div class="emergency-contact-info">
                <div class="emergency-contact-name">👤 ${contact.name}</div>
                <div class="emergency-contact-phone">📱 ${contact.phone}</div>
            </div>
            <button type="button" class="btn-delete" onclick="deleteEmergencyContact(${index})">
                ✕
            </button>
        `;
        list.appendChild(contactDiv);
    });
}

// Ouvrir le modal pour ajouter un contact
function openAddEmergencyContactModal() {
    const name = prompt('Nom du contact:');
    if (!name || !name.trim()) {
        return;
    }

    const phone = prompt('Numéro de téléphone:');
    if (!phone || !phone.trim()) {
        return;
    }

    addEmergencyContact(name.trim(), phone.trim());
}

// Ajouter un contact de secours
function addEmergencyContact(name, phone) {
    emergencyContacts.push({
        name: name,
        phone: phone
    });

    // Sauvegarder dans localStorage
    localStorage.setItem('emergencyContacts', JSON.stringify(emergencyContacts));
    displayEmergencyContacts();
    showNotification('Contact ajouté !', 'success');
}

// Supprimer un contact
function deleteEmergencyContact(index) {
    if (confirm('Êtes-vous sûre de vouloir supprimer ce contact ?')) {
        emergencyContacts.splice(index, 1);
        localStorage.setItem('emergencyContacts', JSON.stringify(emergencyContacts));
        displayEmergencyContacts();
        showNotification('Contact supprimé', 'success');
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
            html: '<img src="/sos.png" style="width: 32px; height: 32px; filter: drop-shadow(0 2px 5px rgba(0,0,0,0.3));">',
            iconSize: [32, 32]
        });
        
        sosMarker = L.marker(latLng, { icon: sosIcon })
            .addTo(nearbyMap)
            .bindPopup('<b><img src="/sos.png" style="width: 20px; height: 20px; vertical-align: middle; margin-right: 4px;"> URGENCE</b><br>Cette personne a besoin d\'aide!')
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

        // Créer une Promise qui se résout quand le script est chargé
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&libraries=places`;
            script.async = true;

            script.onload = () => {
                console.log('✅ Google Maps API chargée');
                window.googleMapsApiKey = googleMapsApiKey;
                initAutocomplete();
                resolve();
            };

            script.onerror = () => {
                console.error('❌ Erreur chargement Google Maps');
                setupNominatimAutocomplete();
                resolve(); // On continue même en cas d'erreur
            };

            document.head.appendChild(script);
        });

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
        console.warn('⚠️ Géolocalisation non supportée par le navigateur');
        originInput.placeholder = 'Entrez votre position de départ';
        return;
    }

    originInput.placeholder = '📍 Détection en cours...';

    try {
        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: false, // Désactiver pour éviter les timeouts
                timeout: 15000,
                maximumAge: 0
            });
        });

        const { latitude, longitude } = position.coords;
        currentUserPosition = { lat: latitude, lon: longitude };

        console.log(`📍 Position détectée: ${latitude}, ${longitude}`);

        // Afficher la position sur la carte EN PREMIER
        displayUserLocationOnMap(latitude, longitude);

        // Essayer le géocodage inverse en arrière-plan
        try {
            const address = await reverseGeocode(latitude, longitude);
            if (address) {
                originInput.value = address;
                originInput.placeholder = 'Position actuelle';
            } else {
                originInput.value = 'Position actuelle';
                originInput.placeholder = 'Position actuelle';
            }
        } catch (e) {
            console.log('⚠️ Géocodage inverse échoué, utilisation de "Position actuelle"');
            originInput.value = 'Position actuelle';
            originInput.placeholder = 'Position actuelle';
        }

        // Envoyer au serveur
        socket.emit('update_position', { lat: latitude, lon: longitude });
        showNotification('📍 Position détectée', 'success');

    } catch (error) {
        console.warn('⚠️ Géolocalisation échouée:', error.message);
        originInput.placeholder = 'Entrez votre position de départ';
        originInput.value = '';
        showNotification('Géolocalisation non disponible', 'info');
    }
}

// Fonction helper pour afficher la position sur la carte
function displayUserLocationOnMap(latitude, longitude) {
    if (!nearbyMap) {
        console.warn('⚠️ La carte n\'est pas encore prête');
        return;
    }

    try {
        nearbyMap.setCenter({ lat: latitude, lng: longitude });
        nearbyMap.setZoom(14);

        // Effacer l'ancien marqueur s'il existe
        if (myMarker) {
            myMarker.setMap(null);
        }

        // Créer un cercle rose (magenta) pour la position actuelle avec taille fixe
        myMarker = new FixedSizeCircle({
            center: { lat: latitude, lng: longitude },
            radiusPixels: 14, // 14 pixels - taille fixe à l'écran
            map: nearbyMap,
            fillColor: '#ff1493',
            fillOpacity: 0.7,
            strokeColor: '#ff1493',
            strokeWeight: 2,
            strokeOpacity: 0.9,
            title: 'Vous êtes ici'
        });

        // Afficher les lieux sûrs sur la carte
        displaySafePlacesOnMap();

        console.log('✅ Position affichée sur la carte');
    } catch (error) {
        console.error('❌ Erreur lors de l\'affichage de la position:', error);
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

        // Mettre à jour la position sur la carte
        if (nearbyMap) {
            nearbyMap.setCenter({ lat: latitude, lng: longitude });
            nearbyMap.setZoom(14);

            // Effacer l'ancien marqueur s'il existe
            if (myMarker) {
                myMarker.setMap(null);
            }

            myMarker = new google.maps.Circle({
                center: { lat: latitude, lng: longitude },
                radius: 30, // 30 mètres (plus petit)
                map: nearbyMap,
                fillColor: '#ff1493',
                fillOpacity: 0.7,
                strokeColor: '#ff1493',
                strokeWeight: 2,
                strokeOpacity: 0.9,
                title: 'Vous êtes ici'
            });
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

// Afficher uniquement les matches sur la carte avec cercles rouges et trajets
function displayMatchesOnMap(matches) {
    const matchesMapCount = document.getElementById('matchesMapCount');

    matchesMapCount.textContent = matches.length;

    // Effacer anciens marqueurs/cercles et polylines
    userMarkers.forEach(marker => marker.setMap(null));
    userMarkers.clear();

    // Effacer les anciens polylines (stocker dans matchPolylines)
    matchPolylines.forEach(line => line.setMap(null));
    matchPolylines = [];

    if (matches.length === 0) {
        return;
    }

    matches.forEach(match => {
        // Afficher la position de chaque match avec un cercle rouge
        if (match.trip && match.trip.polyline && match.trip.polyline.length > 0) {
            // Afficher le trajet du match en ligne violet/bleu
            const polyline = displayPolyline(match.trip.polyline, '#8b5cf6', 3, 0.7);
            if (polyline) {
                matchPolylines.push(polyline);
            }

            const firstPoint = match.trip.polyline[0];
            const lat = firstPoint[0];
            const lng = firstPoint[1];

            // Créer un cercle rouge pour représenter la position du match avec taille fixe
            const circle = new FixedSizeCircle({
                center: { lat: lat, lng: lng },
                radiusPixels: 14, // 14 pixels - taille fixe à l'écran
                map: nearbyMap,
                fillColor: '#ff0000',
                fillOpacity: 0.7,
                strokeColor: '#ff0000',
                strokeWeight: 2,
                strokeOpacity: 0.9,
                title: `${match.userName} - ${match.similarity}%`
            });

            // Ajouter un écouteur de clic
            circle.addListener('click', () => {
                openChat(match.userId, match.userName);
            });

            userMarkers.set(match.userId, circle);
        }
    });
}

// Afficher polyline sur Google Maps
function displayPolyline(polyline, color = '#667eea', weight = 4, opacity = 0.7) {
    if (!polyline || polyline.length === 0 || !nearbyMap) return null;

    // Convertir les points du polyline en LatLng pour Google Maps
    const path = polyline.map(point => ({ lat: point[0], lng: point[1] }));

    // Créer une polyline Google Maps
    const line = new google.maps.Polyline({
        path: path,
        geodesic: true,
        strokeColor: color,
        strokeOpacity: opacity,
        strokeWeight: weight,
        map: nearbyMap
    });

    return line;
}

// Afficher les lieux sûrs sur la carte
function displaySafePlacesOnMap() {
    // Effacer les anciens marqueurs de lieux sûrs
    safePlaceMarkers.forEach(marker => marker.setMap(null));
    safePlaceMarkers.clear();

    if (!nearbyMap || !currentUserPosition) {
        return;
    }

    SAFE_PLACES_DATA.forEach(place => {
        // Créer un marqueur personnalisé pour chaque lieu sûr avec l'image safe.png
        const marker = new google.maps.Marker({
            position: { lat: place.lat, lng: place.lng },
            map: nearbyMap,
            title: `${place.name}`,
            icon: {
                url: '/safe.png',
                scaledSize: new google.maps.Size(28, 28),
                origin: new google.maps.Point(0, 0),
                anchor: new google.maps.Point(14, 14)
            }
        });

        // Ajouter un listener pour afficher les infos du lieu
        marker.addListener('click', () => {
            const distance = calculateDistance(
                currentUserPosition.lat,
                currentUserPosition.lon,
                place.lat,
                place.lng
            );
            const typeTranslated = getTypeTranslation(place.type);
            let distanceText;
            if (isNaN(distance) || distance === undefined) {
                distanceText = '-- --';
            } else if (distance < 1000) {
                distanceText = Math.round(distance) + ' M';
            } else {
                distanceText = (distance / 1000).toFixed(1) + ' KM';
            }
            // Afficher un popup au-dessus de l'icône
            displaySafePlacePopup(marker, place, typeTranslated, distanceText);
            // Afficher aussi les détails dans un bottom sheet
            displaySafePlaceDetails(place, typeTranslated, distanceText);
        });

        safePlaceMarkers.set(place.id, marker);
    });
}

// Afficher un popup au-dessus de l'icône du lieu sûr
function displaySafePlacePopup(marker, place, typeTranslated, distanceText) {
    // Fermer les anciens popups
    const oldPopups = document.querySelectorAll('.safe-place-popup');
    oldPopups.forEach(popup => popup.remove());

    // Créer le popup
    const popup = document.createElement('div');
    popup.className = 'safe-place-popup';
    popup.innerHTML = `
        <div class="safe-place-popup-arrow"></div>
        <div class="safe-place-popup-content">
            <div class="safe-place-popup-name">${place.name}</div>
            <div class="safe-place-popup-type">${typeTranslated}</div>
            <div class="safe-place-popup-distance">📍 ${distanceText}</div>
        </div>
    `;

    // Ajouter le popup au body
    document.body.appendChild(popup);

    console.log('✅ Popup créé pour:', place.name);

    // Créer une classe pour la projection
    class PopupOverlay extends google.maps.OverlayView {
        constructor() {
            super();
        }

        onAdd() {
            console.log('🗺️ OverlayView ajouté, calcul de la position...');
            const projection = this.getProjection();
            const pos = projection.fromLatLngToContainerPixel(marker.getPosition());

            if (pos) {
                const popupWidth = popup.offsetWidth || 200;
                const popupHeight = popup.offsetHeight || 80;
                // Positionner au-dessus du marqueur (avec un peu de décalage)
                popup.style.left = (pos.x - popupWidth / 2) + 'px';
                popup.style.top = (pos.y - popupHeight - 20) + 'px';
                console.log('📍 Position calculée:', pos.x, pos.y);
            } else {
                console.warn('⚠️ Position non calculée, utilisation de la position par défaut');
                popup.style.left = '50%';
                popup.style.top = '50%';
                popup.style.transform = 'translate(-50%, -50%)';
            }
        }

        draw() {}

        onRemove() {}
    }

    // Ajouter l'overlay à la carte pour accéder à la projection
    const overlay = new PopupOverlay();
    overlay.setMap(nearbyMap);

    // Attendre un peu puis retirer l'overlay car on n'en a besoin que pour calculer la position
    setTimeout(() => {
        overlay.setMap(null);
    }, 100);

    // Fermer le popup quand on clique ailleurs
    const closePopup = (e) => {
        if (!popup.contains(e.target)) {
            console.log('🔒 Fermeture du popup');
            popup.remove();
            document.removeEventListener('click', closePopup);
        }
    };

    setTimeout(() => {
        document.addEventListener('click', closePopup);
    }, 100);
}

// Calculer la distance entre deux points (Haversine)
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

// Traduire les types de lieux sûrs
function getTypeTranslation(type) {
    const translations = {
        'bar': 'Bar',
        'restaurant': 'Restaurant',
        'pharmacie': 'Pharmacie',
        'boulangerie': 'Boulangerie',
        'pharmacy': 'Pharmacie',
        'bakery': 'Boulangerie'
    };
    return translations[type] || type;
}

// Afficher la liste des lieux sûrs triés par distance
function displaySafePlaces() {
    const listContainer = document.getElementById('safePlacesList');

    if (!currentUserPosition) {
        listContainer.innerHTML = '<p class="error-text">Location unavailable</p>';
        return;
    }

    // Calculer la distance pour chaque lieu sûr
    // Note: currentUserPosition uses 'lon', not 'lng'
    const placesWithDistance = SAFE_PLACES_DATA.map(place => ({
        ...place,
        distance: calculateDistance(
            currentUserPosition.lat,
            currentUserPosition.lon,
            place.lat,
            place.lng
        )
    }));

    // Trier par distance
    placesWithDistance.sort((a, b) => a.distance - b.distance);

    // Générer le HTML
    if (placesWithDistance.length === 0) {
        listContainer.innerHTML = '<p class="error-text">No safe places found</p>';
        return;
    }

    listContainer.innerHTML = '';

    placesWithDistance.forEach(place => {
        const typeTranslated = getTypeTranslation(place.type);
        let distanceText;
        if (isNaN(place.distance) || place.distance === undefined) {
            distanceText = '-- --';
        } else if (place.distance < 1000) {
            distanceText = Math.round(place.distance) + ' M';
        } else {
            distanceText = (place.distance / 1000).toFixed(1) + ' KM';
        }

        const itemDiv = document.createElement('div');
        itemDiv.className = 'safe-place-item';
        itemDiv.innerHTML = `
            <div class="safe-place-emoji"><img src="/safe.png" style="width: 32px; height: 32px;"></div>
            <div class="safe-place-info">
                <div class="safe-place-name">${place.name}</div>
                <div class="safe-place-type">${typeTranslated}</div>
            </div>
            <div class="safe-place-distance">${distanceText}</div>
        `;

        // Ajouter un écouteur de clic pour afficher la safe place sur la carte
        itemDiv.addEventListener('click', () => {
            // Centrer la carte sur le lieu sûr
            if (nearbyMap) {
                nearbyMap.setCenter({ lat: place.lat, lng: place.lng });
                nearbyMap.setZoom(16);
            }
        });

        // Ajouter un curseur pointeur
        itemDiv.style.cursor = 'pointer';

        listContainer.appendChild(itemDiv);
    });
}

// Afficher les détails d'un lieu sûr dans un bottom sheet
function displaySafePlaceDetails(place, typeTranslated, distanceText) {
    const detailsSheet = document.createElement('div');
    detailsSheet.className = 'safe-place-details-modal';
    detailsSheet.innerHTML = `
        <div class="safe-place-details-content">
            <div class="safe-place-details-header">
                <button class="close-btn" onclick="document.querySelector('.safe-place-details-modal').remove()">✕</button>
                <img src="/safe.png" style="width: 50px; height: 50px; margin: 10px auto;">
            </div>
            <h2>${place.name}</h2>
            <div class="safe-place-details-info">
                <div class="detail-row">
                    <span class="detail-label">Type:</span>
                    <span class="detail-value">${typeTranslated}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Distance:</span>
                    <span class="detail-value">${distanceText}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Coordonnées:</span>
                    <span class="detail-value">${place.lat.toFixed(4)}, ${place.lng.toFixed(4)}</span>
                </div>
            </div>
            <button class="action-btn" onclick="centerMapOnPlace(${place.lat}, ${place.lng})">Voir sur la carte</button>
        </div>
    `;
    document.body.appendChild(detailsSheet);

    // Fermer au clic extérieur
    detailsSheet.addEventListener('click', (e) => {
        if (e.target === detailsSheet) {
            detailsSheet.remove();
        }
    });
}

// Centrer la carte sur un lieu
function centerMapOnPlace(lat, lng) {
    if (nearbyMap) {
        nearbyMap.setCenter({ lat: lat, lng: lng });
        nearbyMap.setZoom(16);
    }
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

    // Afficher ton trajet personnel en bleu/cyan (EN DESSOUS des matches)
    if (currentTrip && currentTrip.polyline && currentTrip.polyline.length > 0) {
        if (userPolyline) {
            userPolyline.setMap(null);
        }
        userPolyline = displayPolyline(currentTrip.polyline, '#0084ff', 5, 0.8);
    }

    // Afficher les matches sur la carte (par-dessus ton trajet)
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

    // Afficher ton trajet personnel sur la carte (en bleu/cyan)
    if (currentTrip && currentTrip.polyline && currentTrip.polyline.length > 0) {
        console.log('🗺️ Affichage de ton itinéraire personnel sur la carte');
        if (userPolyline) {
            userPolyline.setMap(null);
        }
        userPolyline = displayPolyline(currentTrip.polyline, '#0084ff', 5, 0.8);

        // Centrer la carte sur ton trajet
        if (nearbyMap && currentTrip.polyline.length > 0) {
            const bounds = new google.maps.LatLngBounds();
            currentTrip.polyline.forEach(point => {
                bounds.extend({ lat: point[0], lng: point[1] });
            });
            nearbyMap.fitBounds(bounds, { padding: 100 });
        }
    }

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
