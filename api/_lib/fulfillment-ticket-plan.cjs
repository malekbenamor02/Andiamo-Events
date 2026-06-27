'use strict';

function expectedTicketCount(orderPasses) {
  return (orderPasses || []).reduce((sum, p) => sum + Math.max(0, Number(p.quantity) || 0), 0);
}

/** Legacy idempotency by count (used in tests). */
function ticketsNeededPerPass(orderPasses, existingTickets) {
  const byPassId = new Map();
  for (const t of existingTickets || []) {
    if (!t.order_pass_id) continue;
    byPassId.set(t.order_pass_id, (byPassId.get(t.order_pass_id) || 0) + 1);
  }
  const plan = [];
  for (const pass of orderPasses || []) {
    const qty = Math.max(0, Number(pass.quantity) || 0);
    const have = byPassId.get(pass.id) || 0;
    const need = Math.max(0, qty - have);
    if (need > 0) plan.push({ pass, need });
  }
  return plan;
}

/**
 * Deterministic insert plan: one row per missing pass_sequence slot.
 * @returns {{ pass, pass_sequence }[]}
 */
function buildTicketInsertPlan(orderPasses, existingTickets) {
  const plan = [];
  for (const pass of orderPasses || []) {
    const qty = Math.max(0, Number(pass.quantity) || 0);
    const forPass = (existingTickets || []).filter((t) => t.order_pass_id === pass.id);
    const usedSeq = new Set(
      forPass.map((t) => t.pass_sequence).filter((s) => s != null && Number.isFinite(Number(s)))
    );
    const legacyCount = forPass.filter((t) => t.pass_sequence == null).length;
    for (let s = 0; s < legacyCount; s++) usedSeq.add(s);
    for (let seq = 0; seq < qty; seq++) {
      if (!usedSeq.has(seq)) {
        plan.push({ pass, pass_sequence: seq });
        usedSeq.add(seq);
      }
    }
  }
  return plan;
}

module.exports = {
  expectedTicketCount,
  ticketsNeededPerPass,
  buildTicketInsertPlan,
};
