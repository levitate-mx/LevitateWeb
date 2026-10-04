import assert from 'node:assert/strict';
import test from 'node:test';
import { adminOrderKey, adjustAdminOrderTotals, matchesAdminOrderFilters } from '../src/components/admin/adminOrderState.ts';

const order = { id: 'shared-id', orderType: 'registration', status: 'payment_reported', amount: 1500, paidAmount: 200,
  curp: 'AAAA100101MDFBBB01', participantName: 'Participante', academyName: 'Academia', reference: 'raw-reference',
  paymentReference: 'INS-AAAABB01', venue: 'edomex', proof: { id: 'proof' } };
const totals = { count: 80, amount: 50000, paidAmount: 10200, pending: 20, reported: 30, paid: 20, rejected: 10, withProof: 60 };

test('approving, rejecting and deleting a payment update global totals by only that order', () => {
  const approved = { ...order, status: 'paid', paidAmount: 1500 };
  const afterApproval = adjustAdminOrderTotals(totals, order, approved);
  assert.deepEqual(afterApproval, { ...totals, paidAmount: 11500, reported: 29, paid: 21 });
  const rejected = { ...approved, status: 'rejected' };
  const afterRejection = adjustAdminOrderTotals(afterApproval, approved, rejected);
  assert.equal(afterRejection.paid, 20);
  assert.equal(afterRejection.rejected, 11);
  const afterDelete = adjustAdminOrderTotals(afterRejection, rejected, null);
  assert.deepEqual(afterDelete, { ...totals, count: 79, amount: 48500, paidAmount: 10000, reported: 29, withProof: 59 });
  assert.equal(totals.count, 80);
});

test('note-only saves preserve totals and duplicate IDs from different order types stay separate', () => {
  assert.deepEqual(adjustAdminOrderTotals(totals, order, { ...order, notes: 'Nueva nota' }), totals);
  assert.notEqual(adminOrderKey(order), adminOrderKey({ ...order, orderType: 'shop' }));
});

test('an updated payment leaves a status-filtered page while reference, venue and Relevé filters remain accurate', () => {
  const filters = { query: 'ins-aaaabb01', status: 'payment_reported', venue: 'edomex', purchaseType: 'registration' };
  assert.equal(matchesAdminOrderFilters(order, filters), true);
  assert.equal(matchesAdminOrderFilters({ ...order, status: 'paid' }, filters), false);
  assert.equal(matchesAdminOrderFilters(order, { ...filters, venue: 'puebla' }), false);
  const releve = { ...order, curp: 'RELEVE:dance' };
  assert.equal(matchesAdminOrderFilters(releve, filters), false);
  assert.equal(matchesAdminOrderFilters(releve, { ...filters, purchaseType: 'releve' }), true);
});
