export type IconName='overview'|'quake'|'map'|'services'|'book'|'arrow'|'download'|'refresh'|'search'|'layers'|'mountain'|'water'|'people'|'weather'|'close'|'menu'|'check'|'external'|'locate'|'share'|'copy';
const paths:Record<IconName,string>={
 overview:'m3 8 5-3 5 3-5 3z m8-3 5-3 5 3-5 3 M3 8v5l5 3 5-3V8 M13 8l5 3 5-3V5 M8 16v4l10-6v-3',
 quake:'m2 15 10-5 10 5-10 5z M2 15v3l10 5 10-5v-3 M5 12l3-2 2 4 3-8 2 5 4-2',
 map:'m2 9 6-3 7 3 7-3v12l-7 3-7-3-6 3z M8 6v12 M15 9v12 M5 12l3-1 3 3 4-2 4-1',
 services:'m8 10 4-2 4 2-4 2z M8 10v3l4 2 4-2v-3 M12 15v3 M5 13 2 15l4 2 4-2 M2 15v3l4 2 4-2v-3 M19 13l3 2-4 2-4-2 M14 15v3l4 2 4-2v-3 M8 6l4-2 4 2-4 2z M12 8v2',
 book:'M2 7l8-4 2 2 2-2 8 4v13l-8-4-2 2-2-2-8 4z M12 5v13 M5 8l4-2 M5 11l4-2 M15 6l4 2 M15 9l4 2',
 arrow:'M4 12h16 M14 6l6 6-6 6',
 download:'M12 3v12 m-5-5 5 5 5-5 M4 17v4h16v-4',
 refresh:'M20 8a8 8 0 0 0-14-3L3 8 M3 3v5h5 M4 16a8 8 0 0 0 14 3l3-3 M16 16h5v5',
 search:'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14 M15 15l6 6',
 layers:'m12 3 10 6-10 6L2 9z M2 13l10 6 10-6 M2 17l10 6 10-6',
 mountain:'m2 17 10-5 10 5-10 5z M2 17v2l10 5 10-5v-2 M5 15l5-12 5 12 M13 13l4-7 4 10 M8 7l2 2 2-2 M10 3l1 11',
 water:'m3 18 9-4 9 4-9 4z M3 18v2l9 4 9-4v-2 M12 2C10 5 7 8 7 11a5 5 0 0 0 10 0c0-3-3-6-5-9z M9 11a3 3 0 0 0 3 3',
 people:'m3 7 10-5 8 4v14l-10 4-8-4z M3 7l8 4 10-5 M11 11v13 M13 3l-5 3 M16 4l-5 3 M15 12a2 2 0 1 0 0 4 2 2 0 0 0 0-4 M12 20c0-2 6-5 6-2 M5 12l3 1 M5 15l3 1',
 weather:'M7 12a4 4 0 0 1 7-4 4 4 0 0 1 5 4 3 3 0 0 1 1 6H7a3 3 0 0 1 0-6z M7 12l-2-2 M20 18l-2 2H5a3 3 0 0 1-2-4 M6 3v2 M2 6l2 1 M10 3 9 5 M9 21l-1 2 M15 21l-1 2',
 close:'m5 5 14 14 M19 5 5 19',
 menu:'M3 5h18 M3 12h18 M3 19h18',
 check:'m5 12 4 4 10-10',
 external:'M14 3h7v7 M21 3 10 14 M10 3H3v18h18v-7',
 locate:'M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14 M12 2v4 M12 18v4 M2 12h4 M18 12h4 M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
 share:'M17 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6 M5 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6 M17 17a3 3 0 1 0 0 6 3 3 0 0 0 0-6 M8 10l6-3 M8 14l6 5',
 copy:'M8 7h13v16H8z M16 7V3H3v16h5'
};
export function Icon({name,size=20}:{name:IconName;size?:number}){return <svg width={size} height={size} viewBox="0 0 24 26" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]}/></svg>}
export function BrandMark(){return <svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="m4 34 20-9 20 9-20 10z M4 34v3l20 9 20-9v-3 M10 30 21 6l12 23 M27 22l7-10 8 19 M17 14l4 4 4-4 M21 6l3 24" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>}
