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
  'Sahloul',
  'Khezama',
  'Hammam-Sousse',
  'Jawhara',
  'Msaken',
  'Kalâa Kebira',
  'Kalâa Seghira',
  'Akouda',
  'Hergla',
  'Bouhsina',
  'Sidi Abdelhamid',
  'Sidi Bou Ali',
  'Enfidha'
] as const;

export type City = typeof CITIES[number];
export type SousseVille = typeof SOUSSE_VILLES[number];

