import assert from 'node:assert/strict';
import test from 'node:test';
import ticketPricing from '../shared/ticket-pricing.json' with { type: 'json' };
import {
  getSinglePassPrice,
  getSinglePassPricing,
  getSinglePassPricingForOrder,
  isSinglePassPresaleProof,
  repriceSinglePassOrder,
} from '../worker/ticket-pricing.js';

const campaigns = [
  ['edomex-2026-otono', 250, 350, '2026-10-21T06:00:00.000Z'],
  ['orizaba-2027', 200, 300, '2027-01-21T06:00:00.000Z'],
  ['cdmx-2027', 200, 300, '2027-03-21T06:00:00.000Z'],
];

function singlePassOrder(eventId, {
  amount = 400,
  createdAt = '2027-01-01 12:00:00',
  lineEventId = eventId,
  notes = null,
  quantity = 2,
  status = 'pending_payment',
  unitPrice = 200,
} = {}) {
  const line = {
    amount: unitPrice * quantity,
    eventId: lineEventId,
    optionId: 'bloque-1',
    productId: 'block',
    quantity,
    unitPrice,
  };
  if (!lineEventId) delete line.eventId;
  return {
    amount,
    created_at: createdAt,
    event_id: eventId,
    line_items_json: JSON.stringify([line]),
    notes,
    status,
  };
}

test('Single Pass campaigns preserve Edomex and configure both 2027 cutoffs in Mexico City', () => {
  for (const [eventId, presalePrice, regularPrice, cutoffIso] of campaigns) {
    const pricing = getSinglePassPricing(eventId);
    assert.equal(pricing.presalePrice, presalePrice, eventId);
    assert.equal(pricing.regularPrice, regularPrice, eventId);
    assert.equal(new Date(pricing.presaleEndsAt).toISOString(), cutoffIso, eventId);
    assert.equal(pricing.timeZone, 'America/Mexico_City', eventId);
    assert.equal(ticketPricing.singlePass[eventId].presalePrice, presalePrice, eventId);
  }
  assert.equal(getSinglePassPricing('unknown-event'), null);
  assert.equal(getSinglePassPrice(Date.now(), 'unknown-event'), null);
});

test('each Single Pass campaign changes one millisecond after its inclusive presale date', () => {
  for (const [eventId, presalePrice, regularPrice] of campaigns) {
    const cutoff = getSinglePassPricing(eventId).presaleEndsAt;
    assert.equal(getSinglePassPrice(cutoff - 1, eventId), presalePrice, `${eventId} before cutoff`);
    assert.equal(getSinglePassPrice(cutoff, eventId), regularPrice, `${eventId} at cutoff`);
  }
});

test('future Single Pass repricing is isolated by event and rejects ambiguous order identity', () => {
  const orizabaCutoff = getSinglePassPricing('orizaba-2027').presaleEndsAt;
  const cdmxCutoff = getSinglePassPricing('cdmx-2027').presaleEndsAt;
  const orizaba = singlePassOrder('orizaba-2027');
  const cdmx = singlePassOrder('cdmx-2027');

  const orizabaUpdate = repriceSinglePassOrder(orizaba, orizabaCutoff);
  assert.equal(orizabaUpdate.amount, 600);
  assert.equal(orizabaUpdate.lineItems[0].unitPrice, 300);
  assert.equal(orizabaUpdate.pricing.eventId, 'orizaba-2027');
  assert.equal(repriceSinglePassOrder(cdmx, orizabaCutoff), null, 'CDMX remains in presale in January');
  assert.equal(repriceSinglePassOrder(cdmx, cdmxCutoff).amount, 600);

  const mismatched = singlePassOrder('cdmx-2027', { lineEventId: 'orizaba-2027' });
  assert.equal(getSinglePassPricingForOrder(mismatched), null);
  assert.equal(repriceSinglePassOrder(mismatched, cdmxCutoff), null);

  const missingFutureIdentity = singlePassOrder('cdmx-2027', { lineEventId: '' });
  assert.equal(getSinglePassPricingForOrder(missingFutureIdentity), null,
    'an eventless line is legacy compatibility, never a future sale fallback');

  const legacy = singlePassOrder('edomex-2026-otono', {
    amount: 250,
    createdAt: '2026-10-20 12:00:00',
    lineEventId: '',
    quantity: 1,
    unitPrice: 250,
  });
  const legacyUpdate = repriceSinglePassOrder(legacy, getSinglePassPricing('edomex-2026-otono').presaleEndsAt);
  assert.equal(legacyUpdate.amount, 350);
  assert.equal(legacyUpdate.lineItems[0].unitPrice, 350);
});

test('proof timestamps reserve the correct event price and the exact cutoff is already regular', () => {
  const earlyOrizabaProof = { status: 'submitted', uploaded_at: '2027-01-21 05:59:59' };
  const cutoffOrizabaProof = { status: 'submitted', uploaded_at: '2027-01-21 06:00:00' };
  assert.equal(isSinglePassPresaleProof(earlyOrizabaProof, 'orizaba-2027'), true);
  assert.equal(isSinglePassPresaleProof(cutoffOrizabaProof, 'orizaba-2027'), false);
  assert.equal(isSinglePassPresaleProof(cutoffOrizabaProof, 'cdmx-2027'), true,
    'the same January timestamp is still CDMX presale');

  const orizaba = singlePassOrder('orizaba-2027');
  const orizabaCutoff = getSinglePassPricing('orizaba-2027').presaleEndsAt;
  assert.equal(repriceSinglePassOrder(orizaba, orizabaCutoff, earlyOrizabaProof), null);
  assert.equal(repriceSinglePassOrder(orizaba, orizabaCutoff, cutoffOrizabaProof).amount, 600);

  const earlyCdmxProof = { status: 'accepted', uploaded_at: '2027-03-21 05:59:59' };
  const cutoffCdmxProof = { status: 'accepted', uploaded_at: '2027-03-21 06:00:00' };
  assert.equal(isSinglePassPresaleProof(earlyCdmxProof, 'cdmx-2027'), true);
  assert.equal(isSinglePassPresaleProof(cutoffCdmxProof, 'cdmx-2027'), false);
});
