import { isBufferCard } from '../src/modules/Foreman2/features/scrap/scrapCalculations.js';

console.log('Testing isBufferCard with SGP card...');

const sgpCard = {
  id: '792cc36b-97e4-4542-bdea-b00d3146b2ae',
  operation: 'Склад СГП',
  card_info: '[ЗІ СКЛАДУ СГП] [BZ_RESERVATION:7225257d-a054-4b5b-8e8d-9f0dcb6ac2ea]',
  quantity: 54
};

const isBuffer = isBufferCard(sgpCard);
console.log('Is SGP card considered buffer/stock reservation?', isBuffer);

if (isBuffer === true) {
  console.log('SUCCESS: SGP card is correctly identified as buffer/stock card and excluded from Shop 1 sheet cutting count!');
} else {
  console.error('FAIL: SGP card was NOT recognized as buffer card!');
}
