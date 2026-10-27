import { describe, expect, it } from 'vitest';
import { isMatchingCutterRequest, extractCutterDiameter } from '../src/utils/cutterCalculator.js';

describe('cutterMatching and isMatchingCutterRequest', () => {
  const genericF3Id = '1ba4c09f-2fcf-4fc8-957d-80fca75d371a';
  const genericF2Id = '2e2f45ea-e2d8-480b-9b08-f6d6519149fb';
  const genericF6Id = '792717a5-bd47-46a5-97f0-0e5f6ff81e58';

  const nomenclatures = [
    { id: genericF3Id, name: 'Фреза ф3', type: 'consumable' },
    { id: genericF2Id, name: 'Фреза ф2', type: 'consumable' },
    { id: genericF6Id, name: 'Фреза ф6', type: 'consumable' },
    { id: 'nom-corn-3', name: 'Фреза кукурудза 3х3,175х12х38', type: 'consumable', characteristic: genericF3Id },
    { id: 'nom-corn-2', name: 'Фреза кукурудза 2х3,175х10,5х38', type: 'consumable', characteristic: genericF2Id },
    { id: 'nom-chamfer-6', name: 'Фреза фасочна 6х50х90°', type: 'consumable', characteristic: genericF6Id }
  ];

  it('extracts cutter diameters correctly from strings', () => {
    expect(extractCutterDiameter('Фреза ф3')).toBe('3');
    expect(extractCutterDiameter('Фреза ф2')).toBe('2');
    expect(extractCutterDiameter('Фреза кукурудза 3х3,175х12х38')).toBe('3');
    expect(extractCutterDiameter('Фреза кукурудза 2х3,175х10,5х38')).toBe('2');
    expect(extractCutterDiameter('Фреза фасочна 6х50х90°')).toBe('6');
    expect(extractCutterDiameter('Лист 3мм')).toBe('3');
  });

  it('matches generic cutter request to specific cutter by characteristic and diameter', () => {
    const reqF3 = {
      id: 'req-1',
      nomenclature_id: genericF3Id,
      details: 'СКЛАД ОПЕРАТИВНИЙ (Картка №15/34) (ОБРАНО ВРУЧНУ): Фреза ф3 — 8 шт.',
      quantity: 8
    };

    const specificNom = nomenclatures.find(n => n.id === 'nom-corn-3');
    const matches = isMatchingCutterRequest(
      reqF3,
      'Фреза кукурудза 3х3,175х12х38',
      specificNom,
      { id: 'inv-1', nomenclature_id: specificNom.id },
      { id: 'card-1' },
      nomenclatures
    );

    expect(matches).toBe(true);
  });

  it('matches 2mm generic cutter request to 2mm corn cutter', () => {
    const reqF2 = {
      id: 'req-2',
      nomenclature_id: genericF2Id,
      details: 'СКЛАД ОПЕРАТИВНИЙ (Картка №15/34) (ОБРАНО ВРУЧНУ): Фреза ф2 — 8 шт.',
      quantity: 8
    };

    const specificNom = nomenclatures.find(n => n.id === 'nom-corn-2');
    const matches = isMatchingCutterRequest(
      reqF2,
      'Фреза кукурудза 2х3,175х10,5х38',
      specificNom,
      { id: 'inv-2' },
      { id: 'card-1' },
      nomenclatures
    );

    expect(matches).toBe(true);
  });

  it('matches 6mm chamfer cutter request to chamfer cutter', () => {
    const reqF6 = {
      id: 'req-3',
      nomenclature_id: genericF6Id,
      details: 'СКЛАД ОПЕРАТИВНИЙ (Картка №15/34) (ОБРАНО ВРУЧНУ): Фреза ф6 — 4 шт.',
      quantity: 4
    };

    const specificNom = nomenclatures.find(n => n.id === 'nom-chamfer-6');
    const matches = isMatchingCutterRequest(
      reqF6,
      'Фреза фасочна 6х50х90°',
      specificNom,
      { id: 'inv-3' },
      { id: 'card-1' },
      nomenclatures
    );

    expect(matches).toBe(true);
  });

  it('does NOT match 2mm cutter request to 3mm cutter', () => {
    const reqF2 = {
      id: 'req-2',
      nomenclature_id: genericF2Id,
      details: 'СКЛАД ОПЕРАТИВНИЙ (Картка №15/34) (ОБРАНО ВРУЧНУ): Фреза ф2 — 8 шт.',
      quantity: 8
    };

    const specificNom3 = nomenclatures.find(n => n.id === 'nom-corn-3');
    const matches = isMatchingCutterRequest(
      reqF2,
      'Фреза кукурудза 3х3,175х12х38',
      specificNom3,
      { id: 'inv-1' },
      { id: 'card-1' },
      nomenclatures
    );

    expect(matches).toBe(false);
  });
});
