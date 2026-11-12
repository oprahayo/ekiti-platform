import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ekitiLgaBounds,normalizeLgaName,boundsForLga}
  from '../src/app/ekiti-lga-viewport.ts';

const boundaries=JSON.parse(readFileSync(new URL('../data/grid3/lga.json',import.meta.url),'utf8'));

test('map camera extents cover precisely all 16 sourced Ekiti LGAs',()=>{
  assert.equal(boundaries.type,'FeatureCollection');
  assert.equal(boundaries.features.length,16);
  assert.equal(Object.keys(ekitiLgaBounds).length,16);
  for(const feature of boundaries.features){
    assert.equal(feature.properties.statename,'Ekiti');
    const name=feature.properties.lganame;
    const b=boundsForLga(name);
    assert.ok(b, name);
    const points=feature.geometry.coordinates.flat(1);
    for(const [lon,lat] of points){
      assert.ok(lon>=b[0][0]-0.000001 && lon<=b[1][0]+0.000001,name+' longitude');
      assert.ok(lat>=b[0][1]-0.000001 && lat<=b[1][1]+0.000001,name+' latitude');
    }
    assert.ok(b[0][0]>4.7 && b[1][0]<5.95 && b[0][1]>7.15 && b[1][1]<8.25);
  }
});

test('display labels from user-facing LGA selector resolve across punctuation variants',()=>{
  assert.deepEqual(boundsForLga('Ido/Osi'),boundsForLga('Ido-Osi'));
  assert.deepEqual(boundsForLga('Irepodun / Ifelodun'),boundsForLga('Irepodun/Ifelodun'));
  assert.deepEqual(boundsForLga('Ise/Orun'),boundsForLga('Ise-Orun'));
  assert.equal(normalizeLgaName('Ado-Ekiti'),'adoekiti');
  assert.equal(boundsForLga('Outside Ekiti'),null);
  assert.equal(boundsForLga(''),null);
});
