import { HeritageItem } from '../types';

/**
 * Remove Vietnamese accents and special characters for fuzzy matching
 */
export function removeDiacritics(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

/**
 * Common prefixes in Vietnamese place names to strip for core token comparison
 */
const COMMON_NOISE_PREFIXES = [
  'khu du lich',
  'kdl',
  'di tich',
  'danh thang',
  'quan the danh thang',
  'quan the di tich',
  'chua',
  'den',
  'dinh',
  'mieu',
  'nha tho',
  'bao tang',
  'bai bien',
  'bai',
  'dao',
  'ban dao',
  'nui',
  'deo',
  'thac',
  'dong',
  'hang',
  'ho',
  'suoi',
  'lang nghe',
  'lang co',
  'lang',
  'cho dem',
  'cho noi',
  'cho',
  'cau',
  'vuon quoc gia',
  'khu bao ton'
];

/**
 * Clean core name by stripping common tourism noise words
 */
export function getCoreName(name: string): string {
  let cleaned = removeDiacritics(name).replace(/[^a-z0-9\s]/g, ' ');
  // Sort prefixes by length descending so longer phrases match first
  const sortedPrefixes = [...COMMON_NOISE_PREFIXES].sort((a, b) => b.length - a.length);
  for (const prefix of sortedPrefixes) {
    if (cleaned.startsWith(prefix + ' ')) {
      cleaned = cleaned.substring(prefix.length).trim();
    }
  }
  return cleaned.replace(/\s+/g, ' ').trim();
}

/**
 * Calculate Haversine distance in meters between two lat/lng points
 */
export function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // metres
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Token overlap similarity (Dice Coefficient)
 */
export function calculateTokenSimilarity(str1: string, str2: string): number {
  const tokens1 = new Set(str1.split(' ').filter(Boolean));
  const tokens2 = new Set(str2.split(' ').filter(Boolean));
  if (tokens1.size === 0 || tokens2.size === 0) return 0;

  let intersection = 0;
  tokens1.forEach(token => {
    if (tokens2.has(token)) intersection++;
  });

  return (2 * intersection) / (tokens1.size + tokens2.size);
}

/**
 * Check if two items are duplicates based on IDs, coordinates, names, and administrative units
 */
export function areDuplicates(a: HeritageItem, b: HeritageItem): boolean {
  // 1. Direct ID match
  if (a.id && b.id && a.id === b.id) return true;

  // 2. OSM or Wikidata ID match
  if (a.osmId && b.osmId && a.osmId === b.osmId) return true;
  if (a.wikidataId && b.wikidataId && a.wikidataId === b.wikidataId) return true;

  // 3. Name clean comparison
  const coreA = getCoreName(a.name);
  const coreB = getCoreName(b.name);

  // Exact core name match
  const exactCoreMatch = coreA.length > 3 && coreA === coreB;

  // Token similarity
  const sim = calculateTokenSimilarity(coreA, coreB);

  // Geographic distance
  const hasCoordsA = Boolean(a.lat && a.lng);
  const hasCoordsB = Boolean(b.lat && b.lng);
  
  if (hasCoordsA && hasCoordsB) {
    const distMeters = calculateDistanceMeters(a.lat, a.lng, b.lat, b.lng);

    // Distance < 500m and name overlap or substring match
    const subMatch = (coreA.length > 5 && coreB.includes(coreA)) || (coreB.length > 5 && coreA.includes(coreB));
    if (distMeters < 500 && (sim > 0.4 || exactCoreMatch || subMatch)) {
      return true;
    }

    // Distance < 80m: almost identical location with minimal token overlap
    if (distMeters < 80 && (sim > 0.25 || subMatch)) {
      return true;
    }
  }

  // Same province and extremely high similarity
  const provA = removeDiacritics(a.province || '');
  const provB = removeDiacritics(b.province || '');
  const sameProv = provA.includes(provB) || provB.includes(provA);

  if (sameProv && exactCoreMatch) {
    return true;
  }

  if (sameProv && sim > 0.85) {
    return true;
  }

  return false;
}

/**
 * Merge two duplicate items preserving the best metadata
 */
export function mergeDuplicateItems(primary: HeritageItem, secondary: HeritageItem): HeritageItem {
  // Determine which item is primary (verifiedStatus === 'verified' > 'folk_legend' > 'unverified')
  const rank = (item: HeritageItem) => {
    let score = 0;
    if (item.verifiedStatus === 'verified') score += 10;
    if (item.imageUrl && !item.imageUrl.includes('placeholder')) score += 5;
    if (item.history && item.history.length > 50) score += 3;
    if (item.interestingFacts && item.interestingFacts.length > 0) score += 2;
    if (item.visitingHours) score += 1;
    if (item.ticketPrice) score += 1;
    return score;
  };

  const target = rank(primary) >= rank(secondary) ? primary : secondary;
  const source = target === primary ? secondary : primary;

  // Merge tags without duplicate
  const allTags = Array.from(new Set([...(target.tags || []), ...(source.tags || [])]));

  return {
    ...target,
    tags: allTags,
    vietnameseName: target.vietnameseName || source.vietnameseName || target.name,
    englishName: target.englishName || source.englishName,
    subDistrict: target.subDistrict || source.subDistrict,
    history: (target.history && target.history.length > source.history?.length) ? target.history : (source.history || target.history),
    culturalSignificance: target.culturalSignificance || source.culturalSignificance,
    visitingHours: target.visitingHours || source.visitingHours,
    ticketPrice: target.ticketPrice || source.ticketPrice,
    googleMapsUri: target.googleMapsUri || source.googleMapsUri,
    dataSource: target.dataSource ? `${target.dataSource}, ${source.dataSource || ''}`.replace(/,\s*$/, '') : source.dataSource,
    interestingFacts: (target.interestingFacts?.length || 0) >= (source.interestingFacts?.length || 0)
      ? target.interestingFacts
      : source.interestingFacts,
    lastVerifiedDate: target.lastVerifiedDate || source.lastVerifiedDate || '2026-03-20',
    verifiedNote: target.verifiedNote || source.verifiedNote
  };
}

/**
 * Deduplicate an array of items
 */
export function deduplicateTourismPlaces(places: HeritageItem[]): {
  uniquePlaces: HeritageItem[];
  duplicatesRemoved: number;
} {
  const result: HeritageItem[] = [];
  let duplicatesRemoved = 0;

  for (const item of places) {
    const existingIndex = result.findIndex(existing => areDuplicates(existing, item));
    if (existingIndex >= 0) {
      result[existingIndex] = mergeDuplicateItems(result[existingIndex], item);
      duplicatesRemoved++;
    } else {
      result.push(item);
    }
  }

  return {
    uniquePlaces: result,
    duplicatesRemoved
  };
}
