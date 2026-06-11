// Cities available for ambassador applications
export const CITIES = [
  'Kairouan',
  'Mahdia',
  'Monastir',
  'Nabeul',
  'Sfax',
  'Sousse',
  'Tunis'
] as const;

// Villes (neighborhoods) for Sousse
export const SOUSSE_VILLES = [
  'Akouda',
  'Beb Bhar',
  'Bouhsina',
  'Cite Riadh',
  'Cite Zouhour',
  'Enfidha',
  'Hammam-Sousse',
  'Hergla',
  'Jawhara',
  'Kalaa Kebira',
  'Kalaa Seghira',
  'Khezama',
  'Msaken',
  'Sahloul',
  'Sidi Abdelhamid',
  'Sidi Bou Ali',
  'Tafela'
] as const;

// Villes (neighborhoods) for Tunis
export const TUNIS_VILLES = [
  'Aouina',
  'Ariana',
  'Bardo',
  'Carthage',
  'Centre Ville',
  'Cité El Khadra',
  'Ennasser/Ghazela',
  'Ezzahra/Boumhel',
  'Gammarth',
  'Jardin de Carthage',
  'Kram',
  'Lac 1/2',
  'Manar',
  'Manouba',
  'Marsa',
  'Megrine/Rades',
  'Menzah 7/8/9',
  'Mourouj',
  'Mourouj 1/2/3',
  'Rades',
  'Soukra'
] as const;

export type City = typeof CITIES[number];
export type SousseVille = typeof SOUSSE_VILLES[number];
export type TunisVille = typeof TUNIS_VILLES[number];

// Primary slogan
export const PRIMARY_SLOGAN = {
  en: "We create memories",
  fr: "Nous créons des souvenirs"
} as const;

