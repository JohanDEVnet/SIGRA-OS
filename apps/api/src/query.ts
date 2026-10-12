import { BadRequestException, UnprocessableEntityException } from '@nestjs/common';
export function optionalNumber(name: string, value: unknown, options: { min: number; max: number; integer?: boolean }): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !/^-?\d+(?:\.\d+)?$/.test(value.trim())) throw new BadRequestException(`${name} debe ser un número válido.`);
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < options.min || parsed > options.max || (options.integer && !Number.isInteger(parsed))) throw new UnprocessableEntityException(`${name} debe estar entre ${options.min} y ${options.max}${options.integer ? ' y ser entero' : ''}.`);
  return parsed;
}
export function requiredCoordinate(name: string, value: unknown): number {
  const parsed = optionalNumber(name, value, { min: name === 'lat' ? -90 : -180, max: name === 'lat' ? 90 : 180 });
  if (parsed === undefined) throw new BadRequestException(`Se requiere ${name}.`);
  return parsed;
}
export function optionalText(name: string, value: unknown, maxLength = 120): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength) throw new BadRequestException(`${name} debe ser un texto no vacío de hasta ${maxLength} caracteres.`);
  return value.trim();
}
export function normalizeRegion(value: string): string { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
