/**
 * Municípios da Grande São Paulo para quem não quer (ou não pode) usar a localização.
 * Coordenadas aproximadas do centro: bastam, porque só usamos a célula de ~28 km.
 */
export interface Place { name: string; lat: number; lon: number; }
export const PLACES: Place[] = [
  { name: 'São Paulo (centro)', lat: -23.55, lon: -46.63 },
  { name: 'São Paulo (zona leste)', lat: -23.54, lon: -46.47 },
  { name: 'São Paulo (zona sul)', lat: -23.68, lon: -46.70 },
  { name: 'São Paulo (zona norte)', lat: -23.48, lon: -46.63 },
  { name: 'São Paulo (zona oeste)', lat: -23.57, lon: -46.72 },
  { name: 'Barueri', lat: -23.51, lon: -46.88 },
  { name: 'Carapicuíba', lat: -23.52, lon: -46.84 },
  { name: 'Cotia', lat: -23.60, lon: -46.92 },
  { name: 'Diadema', lat: -23.69, lon: -46.62 },
  { name: 'Embu das Artes', lat: -23.65, lon: -46.85 },
  { name: 'Guarulhos', lat: -23.46, lon: -46.53 },
  { name: 'Itapevi', lat: -23.55, lon: -46.93 },
  { name: 'Itaquaquecetuba', lat: -23.49, lon: -46.35 },
  { name: 'Mauá', lat: -23.67, lon: -46.46 },
  { name: 'Mogi das Cruzes', lat: -23.52, lon: -46.19 },
  { name: 'Osasco', lat: -23.53, lon: -46.79 },
  { name: 'Ribeirão Pires', lat: -23.71, lon: -46.41 },
  { name: 'Santana de Parnaíba', lat: -23.44, lon: -46.92 },
  { name: 'Santo André', lat: -23.66, lon: -46.53 },
  { name: 'São Bernardo do Campo', lat: -23.69, lon: -46.56 },
  { name: 'São Caetano do Sul', lat: -23.62, lon: -46.55 },
  { name: 'Suzano', lat: -23.54, lon: -46.31 },
  { name: 'Taboão da Serra', lat: -23.61, lon: -46.76 },
];
/** Área atendida no MVP (mesmo retângulo da grade do servidor). */
export const BOUNDS = { south: -24.1, west: -47.25, north: -23.15, east: -45.65 };
export const inBounds = (lat: number, lon: number) =>
  lat >= BOUNDS.south && lat <= BOUNDS.north && lon >= BOUNDS.west && lon <= BOUNDS.east;
