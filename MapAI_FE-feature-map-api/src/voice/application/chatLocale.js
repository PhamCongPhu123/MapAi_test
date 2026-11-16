import { normalize } from '../../offline/application/searchEngine.js';
// Text command normalization never changes place IDs or proper names in results.
export function normalizeEnglishCommand(value) {
  return normalize(value).replace(/\bbus stops\b/g, 'bus stop').replace(/\bpharmacies\b/g, 'pharmacy').replace(/\buniversities\b/g, 'university')
    .replace(/\bgas stations\b/g, 'gas station').replace(/\bhospitals\b/g, 'hospital').replace(/\bschools\b/g, 'school')
    .replace(/\brestaurants\b/g, 'restaurant').replace(/\bcafes\b/g, 'cafe').replace(/\batms\b/g, 'atm');
}
