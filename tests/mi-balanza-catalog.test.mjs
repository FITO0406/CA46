import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const catalog=JSON.parse(readFileSync(new URL('../lib/mi-balanza/plu-catalog.json',import.meta.url),'utf8')).items;
test('CA46 imported catalog contains 109 distinct PLU codes and no duplicate names',()=>{
 assert.equal(catalog.length,109);
 assert.equal(new Set(catalog.map(x=>x.plu)).size,109);
 assert.equal(new Set(catalog.map(x=>x.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase())).size,109);
 assert.equal(catalog.filter(x=>x.unweighed).length,35);
 assert.ok(catalog.every(x=>Number.isSafeInteger(x.plu)&&x.plu>0&&x.name.trim()));
});
test('PLU 5 remains occupied and N/P source status is preserved',()=>{
 const record=catalog.find(x=>x.plu===5);
 assert.ok(record);
 assert.equal(record.name,'PIJOTAS');
 assert.equal(record.unweighed,false);
 assert.ok(catalog.some(x=>x.unweighed));
});
