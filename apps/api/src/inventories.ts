export interface InventoryPoint { id: string; name: string; lat: number; lon: number; region: string | null; province: string | null; district: string | null; altitude?: number | null; riskLevel?: string | null; areaKm2?: number | null; mountainRange?: string | null }
export const SENAMHI_URL = 'https://idesep.senamhi.gob.pe/geoserver/ows?service=WFS&version=2.0.0&request=GetFeature&typeNames=g_99_01%3A99_01_002_03_001_000_0000_00_00&outputFormat=application%2Fjson&srsName=EPSG%3A4326&count=500&startIndex=0';
export const INAIGEM_URL = 'https://services6.arcgis.com/c9GFTG11debu0wsH/arcgis/rest/services/LGRD2024_/FeatureServer/0/query?where=1%3D1&outFields=FID%2CNombre%2CCod_lag%2CCordillera%2CDep%2CProv%2CDistr%2CNIVEL_R%2CArea_Km2&returnGeometry=false&returnCentroid=true&f=json&outSR=4326&orderByFields=FID&resultRecordCount=1000&resultOffset=0';
function object(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Inventario inválido.'); return value as Record<string, unknown>; }
function text(value: unknown): string | null { return typeof value === 'string' && value.trim() ? value.trim() : null; }
function coordinate(value: unknown, max: number): number { if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > max) throw new Error('Coordenada inválida.'); return value; }
export function parseStations(input: unknown): { data: InventoryPoint[]; warnings: string[] } {
  const root = object(input);
  if (root.type !== 'FeatureCollection' || !Array.isArray(root.features)) throw new Error('Respuesta WFS no reconocida.');
  if (typeof root.totalFeatures === 'number' && root.features.length < root.totalFeatures) throw new Error('Inventario WFS truncado; no se publican conteos incompletos.');
  const data = root.features.map((feature) => {
    const row = object(feature); const props = object(row.properties); const geometry = object(row.geometry);
    if (geometry.type !== 'Point' || !Array.isArray(geometry.coordinates) || !text(props.codigo)) throw new Error('Estación sin geometría o código.');
    return { id: String(props.codigo), name: text(props.estacion) ?? 'Estación sin nombre publicado', lon: coordinate(geometry.coordinates[0], 180), lat: coordinate(geometry.coordinates[1], 90), region: text(props.departamento), province: text(props.provincia), district: text(props.distrito), altitude: typeof props.altitud === 'number' ? props.altitud : null };
  });
  return { data, warnings: ['Inventario de estaciones hidrológicas. El servicio no aporta fecha de observación, caudal ni nivel de agua; no indica que las estaciones estén transmitiendo en este momento.'] };
}
export function parseLakes(input: unknown): { data: InventoryPoint[]; warnings: string[] } {
  const root = object(input);
  if (root.error || !Array.isArray(root.features) || root.exceededTransferLimit) throw new Error('Inventario INAIGEM inválido o truncado.');
  const spatialReference = object(root.spatialReference);
  if (spatialReference.wkid !== 4326 && spatialReference.latestWkid !== 4326) throw new Error('Proyección del inventario no reconocida.');
  const data = root.features.map((feature) => {
    const row = object(feature); const props = object(row.attributes); const centroid = object(row.centroid);
    if (!text(props.Cod_lag)) throw new Error('Laguna sin código.');
    return { id: String(props.Cod_lag), name: text(props.Nombre) ?? 'Laguna sin nombre publicado', lon: coordinate(centroid.x, 180), lat: coordinate(centroid.y, 90), region: text(props.Dep), province: text(props.Prov), district: text(props.Distr), mountainRange: text(props.Cordillera), riskLevel: text(props.NIVEL_R), areaKm2: typeof props.Area_Km2 === 'number' ? props.Area_Km2 : null };
  });
  return { data, warnings: ['Inventario INAIGEM LGRD2024. Los puntos representan centroides de lagunas; la clasificación NIVEL_R pertenece al inventario y no es una alerta actual ni un riesgo calculado para el sismo seleccionado.'] };
}
export function distanceKm(lat: number, lon: number, point: Pick<InventoryPoint, 'lat' | 'lon'>): number {
  const radians = Math.PI / 180;
  const sinLat = Math.sin((point.lat - lat) * radians / 2); const sinLon = Math.sin((point.lon - lon) * radians / 2);
  const a = sinLat * sinLat + Math.cos(lat * radians) * Math.cos(point.lat * radians) * sinLon * sinLon;
  return 6371.0088 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}

