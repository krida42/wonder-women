/**
 * Calcule la distance haversine entre deux points (en mètres)
 * @param {number} lat1 - Latitude du point 1
 * @param {number} lon1 - Longitude du point 1
 * @param {number} lat2 - Latitude du point 2
 * @param {number} lon2 - Longitude du point 2
 * @returns {number} Distance en mètres
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Rayon de la Terre en mètres
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calcule la distance d'un point à un segment de ligne
 * @param {Array} point - Point [lat, lon]
 * @param {Array} lineStart - Début du segment [lat, lon]
 * @param {Array} lineEnd - Fin du segment [lat, lon]
 * @returns {number} Distance en mètres
 */
function pointToSegmentDistance(point, lineStart, lineEnd) {
  const [lat, lon] = point;
  const [lat1, lon1] = lineStart;
  const [lat2, lon2] = lineEnd;
  
  // Convertir en coordonnées cartésiennes approximatives
  const x = lon;
  const y = lat;
  const x1 = lon1;
  const y1 = lat1;
  const x2 = lon2;
  const y2 = lat2;
  
  const A = x - x1;
  const B = y - y1;
  const C = x2 - x1;
  const D = y2 - y1;
  
  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;
  
  if (lenSq !== 0) {
    param = dot / lenSq;
  }
  
  let xx, yy;
  
  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }
  
  return haversineDistance(lat, lon, yy, xx);
}

/**
 * Calcule la distance d'un point à une polyline
 * @param {Array} point - Point [lat, lon]
 * @param {Array} polyline - Polyline [[lat, lon], ...]
 * @returns {number} Distance minimale en mètres
 */
function pointToPolylineDistance(point, polyline) {
  let minDistance = Infinity;
  
  for (let i = 0; i < polyline.length - 1; i++) {
    const distance = pointToSegmentDistance(point, polyline[i], polyline[i + 1]);
    minDistance = Math.min(minDistance, distance);
  }
  
  return minDistance;
}

/**
 * Calcule la distance moyenne entre deux polylines
 * @param {Array} polyline1 - Première polyline [[lat, lon], ...]
 * @param {Array} polyline2 - Deuxième polyline [[lat, lon], ...]
 * @returns {number} Distance moyenne en mètres
 */
function calculatePolylineDistance(polyline1, polyline2) {
  if (!polyline1 || !polyline2 || polyline1.length === 0 || polyline2.length === 0) {
    return Infinity;
  }

  try {
    let totalDistance = 0;
    let pointCount = 0;

    // Calculer la distance de chaque point de polyline1 vers polyline2
    polyline1.forEach(point => {
      const distance = pointToPolylineDistance(point, polyline2);
      totalDistance += distance;
      pointCount++;
    });

    // Calculer la distance de chaque point de polyline2 vers polyline1
    polyline2.forEach(point => {
      const distance = pointToPolylineDistance(point, polyline1);
      totalDistance += distance;
      pointCount++;
    });

    return totalDistance / pointCount;
  } catch (error) {
    console.error('Erreur lors du calcul de distance entre polylines:', error.message);
    return Infinity;
  }
}

/**
 * Calcule le pourcentage de chevauchement entre deux polylines
 * Basé sur la proximité des points (seuil de 500m)
 * @param {Array} polyline1 - Première polyline
 * @param {Array} polyline2 - Deuxième polyline
 * @returns {number} Pourcentage de chevauchement (0-100)
 */
function calculateOverlapPercentage(polyline1, polyline2) {
  if (!polyline1 || !polyline2 || polyline1.length === 0 || polyline2.length === 0) {
    return 0;
  }

  try {
    const threshold = 500; // 500 mètres de seuil pour considérer un chevauchement
    let overlappingPoints = 0;

    polyline1.forEach(point => {
      const distance = pointToPolylineDistance(point, polyline2);
      
      if (distance <= threshold) {
        overlappingPoints++;
      }
    });

    return (overlappingPoints / polyline1.length) * 100;
  } catch (error) {
    console.error('Erreur lors du calcul de chevauchement:', error.message);
    return 0;
  }
}

