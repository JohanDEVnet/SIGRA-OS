import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inventoryResults,themeFromHash} from '../src/themes.ts';
const points=[{id:'A',name:'Laguna Áncash',lat:-9.5,lon:-77.5,region:'Ancash'},{id:'B',name:'Ocoña',lat:-16.4,lon:-73.1,region:'Arequipa'},{id:'C',name:'Laguna vecina',lat:-9.6,lon:-77.6}];
test('inventory search preserves source coordinates and folds accents, region and codes',()=>{assert.deepEqual(inventoryResults(points,'ancash',null,100),[points[0]]);assert.deepEqual(inventoryResults(points,'B',null,100),[points[1]]);assert.deepEqual(inventoryResults(points,'arequipa',null,100),[points[1]]);});
test('inventory proximity excludes distant points and orders by geographic distance',()=>{const zone={lat:-9.6,lon:-77.6,label:'Referencia',kind:'device' as const};assert.deepEqual(inventoryResults(points,'',zone,100),[points[2],points[0]]);assert.deepEqual(inventoryResults(points,'ocona',zone,100),[]);assert.equal(points[0].lat,-9.5);});
test('theme deep links remain separate from seismic and university navigation',()=>{for(const theme of ['tiempo','lagunas','agua','poblacion'])assert.equal(themeFromHash(`#${theme}`),theme);for(const hash of ['#explorar','#sismos','#proyecto','#unknown'])assert.equal(themeFromHash(hash),'sismos');});
