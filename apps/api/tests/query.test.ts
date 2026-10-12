import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BadRequestException, UnprocessableEntityException } from '@nestjs/common';
import { normalizeRegion, optionalNumber, optionalText, requiredCoordinate } from '../src/query.js';
test('filtros numéricos rechazan valores ambiguos y fuera de rango', () => {
  for (const value of ['', ' ', '2e2', 'NaN', 'Infinity', '5abc', ['5']]) assert.throws(() => optionalNumber('mag_min', value, { min: 0, max: 10 }), BadRequestException);
  for (const value of ['-1','11']) assert.throws(() => optionalNumber('mag_min',value,{min:0,max:10}),UnprocessableEntityException);
  assert.equal(optionalNumber('mag_min', '5.4', { min: 0, max: 10 }), 5.4);
  assert.equal(optionalNumber('mag_min', undefined, { min: 0, max: 10 }), undefined);
  for (const value of ['0', '1.5', '3651']) assert.throws(() => optionalNumber('dias', value, { min: 1, max: 3650, integer: true }), UnprocessableEntityException);
});
test('coordenadas reales aceptan negativos y validan presencia/rangos', () => {
  assert.equal(requiredCoordinate('lat', '-14.69'), -14.69);
  assert.equal(requiredCoordinate('lon', '-73.65'), -73.65);
  for (const value of [undefined, '']) assert.throws(() => requiredCoordinate('lat', value), BadRequestException);
  for(const value of ['91','-91']) assert.throws(()=>requiredCoordinate('lat',value),UnprocessableEntityException);
  assert.throws(() => requiredCoordinate('lon', '181'), UnprocessableEntityException);
});
test('regiones toleran acentos; filtros de texto rechazan listas', () => {
  assert.equal(normalizeRegion('ÁNCASH'), normalizeRegion('Ancash'));
  assert.equal(optionalText('region', ' Áncash '), 'Áncash');
  assert.throws(() => optionalText('region', ['Áncash']), BadRequestException);
});