/**
 * Calcule la proximité temporelle entre deux heures de départ
 * @param {string|Date} time1 - Première heure de départ
 * @param {string|Date} time2 - Deuxième heure de départ
 * @returns {number} Score de proximité temporelle (0-100)
 */
function calculateTemporalProximity(time1, time2) {
  try {
    const date1 = new Date(time1);
    const date2 = new Date(time2);
    
    // Différence en minutes
    const diffMinutes = Math.abs(date1 - date2) / (1000 * 60);
    
    // Score décroissant: 100% si même heure, 0% si > 2 heures
    const maxDiffMinutes = 120; // 2 heures
    const score = Math.max(0, 100 - (diffMinutes / maxDiffMinutes) * 100);
    
    return score;
  } catch (error) {
    console.error('Erreur lors du calcul de proximité temporelle:', error.message);
    return 0;
  }
}

/**
 * Calcule le score de similarité global entre deux trajets
 * @param {Object} trip1 - Premier trajet
 * @param {Object} trip2 - Deuxième trajet
 * @returns {Object} Score de similarité et détails
 */
function calculateSimilarity(trip1, trip2) {
  // Calcul de la distance moyenne entre polylines
  const avgDistance = calculatePolylineDistance(trip1.polyline, trip2.polyline);
  
  // Calcul du pourcentage de chevauchement
  const overlapPercentage = calculateOverlapPercentage(trip1.polyline, trip2.polyline);
  
  // Score de similarité spatiale (0-100)
  // Plus la distance est faible, plus le score est élevé
  // Distance < 100m = 100%, Distance > 5km = 0%
  const maxDistance = 5000; // 5 km
  const spatialScore = Math.max(0, 100 - (avgDistance / maxDistance) * 100);
  
  // Bonus pour le chevauchement
  const spatialScoreWithOverlap = (spatialScore * 0.7) + (overlapPercentage * 0.3);
  
  // Score de proximité temporelle (0-100)
  const temporalScore = calculateTemporalProximity(trip1.departureTime, trip2.departureTime);
  
  // Score global pondéré (70% spatial, 30% temporel)
  const globalScore = (spatialScoreWithOverlap * 0.7) + (temporalScore * 0.3);
  
  return {
    score: Math.round(globalScore * 10) / 10, // Arrondi à 1 décimale
    details: {
      spatialScore: Math.round(spatialScoreWithOverlap * 10) / 10,
      temporalScore: Math.round(temporalScore * 10) / 10,
      avgDistance: Math.round(avgDistance),
      overlapPercentage: Math.round(overlapPercentage * 10) / 10
    }
  };
}

/**
 * Trouve tous les matches pour un utilisateur donné
 * @param {Object} userTrip - Trajet de l'utilisateur
 * @param {Array} allTrips - Tous les trajets existants
 * @param {number} minScore - Score minimum pour considérer un match (défaut: 20)
 * @returns {Array} Liste des matches triés par score décroissant
 */
function findMatches(userTrip, allTrips, minScore = 20) {
  const matches = [];
  
  allTrips.forEach(trip => {
    // Ne pas matcher avec soi-même
    if (trip.userId === userTrip.userId) {
      return;
    }
    
    const similarity = calculateSimilarity(userTrip, trip);
    
    if (similarity.score >= minScore) {
      matches.push({
        userId: trip.userId,
        userName: trip.userName,
        similarity: similarity.score,
        details: similarity.details,
        trip: {
          origin: trip.origin,
          destination: trip.destination,
          departureTime: trip.departureTime,
          mode: trip.mode
        }
      });
    }
  });
  
  // Trier par score décroissant
  matches.sort((a, b) => b.similarity - a.similarity);
  
  return matches;
}

module.exports = {
  calculatePolylineDistance,
  calculateOverlapPercentage,
  calculateTemporalProximity,
  calculateSimilarity,
  findMatches
};
