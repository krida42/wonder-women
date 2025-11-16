const axios = require('axios');

/**
 * Convertit une adresse en coordonnées géographiques via Google Maps Geocoding API
 * @param {string} address - Adresse à géocoder
 * @returns {Promise<Object>} Objet contenant {lat, lon, formattedAddress}
 */
async function geocodeAddress(address) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  
  if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
    console.warn('⚠️  Clé API Google Maps non configurée. Utilisation de coordonnées par défaut.');
    // Retourner des coordonnées par défaut pour Paris
    return {
      lat: 48.8566 + (Math.random() - 0.5) * 0.1,
      lon: 2.3522 + (Math.random() - 0.5) * 0.1,
      formattedAddress: address
    };
  }

  try {
    const url = 'https://maps.googleapis.com/maps/api/geocode/json';

    const response = await axios.get(url, {
      params: {
        address: address,
        key: apiKey
      },
      timeout: 5000 // 5 secondes de timeout
    });

    if (response.data.status !== 'OK' || response.data.results.length === 0) {
      console.warn(`⚠️  Geocoding failed for "${address}": ${response.data.status}. Using mock coordinates.`);
      // Retourner des coordonnées par défaut en cas d'erreur
      return {
        lat: 48.8566 + (Math.random() - 0.5) * 0.1,
        lon: 2.3522 + (Math.random() - 0.5) * 0.1,
        formattedAddress: address
      };
    }

    const result = response.data.results[0];
    const location = result.geometry.location;

    return {
      lat: location.lat,
      lon: location.lng,
      formattedAddress: result.formatted_address
    };

  } catch (error) {
    console.error('⚠️  Erreur lors du géocodage:', error.message);
    // Retourner des coordonnées par défaut au lieu de lever une erreur
    console.log('Utilisation de coordonnées par défaut pour:', address);
    return {
      lat: 48.8566 + (Math.random() - 0.5) * 0.1,
      lon: 2.3522 + (Math.random() - 0.5) * 0.1,
      formattedAddress: address
    };
  }
}

/**
 * Décode une polyline encodée Google Maps en tableau de coordonnées [lat, lon]
 * @param {string} encoded - Polyline encodée
 * @returns {Array} Tableau de coordonnées [[lat, lon], ...]
 */
function decodePolyline(encoded) {
  const poly = [];
  let index = 0, len = encoded.length;
  let lat = 0, lng = 0;

  while (index < len) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    poly.push([lat / 1e5, lng / 1e5]);
  }

  return poly;
}

/**
 * Appelle l'API Google Maps Directions pour obtenir un itinéraire
 * @param {Object} params - Paramètres du trajet
 * @param {Object} params.origin - Origine {lat, lon}
 * @param {Object} params.destination - Destination {lat, lon}
 * @param {string} params.mode - Mode de transport (transit, driving, walking, bicycling)
 * @param {string} params.departureTime - Heure de départ (timestamp ou 'now')
 * @returns {Promise<Object>} Objet contenant la polyline décodée et les infos du trajet
 */
async function getDirections(params) {
  const { origin, destination, mode = 'transit', departureTime = 'now' } = params;
  
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  
  if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
    console.warn('⚠️  Clé API Google Maps non configurée. Utilisation de données simulées.');
    return generateMockRoute(origin, destination);
  }

  try {
    const url = 'https://maps.googleapis.com/maps/api/directions/json';

    const response = await axios.get(url, {
      params: {
        origin: `${origin.lat},${origin.lon}`,
        destination: `${destination.lat},${destination.lon}`,
        mode: mode,
        departure_time: departureTime === 'now' ? 'now' : Math.floor(new Date(departureTime).getTime() / 1000),
        key: apiKey,
        alternatives: false
      },
      timeout: 8000 // 8 secondes de timeout
    });

    if (response.data.status !== 'OK') {
      console.warn(`⚠️  Directions API Error: ${response.data.status}. Using mock route.`);
      return generateMockRoute(origin, destination);
    }

    const route = response.data.routes[0];
    const leg = route.legs[0];
    const polylineEncoded = route.overview_polyline.points;
    const polylineDecoded = decodePolyline(polylineEncoded);

    return {
      polyline: polylineDecoded,
      distance: leg.distance.value, // en mètres
      duration: leg.duration.value, // en secondes
      startAddress: leg.start_address,
      endAddress: leg.end_address,
      steps: leg.steps.length
    };

  } catch (error) {
    console.warn('⚠️  Erreur lors de l\'appel à Google Maps Directions API:', error.message);

    // En cas d'erreur, retourner une route simulée
    console.log('Utilisation de données simulées pour le trajet');
    return generateMockRoute(origin, destination);
  }
}

/**
 * Génère une route simulée (ligne droite avec quelques points intermédiaires)
 * Utilisé quand l'API n'est pas disponible ou pour les tests
 */
function generateMockRoute(origin, destination) {
  const points = 10; // Nombre de points intermédiaires
  const polyline = [];
  
  for (let i = 0; i <= points; i++) {
    const ratio = i / points;
    const lat = origin.lat + (destination.lat - origin.lat) * ratio;
    const lon = origin.lon + (destination.lon - origin.lon) * ratio;
    polyline.push([lat, lon]);
  }

  // Calcul approximatif de la distance (formule haversine simplifiée)
  const R = 6371000; // Rayon de la Terre en mètres
  const dLat = (destination.lat - origin.lat) * Math.PI / 180;
  const dLon = (destination.lon - origin.lon) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(origin.lat * Math.PI / 180) * Math.cos(destination.lat * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;

  return {
    polyline: polyline,
    distance: Math.round(distance),
    duration: Math.round(distance / 1.4), // ~5 km/h vitesse moyenne
    startAddress: `${origin.lat}, ${origin.lon}`,
    endAddress: `${destination.lat}, ${destination.lon}`,
    steps: points,
    isMock: true
  };
}

module.exports = {
  getDirections,
  decodePolyline,
  geocodeAddress
};
