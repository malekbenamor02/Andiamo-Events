var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// api/_lib/online-payment-fee.cjs
var require_online_payment_fee = __commonJS({
  "api/_lib/online-payment-fee.cjs"(exports2, module2) {
    "use strict";
    var DEFAULT_ONLINE_PAYMENT_FEE_RATE = 0.05;
    var MAX_ONLINE_PAYMENT_FEE_RATE = 0.5;
    function parseOnlinePaymentFeeRate(raw) {
      if (raw == null || String(raw).trim() === "") {
        return DEFAULT_ONLINE_PAYMENT_FEE_RATE;
      }
      const n = Number.parseFloat(String(raw).trim().replace(",", "."));
      if (!Number.isFinite(n) || n < 0) {
        return DEFAULT_ONLINE_PAYMENT_FEE_RATE;
      }
      return Math.min(MAX_ONLINE_PAYMENT_FEE_RATE, n);
    }
    function getOnlinePaymentFeeRate() {
      return parseOnlinePaymentFeeRate(process.env.ONLINE_PAYMENT_FEE_RATE);
    }
    function computeOnlinePaymentFees(subtotal) {
      const rate = getOnlinePaymentFeeRate();
      const sub = Number(subtotal);
      if (!Number.isFinite(sub) || sub <= 0) {
        return { feeRate: rate, feeAmount: 0, totalWithFees: 0 };
      }
      if (rate <= 0) {
        return { feeRate: rate, feeAmount: 0, totalWithFees: sub };
      }
      const feeAmount = Number((sub * rate).toFixed(3));
      const totalWithFees = sub + feeAmount;
      return { feeRate: rate, feeAmount, totalWithFees };
    }
    function inferFeeFromInclusiveTotal(inclusiveTotal) {
      const rate = getOnlinePaymentFeeRate();
      const t = Number(inclusiveTotal);
      if (!Number.isFinite(t) || t <= 0 || rate <= 0) {
        return void 0;
      }
      return Math.round(t * rate / (1 + rate) * 1e3) / 1e3;
    }
    module2.exports = {
      DEFAULT_ONLINE_PAYMENT_FEE_RATE,
      getOnlinePaymentFeeRate,
      computeOnlinePaymentFees,
      inferFeeFromInclusiveTotal
    };
  }
});

// api/_lib/online-payment-fee-shim.cjs
var require_online_payment_fee_shim = __commonJS({
  "api/_lib/online-payment-fee-shim.cjs"(exports2, module2) {
    "use strict";
    var { getOnlinePaymentFeeRate, computeOnlinePaymentFees } = require_online_payment_fee();
    function computeOnlinePaymentFeesDisplay2(subtotal) {
      return computeOnlinePaymentFees(subtotal);
    }
    module2.exports = {
      getOnlinePaymentFeeRate,
      computeOnlinePaymentFeesDisplay: computeOnlinePaymentFeesDisplay2
    };
  }
});

// api/_lib/reports-excel-server.src.ts
var reports_excel_server_src_exports = {};
__export(reports_excel_server_src_exports, {
  buildReportsExcelBuffer: () => buildReportsExcelBuffer
});
module.exports = __toCommonJS(reports_excel_server_src_exports);
var import_exceljs = __toESM(require("exceljs"), 1);

// src/lib/constants/orderStatusCatalog.js
var OrderStatusCatalog = Object.freeze({
  PENDING_ONLINE: "PENDING_ONLINE",
  REDIRECTED: "REDIRECTED",
  PENDING_CASH: "PENDING_CASH",
  PENDING_ADMIN_APPROVAL: "PENDING_ADMIN_APPROVAL",
  PAID: "PAID",
  FAILED: "FAILED",
  EXPIRED: "EXPIRED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
  CANCELLED_BY_ADMIN: "CANCELLED_BY_ADMIN",
  REMOVED_BY_ADMIN: "REMOVED_BY_ADMIN",
  CANCELLED_BY_AMBASSADOR: "CANCELLED_BY_AMBASSADOR",
  REFUNDED: "REFUNDED",
  COMPLETED: "COMPLETED",
  MANUAL_COMPLETED: "MANUAL_COMPLETED"
});
var PaymentStatusCatalog = Object.freeze({
  PENDING_PAYMENT: "PENDING_PAYMENT",
  PAID: "PAID",
  FAILED: "FAILED",
  REFUNDED: "REFUNDED",
  EXPIRED: "EXPIRED"
});
var ORDER_STATUS_PROMO_CLAIMED = Object.freeze([
  OrderStatusCatalog.PENDING_ONLINE,
  OrderStatusCatalog.REDIRECTED,
  OrderStatusCatalog.PENDING_CASH,
  OrderStatusCatalog.PENDING_ADMIN_APPROVAL
]);
var ORDER_STATUS_PROMO_SLOT_HELD = Object.freeze([
  OrderStatusCatalog.PAID,
  OrderStatusCatalog.COMPLETED,
  OrderStatusCatalog.MANUAL_COMPLETED,
  OrderStatusCatalog.REFUNDED
]);
var ORDER_STATUS_PROMO_SLOT_RELEASED = Object.freeze([
  OrderStatusCatalog.REJECTED,
  OrderStatusCatalog.FAILED,
  OrderStatusCatalog.EXPIRED,
  OrderStatusCatalog.REMOVED_BY_ADMIN,
  OrderStatusCatalog.CANCELLED,
  OrderStatusCatalog.CANCELLED_BY_ADMIN,
  OrderStatusCatalog.CANCELLED_BY_AMBASSADOR
]);
var PAYMENT_STATUS_PROMO_SLOT_RELEASED = Object.freeze([
  PaymentStatusCatalog.FAILED,
  PaymentStatusCatalog.EXPIRED
]);
var RELEASED_ORDER = new Set(ORDER_STATUS_PROMO_SLOT_RELEASED);
var RELEASED_PAYMENT = new Set(PAYMENT_STATUS_PROMO_SLOT_RELEASED);

// src/lib/constants/orderStatuses.ts
var OrderStatus = ((OrderStatus2) => {
  OrderStatus2[OrderStatus2["PENDING_ONLINE"] = OrderStatusCatalog.PENDING_ONLINE] = "PENDING_ONLINE";
  OrderStatus2[OrderStatus2["REDIRECTED"] = OrderStatusCatalog.REDIRECTED] = "REDIRECTED";
  OrderStatus2[OrderStatus2["PENDING_CASH"] = OrderStatusCatalog.PENDING_CASH] = "PENDING_CASH";
  OrderStatus2[OrderStatus2["PAID"] = OrderStatusCatalog.PAID] = "PAID";
  OrderStatus2[OrderStatus2["CANCELLED"] = OrderStatusCatalog.CANCELLED] = "CANCELLED";
  OrderStatus2[OrderStatus2["REMOVED_BY_ADMIN"] = OrderStatusCatalog.REMOVED_BY_ADMIN] = "REMOVED_BY_ADMIN";
  return OrderStatus2;
})(OrderStatus || {});
var PaymentStatus = ((PaymentStatus2) => {
  PaymentStatus2[PaymentStatus2["PENDING_PAYMENT"] = PaymentStatusCatalog.PENDING_PAYMENT] = "PENDING_PAYMENT";
  PaymentStatus2[PaymentStatus2["PAID"] = PaymentStatusCatalog.PAID] = "PAID";
  PaymentStatus2[PaymentStatus2["FAILED"] = PaymentStatusCatalog.FAILED] = "FAILED";
  PaymentStatus2[PaymentStatus2["REFUNDED"] = PaymentStatusCatalog.REFUNDED] = "REFUNDED";
  PaymentStatus2[PaymentStatus2["EXPIRED"] = PaymentStatusCatalog.EXPIRED] = "EXPIRED";
  return PaymentStatus2;
})(PaymentStatus || {});

// src/lib/eventPromo/promoOrder.ts
var PROMO_BADGE_PALETTE = [
  "#e11d48",
  "#ea580c",
  "#ca8a04",
  "#16a34a",
  "#0891b2",
  "#2563eb",
  "#7c3aed",
  "#db2777",
  "#0d9488",
  "#4f46e5"
];
var PALETTE_SET = new Set(PROMO_BADGE_PALETTE);
function isPromoBadgeColor(value) {
  return typeof value === "string" && PALETTE_SET.has(value);
}
function parsePromoOrderSnapshot(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const p = raw;
  const badgeColor = typeof p.badge_color === "string" ? p.badge_color : void 0;
  return {
    code_id: typeof p.code_id === "string" ? p.code_id : void 0,
    code: typeof p.code === "string" ? p.code : void 0,
    badge_color: isPromoBadgeColor(badgeColor) ? badgeColor : void 0,
    discount_type: typeof p.discount_type === "string" ? p.discount_type : void 0,
    discount_value: typeof p.discount_value === "number" ? p.discount_value : void 0,
    original_subtotal: typeof p.original_subtotal === "number" ? p.original_subtotal : void 0,
    discounted_subtotal: typeof p.discounted_subtotal === "number" ? p.discounted_subtotal : void 0,
    discount_amount: typeof p.discount_amount === "number" ? p.discount_amount : void 0,
    uses_claimed: typeof p.uses_claimed === "number" ? p.uses_claimed : void 0,
    discount_mode: p.discount_mode === "per_pass" ? "per_pass" : "uniform",
    pass_breakdown: Array.isArray(p.pass_breakdown) ? p.pass_breakdown.map((row) => ({
      pass_id: typeof row.pass_id === "string" ? row.pass_id : void 0,
      pass_name: typeof row.pass_name === "string" ? row.pass_name : void 0,
      discount_type: typeof row.discount_type === "string" ? row.discount_type : void 0,
      discount_value: typeof row.discount_value === "number" ? row.discount_value : void 0
    })) : void 0
  };
}
function parsePromoFromOrder(order) {
  try {
    const rawNotes = order?.notes;
    if (rawNotes == null || rawNotes === "") return null;
    const notesData = typeof rawNotes === "string" ? JSON.parse(rawNotes) : rawNotes;
    if (!notesData || typeof notesData !== "object") return null;
    return parsePromoOrderSnapshot(notesData.promo);
  } catch {
    return null;
  }
}

// src/lib/orders/orderAnalytics.ts
function isPaidPosOrder(order) {
  if (order.status !== "PAID" && order.status !== "COMPLETED") return false;
  return order.payment_method === "pos" || order.source === "point_de_vente";
}

// src/lib/orders/orderRevenue.ts
var import_onlinePaymentFee = __toESM(require_online_payment_fee_shim(), 1);

// src/lib/presale/presaleDiscount.ts
function parsePresaleOrderSnapshot(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const p = raw;
  const pass_breakdown = Array.isArray(p.pass_breakdown) ? p.pass_breakdown.map((row) => ({
    pass_id: typeof row.pass_id === "string" ? row.pass_id : void 0,
    pass_name: typeof row.pass_name === "string" ? row.pass_name : void 0,
    discount_type: typeof row.discount_type === "string" ? row.discount_type : void 0,
    discount_value: typeof row.discount_value === "number" ? row.discount_value : void 0,
    unit_list: typeof row.unit_list === "number" ? row.unit_list : void 0,
    unit_discounted: typeof row.unit_discounted === "number" ? row.unit_discounted : void 0,
    quantity: typeof row.quantity === "number" ? row.quantity : void 0
  })) : void 0;
  return {
    code_id: typeof p.code_id === "string" ? p.code_id : void 0,
    code_label: typeof p.code_label === "string" ? p.code_label : null,
    discount_mode: p.discount_mode === "per_pass" ? "per_pass" : "uniform",
    discount_type: typeof p.discount_type === "string" ? p.discount_type : void 0,
    discount_value: typeof p.discount_value === "number" ? p.discount_value : void 0,
    original_subtotal: typeof p.original_subtotal === "number" ? p.original_subtotal : void 0,
    discounted_subtotal: typeof p.discounted_subtotal === "number" ? p.discounted_subtotal : void 0,
    pass_breakdown
  };
}

// src/lib/orders/orderRevenue.ts
function getOrderDiscountedSubtotalFromNotes(order) {
  if (order.notes == null || order.notes === "") return null;
  try {
    const notesData = typeof order.notes === "string" ? JSON.parse(order.notes) : order.notes;
    if (!notesData || typeof notesData !== "object") return null;
    const promo = parsePromoFromOrder({ notes: notesData });
    if (promo?.discounted_subtotal != null && Number.isFinite(promo.discounted_subtotal)) {
      return promo.discounted_subtotal;
    }
    const presale = parsePresaleOrderSnapshot(
      notesData.presale
    );
    if (presale?.discounted_subtotal != null && Number.isFinite(presale.discounted_subtotal)) {
      return presale.discounted_subtotal;
    }
  } catch {
    return null;
  }
  return null;
}
function getOrderTicketsAndRevenue(order) {
  const subtotalFromNotes = getOrderDiscountedSubtotalFromNotes(order);
  const passes = order.order_passes;
  if (passes && Array.isArray(passes) && passes.length > 0) {
    let revenue2 = 0;
    let tickets2 = 0;
    passes.forEach((op) => {
      const q = op.quantity || 0;
      tickets2 += q;
      revenue2 += (op.price || 0) * q;
    });
    if (subtotalFromNotes != null) {
      return { tickets: tickets2, revenue: subtotalFromNotes };
    }
    return { tickets: tickets2, revenue: revenue2 };
  }
  const legacy = order.passes;
  if (legacy && Array.isArray(legacy) && legacy.length > 0) {
    let revenue2 = 0;
    let tickets2 = 0;
    legacy.forEach((op) => {
      const q = op.quantity || 0;
      tickets2 += q;
      revenue2 += (Number(op.price) || 0) * q;
    });
    if (subtotalFromNotes != null) {
      return { tickets: tickets2, revenue: subtotalFromNotes };
    }
    return { tickets: tickets2, revenue: revenue2 };
  }
  const tickets = order.quantity || 0;
  if (subtotalFromNotes != null) {
    return { tickets, revenue: subtotalFromNotes };
  }
  const fromPrice = Number(order.total_price);
  const fromTotal = Number(order.total);
  const revenue = Number.isFinite(fromPrice) ? fromPrice : Number.isFinite(fromTotal) ? fromTotal : 0;
  return { tickets, revenue };
}
function getOrderLineRevenue(order) {
  return getOrderTicketsAndRevenue(order).revenue;
}
function getPaymentFeesFromNotes(order) {
  if (order.notes == null || order.notes === "") return null;
  try {
    const notesData = typeof order.notes === "string" ? JSON.parse(order.notes) : order.notes;
    const f = notesData?.payment_fees;
    if (!f) return null;
    return {
      subtotal: typeof f.subtotal === "number" ? f.subtotal : void 0,
      fee_amount: typeof f.fee_amount === "number" ? f.fee_amount : void 0,
      total_with_fees: typeof f.total_with_fees === "number" ? f.total_with_fees : void 0
    };
  } catch {
    return null;
  }
}
function getOrderReportRevenue(order) {
  const line = getOrderLineRevenue(order);
  if (order.payment_method !== "online" /* ONLINE */) {
    return line;
  }
  const paidOnline = order.payment_status === "PAID" || order.status === "PAID" || order.status === "COMPLETED";
  if (!paidOnline) {
    return line;
  }
  const twf = Number(order.total_with_fees);
  if (Number.isFinite(twf)) {
    return twf;
  }
  const fromNotes = getPaymentFeesFromNotes(order);
  if (fromNotes?.total_with_fees != null) {
    return fromNotes.total_with_fees;
  }
  const discountedSubtotal = getOrderDiscountedSubtotalFromNotes(order);
  const feeBase = discountedSubtotal != null ? discountedSubtotal : line;
  if (feeBase > 0) {
    return Number((0, import_onlinePaymentFee.computeOnlinePaymentFeesDisplay)(feeBase).totalWithFees.toFixed(2));
  }
  const tp = Number(order.total_price);
  return Number.isFinite(tp) ? tp : line;
}

// api/_lib/reports-excel-server.src.ts
function getDateRangeFilter(dateRange) {
  const now = /* @__PURE__ */ new Date();
  now.setHours(23, 59, 59, 999);
  if (dateRange === "LAST_7_DAYS") {
    const start = new Date(now);
    start.setDate(start.getDate() - 7);
    start.setHours(0, 0, 0, 0);
    return { startDate: start, endDate: now };
  }
  if (dateRange === "LAST_30_DAYS") {
    const start = new Date(now);
    start.setDate(start.getDate() - 30);
    start.setHours(0, 0, 0, 0);
    return { startDate: start, endDate: now };
  }
  return { startDate: null, endDate: null };
}
function getDateRangeLabel(dateRange) {
  if (dateRange === "LAST_7_DAYS") return "Last 7 Days";
  if (dateRange === "LAST_30_DAYS") return "Last 30 Days";
  return "All Time";
}
var THEME = {
  primary: { argb: "FFE21836" },
  dark: { argb: "FF1A1A1A" },
  header: { argb: "FF2A2A2A" },
  headerDeep: { argb: "FF242424" },
  stripeA: { argb: "FF262626" },
  stripeB: { argb: "FF303030" },
  summaryBar: { argb: "FF2F2F2F" },
  white: { argb: "FFFFFFFF" },
  muted: { argb: "FFB8B8B8" },
  green: { argb: "FF10B981" },
  teal: { argb: "FF14B8A6" },
  border: { argb: "FF444444" },
  goldMuted: { argb: "FFFBBF24" }
};
var COPY = {
  en: {
    workbookTitle: "ANDIAMO EVENTS \u2014 SALES REPORT",
    summarySheet: "Summary",
    onlineSheet: "Online payments",
    ambSheet: "Ambassador sales",
    posSheet: "POS sales",
    summaryColChannel: "Channel",
    summaryAllChannelsPaid: "All channels (paid)",
    passesStockSheet: "Passes stock",
    period: "Period",
    event: "Event",
    allEvents: "All events",
    genAt: "Generated",
    totalOrders: "Total orders",
    totalTickets: "Total tickets",
    totalRevenue: "Total revenue",
    tnd: "TND",
    allOrders: "All orders (paid)",
    byAmbassador: "Summary by ambassador",
    ambColAmbassador: "Ambassador",
    ambColPhone: "Ambassador phone",
    ambColOrders: "Orders",
    ambColTickets: "Tickets",
    ambColRevenue: "Revenue (TND)",
    stockSection: "Pass stock by sales channel",
    passType: "Pass",
    soldOnline: "Online (qty)",
    soldAmbassador: "Ambassador (qty)",
    soldOtherChannels: "Other (POS / external) (qty)",
    soldTotal: "Total sold (Pass Stock)",
    stockPaidOnlyNote: "No event filter: pass names from paid orders only, for the report date range. Quantities include online, ambassador cash, and POS (point de vente).",
    stockPaidOnlyNoteEvent: "Paid online, ambassador cash, and POS (point de vente). Quantities from order_passes by pass id. Total = Online + Ambassador + POS for each pass.",
    stockStripOnline: "Online passes (total qty)",
    stockStripAmbassador: "Ambassador passes (total qty)",
    stockStripOther: "Other channels (total qty)",
    stockStripAll: "Total sold (Pass Stock)"
  },
  fr: {
    workbookTitle: "ANDIAMO EVENTS \u2014 RAPPORT DES VENTES",
    summarySheet: "Synth\xE8se",
    onlineSheet: "Paiements en ligne",
    ambSheet: "Ventes ambassadeurs",
    posSheet: "Ventes PDV",
    summaryColChannel: "Canal",
    summaryAllChannelsPaid: "Tous canaux (pay\xE9s)",
    period: "P\xE9riode",
    event: "\xC9v\xE9nement",
    allEvents: "Tous les \xE9v\xE9nements",
    genAt: "G\xE9n\xE9r\xE9",
    totalOrders: "Total commandes",
    totalTickets: "Total billets",
    totalRevenue: "Revenu total",
    tnd: "TND",
    allOrders: "Toutes les commandes (pay\xE9es)",
    byAmbassador: "Synth\xE8se par ambassadeur",
    ambColAmbassador: "Ambassadeur",
    ambColPhone: "T\xE9l\xE9phone ambassadeur",
    ambColOrders: "Commandes",
    ambColTickets: "Billets",
    ambColRevenue: "Revenu (TND)",
    passesStockSheet: "Stock billets",
    stockSection: "Stock des passes par canal",
    passType: "Pass",
    soldOnline: "En ligne (qt\xE9)",
    soldAmbassador: "Ambassadeurs (qt\xE9)",
    soldOtherChannels: "Autre (POS / externe) (qt\xE9)",
    soldTotal: "Total vendu (stock)",
    stockPaidOnlyNote: "Sans \xE9v\xE9nement : noms issus des commandes pay\xE9es, selon la p\xE9riode du rapport. Quantit\xE9s : en ligne, ambassadeurs et PDV (point de vente).",
    stockPaidOnlyNoteEvent: "Paiements en ligne, ambassadeurs (esp\xE8ces) et PDV (point de vente). Quantit\xE9s via order_passes par pass. Total = En ligne + Ambassadeurs + PDV pour chaque pass.",
    stockStripOnline: "Billets en ligne (qt\xE9 totale)",
    stockStripAmbassador: "Billets ambassadeurs (qt\xE9 totale)",
    stockStripOther: "Autres canaux (qt\xE9 totale)",
    stockStripAll: "Total vendu (stock passes)"
  }
};
var COL = {
  en: {
    orderNum: "Order #",
    orderId: "Order ID",
    created: "Created",
    status: "Status",
    customer: "Customer",
    phone: "Phone",
    email: "Email",
    city: "City",
    ville: "Area",
    passes: "Passes (detail)",
    tickets: "Tickets",
    lineRevenue: "Total without fees",
    totalPrice: "Total price",
    paymentMethod: "Payment method",
    source: "Source",
    completed: "Completed at",
    adminNotes: "Admin notes",
    ambassador: "Ambassador",
    ambPhone: "Amb. phone",
    event: "Event"
  },
  fr: {
    orderNum: "N\xB0 commande",
    orderId: "ID commande",
    created: "Cr\xE9\xE9e le",
    status: "Statut",
    customer: "Client",
    phone: "T\xE9l\xE9phone",
    email: "E-mail",
    city: "Ville",
    ville: "Zone",
    passes: "Billets (d\xE9tail)",
    tickets: "Quantit\xE9",
    lineRevenue: "Total hors frais",
    totalPrice: "Prix total",
    paymentMethod: "Moyen de paiement",
    source: "Source",
    completed: "Compl\xE9t\xE9e le",
    adminNotes: "Notes admin",
    ambassador: "Ambassadeur",
    ambPhone: "T\xE9l. amb.",
    event: "\xC9v\xE9nement"
  }
};
function thinBorder(color = THEME.border) {
  return {
    top: { style: "thin", color },
    bottom: { style: "thin", color },
    left: { style: "thin", color },
    right: { style: "thin", color }
  };
}
function formatDt(iso, lang) {
  if (!iso) return "\u2014";
  try {
    return new Date(iso).toLocaleString(lang === "fr" ? "fr-TN" : "en-GB", {
      dateStyle: "short",
      timeStyle: "short"
    });
  } catch {
    return String(iso);
  }
}
function formatPasses(order) {
  const passes = order.order_passes;
  if (passes && Array.isArray(passes) && passes.length > 0) {
    return passes.map((p) => `${p.pass_type} \xD7${p.quantity} @ ${p.price} TND`).join(" | ");
  }
  return "\u2014";
}
function safeStr(v, max = 500) {
  if (v == null || v === "") return "\u2014";
  const s = String(v);
  return s.length > max ? `${s.slice(0, max)}\u2026` : s;
}
function splitOrders(orders) {
  const online = orders.filter((o) => o.payment_method === "online" /* ONLINE */);
  const ambassador = orders.filter((o) => o.payment_method === "ambassador_cash" /* AMBASSADOR_CASH */);
  const pos = orders.filter((o) => isPaidPosOrder(o));
  return { online, ambassador, pos };
}
function sortAmbassadorOrdersAlphabetically(orders, lang) {
  const locale = lang === "fr" ? "fr" : "en";
  return [...orders].sort((a, b) => {
    const nameA = String(a.ambassadors?.full_name || "\uFFFF");
    const nameB = String(b.ambassadors?.full_name || "\uFFFF");
    const byName = nameA.localeCompare(nameB, locale, { sensitivity: "base" });
    if (byName !== 0) return byName;
    return String(a.created_at || "").localeCompare(String(b.created_at || ""));
  });
}
function ambassadorAggregateMap(ambassadorOrders) {
  const map = /* @__PURE__ */ new Map();
  for (const o of ambassadorOrders) {
    const id = o.ambassador_id || "_none";
    const name = o.ambassadors?.full_name || "\u2014";
    const phone = o.ambassadors?.phone || "\u2014";
    const tickets = getOrderTicketsAndRevenue(o).tickets;
    const revenue = getOrderReportRevenue(o);
    let cur = map.get(id);
    if (!cur) {
      cur = { name, phone, orders: 0, tickets: 0, revenue: 0, passesByType: /* @__PURE__ */ new Map() };
      map.set(id, cur);
    }
    cur.orders += 1;
    cur.tickets += tickets;
    cur.revenue += revenue;
    if (name !== "\u2014") cur.name = name;
    if (phone !== "\u2014") cur.phone = phone;
    if (o.order_passes?.length) {
      for (const p of o.order_passes) {
        const pt = String(p.pass_type || "\u2014");
        cur.passesByType.set(pt, (cur.passesByType.get(pt) || 0) + (Number(p.quantity) || 0));
      }
    } else if (o.pass_type) {
      const pt = String(o.pass_type);
      cur.passesByType.set(pt, (cur.passesByType.get(pt) || 0) + (Number(o.quantity) || 1));
    }
  }
  return map;
}
function collectPassTypesFromOrders(orders) {
  const s = /* @__PURE__ */ new Set();
  for (const o of orders) {
    if (o.order_passes?.length) {
      for (const p of o.order_passes) {
        if (p.pass_type) s.add(String(p.pass_type));
      }
    } else if (o.pass_type) {
      s.add(String(o.pass_type));
    }
  }
  return Array.from(s);
}
function resolvePassTypeColumns(eventId, ambassadorOrders, eventPassNames, lang) {
  const fromOrders = collectPassTypesFromOrders(ambassadorOrders);
  const fromEvent = eventId ? eventPassNames || [] : [];
  const locale = lang === "fr" ? "fr" : "en";
  return Array.from(/* @__PURE__ */ new Set([...fromEvent, ...fromOrders])).sort(
    (a, b) => a.localeCompare(b, locale, { sensitivity: "base" })
  );
}
function accumulatePassesSoldByType(orders) {
  const m = /* @__PURE__ */ new Map();
  for (const o of orders) {
    if (o.order_passes?.length) {
      for (const p of o.order_passes) {
        const pt = String(p.pass_type || "\u2014");
        m.set(pt, (m.get(pt) || 0) + (Number(p.quantity) || 0));
      }
    } else if (o.pass_type) {
      const pt = String(o.pass_type);
      m.set(pt, (m.get(pt) || 0) + (Number(o.quantity) || 1));
    }
  }
  return m;
}
function resolvePassTypesForStockSheet(eventId, onlineOrders, ambassadorOrders, posOrders, eventPassNames, lang) {
  const fromOnline = collectPassTypesFromOrders(onlineOrders);
  const fromAmb = collectPassTypesFromOrders(ambassadorOrders);
  const fromPos = collectPassTypesFromOrders(posOrders);
  const fromEvent = eventId ? eventPassNames || [] : [];
  const locale = lang === "fr" ? "fr" : "en";
  return Array.from(/* @__PURE__ */ new Set([...fromEvent, ...fromOnline, ...fromAmb, ...fromPos])).sort(
    (a, b) => a.localeCompare(b, locale, { sensitivity: "base" })
  );
}
function styleTitleRow(sheet, rowIndex, lastCol, title, subtitle) {
  sheet.mergeCells(rowIndex, 1, rowIndex, lastCol);
  const row = sheet.getRow(rowIndex);
  row.height = 36;
  const cell = row.getCell(1);
  cell.value = title;
  cell.font = { name: "Arial", size: 18, bold: true, color: THEME.white };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: THEME.primary };
  cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  cell.border = thinBorder(THEME.primary);
  sheet.mergeCells(rowIndex + 1, 1, rowIndex + 1, lastCol);
  const sub = sheet.getRow(rowIndex + 1);
  sub.height = 22;
  const c2 = sub.getCell(1);
  c2.value = subtitle;
  c2.font = { name: "Arial", size: 11, color: THEME.muted };
  c2.fill = { type: "pattern", pattern: "solid", fgColor: THEME.dark };
  c2.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  c2.border = thinBorder();
}
function setHeaderRow(sheet, rowIndex, labels) {
  const row = sheet.getRow(rowIndex);
  row.height = 26;
  labels.forEach((text, i) => {
    const cell = row.getCell(i + 1);
    cell.value = text;
    cell.font = { name: "Arial", size: 11, bold: true, color: THEME.white };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: THEME.header };
    cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    cell.border = thinBorder();
  });
}
function setDataRow(sheet, rowIndex, values, stripe, highlightColIndexes = []) {
  const row = sheet.getRow(rowIndex);
  row.height = 20;
  const bg = stripe ? THEME.stripeA : THEME.stripeB;
  values.forEach((val, i) => {
    const cell = row.getCell(i + 1);
    cell.value = val;
    const isNum = typeof val === "number";
    const bold = highlightColIndexes.includes(i);
    cell.font = {
      name: "Arial",
      size: 10,
      bold,
      color: isNum ? THEME.goldMuted : THEME.muted
    };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: bg };
    cell.alignment = {
      vertical: "middle",
      horizontal: isNum ? "right" : "left",
      wrapText: true
    };
    cell.border = thinBorder();
    if (isNum && !Number.isInteger(val)) {
      cell.numFmt = "0.00";
    }
  });
}
function setSummaryStrip(sheet, rowIndex, lastCol, items, accent) {
  const clr = accent === "green" ? THEME.green : THEME.teal;
  sheet.mergeCells(rowIndex, 1, rowIndex, lastCol);
  const row = sheet.getRow(rowIndex);
  row.height = 28;
  const cell = row.getCell(1);
  cell.value = items.map((x) => `${x.label}: ${x.value}`).join("   \u2022   ");
  cell.font = { name: "Arial", size: 12, bold: true, color: THEME.white };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: clr };
  cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  cell.border = thinBorder();
}
function setSectionLabel(sheet, rowIndex, lastCol, text) {
  sheet.mergeCells(rowIndex, 1, rowIndex, lastCol);
  const row = sheet.getRow(rowIndex);
  row.height = 24;
  const cell = row.getCell(1);
  cell.value = text;
  cell.font = { name: "Arial", size: 13, bold: true, color: THEME.white };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: THEME.headerDeep };
  cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  cell.border = thinBorder();
}
function setColumnWidths(sheet, widths) {
  widths.forEach((w, i) => {
    sheet.getColumn(i + 1).width = w;
  });
}
function orderRowOnline(order, lang) {
  const tickets = getOrderTicketsAndRevenue(order).tickets;
  const revenue = getOrderTicketsAndRevenue(order).revenue;
  const evt = order.events;
  const eventLabel = evt?.name ? `${evt.name}${evt.date ? ` (${String(evt.date).slice(0, 10)})` : ""}` : "\u2014";
  return [
    order.order_number ?? "\u2014",
    order.id,
    formatDt(order.created_at, lang),
    order.status ?? "\u2014",
    safeStr(order.user_name, 200),
    safeStr(order.user_phone || order.phone, 80),
    safeStr(order.user_email || order.email, 120),
    safeStr(order.city, 80),
    safeStr(order.ville, 80),
    eventLabel,
    formatPasses(order),
    tickets,
    Math.round(revenue * 100) / 100,
    Number(order.total_price) || 0,
    order.payment_method ?? "\u2014",
    order.source ?? "\u2014",
    formatDt(order.completed_at, lang),
    safeStr(order.admin_notes, 300)
  ];
}
function orderRowAmbassadorTable(order, lang) {
  const tickets = getOrderTicketsAndRevenue(order).tickets;
  const evt = order.events;
  const eventLabel = evt?.name ? `${evt.name}${evt.date ? ` (${String(evt.date).slice(0, 10)})` : ""}` : "\u2014";
  return [
    safeStr(order.ambassadors?.full_name, 120),
    safeStr(order.ambassadors?.phone, 40),
    order.order_number ?? "\u2014",
    formatDt(order.created_at, lang),
    order.status ?? "\u2014",
    safeStr(order.user_name, 200),
    safeStr(order.user_phone || order.phone, 80),
    safeStr(order.user_email || order.email, 120),
    safeStr(order.city, 80),
    safeStr(order.ville, 80),
    eventLabel,
    formatPasses(order),
    tickets,
    Number(order.total_price) || 0,
    order.payment_method ?? "\u2014",
    order.source ?? "\u2014",
    formatDt(order.completed_at, lang),
    safeStr(order.admin_notes, 300)
  ];
}
function onlineHeaders(lang) {
  const L = COL[lang];
  return [
    L.orderNum,
    L.orderId,
    L.created,
    L.status,
    L.customer,
    L.phone,
    L.email,
    L.city,
    L.ville,
    L.event,
    L.passes,
    L.tickets,
    L.lineRevenue,
    L.totalPrice,
    L.paymentMethod,
    L.source,
    L.completed,
    L.adminNotes
  ];
}
function ambassadorOrderHeaders(lang) {
  const L = COL[lang];
  return [
    L.ambassador,
    L.ambPhone,
    L.orderNum,
    L.created,
    L.status,
    L.customer,
    L.phone,
    L.email,
    L.city,
    L.ville,
    L.event,
    L.passes,
    L.tickets,
    L.totalPrice,
    L.paymentMethod,
    L.source,
    L.completed,
    L.adminNotes
  ];
}
function ambassadorSummaryHeaders(lang, passTypes) {
  const c = COPY[lang];
  return [c.ambColAmbassador, c.ambColPhone, c.ambColOrders, ...passTypes, c.ambColTickets, c.ambColRevenue];
}
function buildAmbassadorSummaryRows(roster, aggMap, passTypes, lang) {
  const rows = [];
  for (const a of roster) {
    const g = aggMap.get(a.id);
    const orders = g?.orders ?? 0;
    const tickets = g?.tickets ?? 0;
    const revenue = Math.round((g?.revenue ?? 0) * 100) / 100;
    const passCells = passTypes.map((pt) => g?.passesByType.get(pt) ?? 0);
    rows.push([a.full_name, a.phone, orders, ...passCells, tickets, revenue]);
  }
  if (aggMap.has("_none")) {
    const g = aggMap.get("_none");
    const passCells = passTypes.map((pt) => g.passesByType.get(pt) ?? 0);
    const unassigned = lang === "fr" ? "Non assign\xE9" : "Unassigned";
    rows.push([unassigned, "\u2014", g.orders, ...passCells, g.tickets, Math.round(g.revenue * 100) / 100]);
  }
  return rows;
}
function totalsLine(orders) {
  let tickets = 0;
  let revenueCents = 0;
  for (const o of orders) {
    tickets += getOrderTicketsAndRevenue(o).tickets;
    revenueCents += Math.round(getOrderReportRevenue(o) * 100);
  }
  return {
    count: orders.length,
    tickets,
    revenue: revenueCents / 100
  };
}
function slugify(s) {
  return s.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40) || "event";
}
function getWorkbookLockPassword() {
  const fromEnv = process.env.REPORTS_EXCEL_LOCK_PASSWORD;
  if (typeof fromEnv === "string" && fromEnv.trim().length > 0) {
    return fromEnv.trim();
  }
  return null;
}
async function protectWorkbookWorksheets(workbook, password) {
  const options = {
    selectLockedCells: true,
    selectUnlockedCells: true,
    formatCells: false,
    formatColumns: false,
    formatRows: false,
    insertColumns: false,
    insertRows: false,
    insertHyperlinks: false,
    deleteColumns: false,
    deleteRows: false,
    sort: false,
    autoFilter: true,
    pivotTables: false,
    objects: false,
    scenarios: false
  };
  for (const worksheet of workbook.worksheets) {
    await worksheet.protect(password, options);
  }
}
async function buildReportsExcelBuffer(params) {
  const lang = params.language ?? "en";
  const c = COPY[lang];
  const orders = params.orders || [];
  const { startDate, endDate } = getDateRangeFilter(params.dateRange);
  const periodLabel = getDateRangeLabel(params.dateRange);
  const eventLine = params.eventName ? `${c.event}: ${params.eventName}` : `${c.event}: ${c.allEvents}`;
  const metaBits = [
    eventLine,
    `${c.period}: ${periodLabel}${startDate && endDate ? ` (${startDate.toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB")} \u2013 ${endDate.toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB")})` : ""}`,
    `${c.genAt}: ${(/* @__PURE__ */ new Date()).toLocaleString(lang === "fr" ? "fr-TN" : "en-GB")}`
  ];
  const subtitle = metaBits.join("  \xB7  ");
  const { online, ambassador: ambassadorRaw, pos } = splitOrders(orders);
  const ambassador = sortAmbassadorOrdersAlphabetically(ambassadorRaw, lang);
  const onlineTot = totalsLine(online);
  const ambTot = totalsLine(ambassador);
  const posTot = totalsLine(pos);
  const grandTot = totalsLine(orders);
  const aggMap = ambassadorAggregateMap(ambassador);
  const passTypes = resolvePassTypeColumns(params.eventId, ambassador, params.eventPassNames, lang);
  let roster = [...params.ambassadorRoster || []];
  const rosterIds = new Set(roster.map((x) => x.id));
  for (const [id, g] of aggMap) {
    if (id === "_none") continue;
    if (!rosterIds.has(id)) {
      roster.push({ id, full_name: g.name, phone: g.phone });
      rosterIds.add(id);
    }
  }
  const loc = lang === "fr" ? "fr" : "en";
  roster = roster.sort((a, b) => a.full_name.localeCompare(b.full_name, loc, { sensitivity: "base" }));
  const summaryRows = buildAmbassadorSummaryRows(roster, aggMap, passTypes, lang);
  let stockPassTypes = [];
  let onlineByPass = /* @__PURE__ */ new Map();
  let ambByPass = /* @__PURE__ */ new Map();
  let posByPass = /* @__PURE__ */ new Map();
  let passStockEventRows = params.passStockRows ?? null;
  if (params.eventId && passStockEventRows == null) {
    passStockEventRows = [];
  }
  if (!params.eventId) {
    stockPassTypes = resolvePassTypesForStockSheet(null, online, ambassador, pos, params.eventPassNames, lang);
    onlineByPass = accumulatePassesSoldByType(online);
    ambByPass = accumulatePassesSoldByType(ambassador);
    posByPass = accumulatePassesSoldByType(pos);
  }
  const workbook = new import_exceljs.default.Workbook();
  workbook.creator = "Andiamo Events";
  workbook.created = /* @__PURE__ */ new Date();
  const lastColOnline = onlineHeaders(lang).length;
  const lastColAmbOrder = ambassadorOrderHeaders(lang).length;
  const sumColCount = ambassadorSummaryHeaders(lang, passTypes).length;
  const lastColAmbSheet = Math.max(lastColAmbOrder, sumColCount);
  const lastColSummary = 4;
  const wsSum = workbook.addWorksheet(c.summarySheet, {
    views: [{ state: "frozen", ySplit: 6 }]
  });
  styleTitleRow(wsSum, 1, lastColSummary, c.workbookTitle, subtitle);
  let rSum = 3;
  wsSum.getRow(rSum).height = 8;
  rSum += 1;
  setSummaryStrip(
    wsSum,
    rSum,
    lastColSummary,
    [
      { label: c.totalOrders, value: String(grandTot.count) },
      { label: c.totalTickets, value: String(grandTot.tickets) },
      { label: c.totalRevenue, value: `${grandTot.revenue.toLocaleString(lang === "fr" ? "fr-FR" : "en-GB")} ${c.tnd}` }
    ],
    "teal"
  );
  rSum += 1;
  wsSum.getRow(rSum).height = 6;
  rSum += 1;
  setHeaderRow(wsSum, rSum, [c.summaryColChannel, c.totalOrders, c.totalTickets, c.totalRevenue]);
  rSum += 1;
  const sumRows = [
    [c.onlineSheet, onlineTot.count, onlineTot.tickets, Math.round(onlineTot.revenue * 100) / 100],
    [c.ambSheet, ambTot.count, ambTot.tickets, Math.round(ambTot.revenue * 100) / 100],
    [c.posSheet, posTot.count, posTot.tickets, Math.round(posTot.revenue * 100) / 100]
  ];
  sumRows.forEach((cells, i) => {
    setDataRow(wsSum, rSum, cells, i % 2 === 0, [1, 2, 3]);
    rSum += 1;
  });
  const sumTotRow = [
    c.summaryAllChannelsPaid,
    grandTot.count,
    grandTot.tickets,
    Math.round(grandTot.revenue * 100) / 100
  ];
  setDataRow(wsSum, rSum, sumTotRow, true, [1, 2, 3]);
  const sumTotalRow = wsSum.getRow(rSum);
  for (let col = 1; col <= lastColSummary; col++) {
    const cell = sumTotalRow.getCell(col);
    cell.font = { name: "Arial", size: 10, bold: true, color: THEME.white };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: THEME.primary };
    cell.border = thinBorder(THEME.primary);
  }
  rSum += 1;
  setColumnWidths(wsSum, [36, 14, 14, 22]);
  const wsOn = workbook.addWorksheet(c.onlineSheet, {
    views: [{ state: "frozen", ySplit: 7 }]
  });
  styleTitleRow(wsOn, 1, lastColOnline, c.workbookTitle, subtitle);
  let r = 3;
  wsOn.getRow(r).height = 8;
  r += 1;
  setSummaryStrip(
    wsOn,
    r,
    lastColOnline,
    [
      { label: c.totalOrders, value: String(onlineTot.count) },
      { label: c.totalTickets, value: String(onlineTot.tickets) },
      { label: c.totalRevenue, value: `${onlineTot.revenue.toLocaleString(lang === "fr" ? "fr-FR" : "en-GB")} ${c.tnd}` }
    ],
    "teal"
  );
  r += 1;
  wsOn.getRow(r).height = 6;
  r += 1;
  setSectionLabel(wsOn, r, lastColOnline, c.allOrders);
  r += 1;
  setHeaderRow(wsOn, r, onlineHeaders(lang));
  r += 1;
  const revCol = onlineHeaders(lang).indexOf(COL[lang].lineRevenue);
  online.forEach((order, i) => {
    setDataRow(wsOn, r, orderRowOnline(order, lang), i % 2 === 0, [revCol, revCol + 1]);
    r += 1;
  });
  setColumnWidths(wsOn, [
    10,
    38,
    18,
    12,
    22,
    14,
    28,
    14,
    14,
    36,
    42,
    10,
    14,
    12,
    14,
    16,
    18,
    32
  ]);
  const wsAm = workbook.addWorksheet(c.ambSheet, {
    views: [{ state: "frozen", ySplit: 7 }]
  });
  styleTitleRow(wsAm, 1, lastColAmbSheet, c.workbookTitle, subtitle);
  r = 3;
  wsAm.getRow(r).height = 8;
  r += 1;
  setSummaryStrip(
    wsAm,
    r,
    lastColAmbSheet,
    [
      { label: c.totalOrders, value: String(ambTot.count) },
      { label: c.totalTickets, value: String(ambTot.tickets) },
      { label: c.totalRevenue, value: `${ambTot.revenue.toLocaleString(lang === "fr" ? "fr-FR" : "en-GB")} ${c.tnd}` }
    ],
    "green"
  );
  r += 1;
  wsAm.getRow(r).height = 6;
  r += 1;
  setSectionLabel(wsAm, r, lastColAmbSheet, c.allOrders);
  r += 1;
  setHeaderRow(wsAm, r, ambassadorOrderHeaders(lang));
  r += 1;
  const hdr = ambassadorOrderHeaders(lang);
  const totColAm = hdr.indexOf(COL[lang].totalPrice);
  ambassador.forEach((order, i) => {
    setDataRow(wsAm, r, orderRowAmbassadorTable(order, lang), i % 2 === 0, [0, 1, totColAm]);
    r += 1;
  });
  r += 1;
  wsAm.getRow(r).height = 8;
  r += 1;
  setSectionLabel(wsAm, r, lastColAmbSheet, c.byAmbassador);
  r += 1;
  setHeaderRow(wsAm, r, ambassadorSummaryHeaders(lang, passTypes));
  r += 1;
  const nPass = passTypes.length;
  const ticketIdx = 3 + nPass;
  const revIdx = 4 + nPass;
  const summaryHighlights = [2, ticketIdx, revIdx, ...Array.from({ length: nPass }, (_, i) => 3 + i)];
  summaryRows.forEach((cells, i) => {
    setDataRow(wsAm, r, cells, i % 2 === 0, summaryHighlights);
    r += 1;
  });
  const totOrdersAmb = summaryRows.reduce((s, row) => s + Number(row[2]), 0);
  const passTotals = passTypes.map((_, i) => summaryRows.reduce((s, row) => s + Number(row[3 + i]), 0));
  const totTicketsAmb = summaryRows.reduce((s, row) => s + Number(row[ticketIdx]), 0);
  const totRevAmb = Math.round(summaryRows.reduce((s, row) => s + Number(row[revIdx]), 0) * 100) / 100;
  const totalCells = ["TOTAL", "\u2014", totOrdersAmb, ...passTotals, totTicketsAmb, totRevAmb];
  setDataRow(wsAm, r, totalCells, true, summaryHighlights);
  const totalRow = wsAm.getRow(r);
  for (let col = 1; col <= totalCells.length; col++) {
    const cell = totalRow.getCell(col);
    cell.font = { name: "Arial", size: 10, bold: true, color: THEME.white };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: THEME.primary };
    cell.border = thinBorder(THEME.primary);
  }
  r += 1;
  const ambOrderWidths = [20, 14, 10, 18, 12, 22, 14, 28, 14, 14, 36, 42, 10, 12, 14, 16, 18, 32];
  const ambWidths = [...ambOrderWidths];
  while (ambWidths.length < sumColCount) {
    ambWidths.push(12);
  }
  setColumnWidths(wsAm, ambWidths);
  const wsPos = workbook.addWorksheet(c.posSheet, {
    views: [{ state: "frozen", ySplit: 7 }]
  });
  styleTitleRow(wsPos, 1, lastColOnline, c.workbookTitle, subtitle);
  r = 3;
  wsPos.getRow(r).height = 8;
  r += 1;
  setSummaryStrip(
    wsPos,
    r,
    lastColOnline,
    [
      { label: c.totalOrders, value: String(posTot.count) },
      { label: c.totalTickets, value: String(posTot.tickets) },
      { label: c.totalRevenue, value: `${posTot.revenue.toLocaleString(lang === "fr" ? "fr-FR" : "en-GB")} ${c.tnd}` }
    ],
    "green"
  );
  r += 1;
  wsPos.getRow(r).height = 6;
  r += 1;
  setSectionLabel(wsPos, r, lastColOnline, c.allOrders);
  r += 1;
  setHeaderRow(wsPos, r, onlineHeaders(lang));
  r += 1;
  const revColPos = onlineHeaders(lang).indexOf(COL[lang].lineRevenue);
  pos.forEach((order, i) => {
    setDataRow(wsPos, r, orderRowOnline(order, lang), i % 2 === 0, [revColPos, revColPos + 1]);
    r += 1;
  });
  setColumnWidths(wsPos, [
    10,
    38,
    18,
    12,
    22,
    14,
    28,
    14,
    14,
    36,
    42,
    10,
    14,
    12,
    14,
    16,
    18,
    32
  ]);
  const wsStock = workbook.addWorksheet(c.passesStockSheet, {
    views: [{ state: "frozen", ySplit: 8 }]
  });
  let rs = 3;
  if (passStockEventRows) {
    const lastColStock = 5;
    const totO = passStockEventRows.reduce((s, r2) => s + r2.online, 0);
    const totA = passStockEventRows.reduce((s, r2) => s + r2.ambassador, 0);
    const totOther = passStockEventRows.reduce((s, r2) => s + r2.other, 0);
    const totSoldQty = passStockEventRows.reduce((s, r2) => s + r2.total, 0);
    styleTitleRow(wsStock, 1, lastColStock, c.workbookTitle, subtitle);
    wsStock.getRow(rs).height = 8;
    rs += 1;
    setSummaryStrip(
      wsStock,
      rs,
      lastColStock,
      [
        { label: c.stockStripOnline, value: String(totO) },
        { label: c.stockStripAmbassador, value: String(totA) },
        { label: c.stockStripOther, value: String(totOther) },
        { label: c.stockStripAll, value: String(totSoldQty) }
      ],
      "teal"
    );
    rs += 1;
    wsStock.getRow(rs).height = 6;
    rs += 1;
    setSectionLabel(wsStock, rs, lastColStock, c.stockSection);
    rs += 1;
    wsStock.mergeCells(rs, 1, rs, lastColStock);
    const noteRowEv = wsStock.getRow(rs);
    noteRowEv.height = 20;
    const noteCellEv = noteRowEv.getCell(1);
    noteCellEv.value = c.stockPaidOnlyNoteEvent;
    noteCellEv.font = { name: "Arial", size: 9, italic: true, color: THEME.muted };
    noteCellEv.fill = { type: "pattern", pattern: "solid", fgColor: THEME.dark };
    noteCellEv.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    noteCellEv.border = thinBorder();
    rs += 1;
    setHeaderRow(wsStock, rs, [
      c.passType,
      c.soldOnline,
      c.soldAmbassador,
      c.soldOtherChannels,
      c.soldTotal
    ]);
    rs += 1;
    const stockHighlightsEv = [1, 2, 3, 4, 5];
    passStockEventRows.forEach((row, i) => {
      setDataRow(
        wsStock,
        rs,
        [row.name, row.online, row.ambassador, row.other, row.total],
        i % 2 === 0,
        stockHighlightsEv
      );
      rs += 1;
    });
    const stockTotalCellsEv = ["TOTAL", totO, totA, totOther, totSoldQty];
    setDataRow(wsStock, rs, stockTotalCellsEv, true, stockHighlightsEv);
    const stockTotalRowEv = wsStock.getRow(rs);
    for (let col = 1; col <= lastColStock; col++) {
      const cell = stockTotalRowEv.getCell(col);
      cell.font = { name: "Arial", size: 10, bold: true, color: THEME.white };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: THEME.primary };
      cell.border = thinBorder(THEME.primary);
    }
    rs += 1;
    setColumnWidths(wsStock, [42, 16, 18, 22, 18]);
  } else {
    const lastColStock = 5;
    const totalOnlinePassesQty = [...onlineByPass.values()].reduce((a, b) => a + b, 0);
    const totalAmbPassesQty = [...ambByPass.values()].reduce((a, b) => a + b, 0);
    const totalPosPassesQty = [...posByPass.values()].reduce((a, b) => a + b, 0);
    styleTitleRow(wsStock, 1, lastColStock, c.workbookTitle, subtitle);
    wsStock.getRow(rs).height = 8;
    rs += 1;
    setSummaryStrip(
      wsStock,
      rs,
      lastColStock,
      [
        { label: c.stockStripOnline, value: String(totalOnlinePassesQty) },
        { label: c.stockStripAmbassador, value: String(totalAmbPassesQty) },
        { label: c.stockStripOther, value: String(totalPosPassesQty) },
        { label: c.stockStripAll, value: String(totalOnlinePassesQty + totalAmbPassesQty + totalPosPassesQty) }
      ],
      "teal"
    );
    rs += 1;
    wsStock.getRow(rs).height = 6;
    rs += 1;
    setSectionLabel(wsStock, rs, lastColStock, c.stockSection);
    rs += 1;
    wsStock.mergeCells(rs, 1, rs, lastColStock);
    const noteRow = wsStock.getRow(rs);
    noteRow.height = 20;
    const noteCell = noteRow.getCell(1);
    noteCell.value = c.stockPaidOnlyNote;
    noteCell.font = { name: "Arial", size: 9, italic: true, color: THEME.muted };
    noteCell.fill = { type: "pattern", pattern: "solid", fgColor: THEME.dark };
    noteCell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    noteCell.border = thinBorder();
    rs += 1;
    setHeaderRow(wsStock, rs, [
      c.passType,
      c.soldOnline,
      c.soldAmbassador,
      c.soldOtherChannels,
      c.soldTotal
    ]);
    rs += 1;
    const stockHighlights = [1, 2, 3, 4, 5];
    stockPassTypes.forEach((pt, i) => {
      const oq = onlineByPass.get(pt) ?? 0;
      const aq = ambByPass.get(pt) ?? 0;
      const pq = posByPass.get(pt) ?? 0;
      setDataRow(wsStock, rs, [pt, oq, aq, pq, oq + aq + pq], i % 2 === 0, stockHighlights);
      rs += 1;
    });
    const totO = stockPassTypes.reduce((s, pt) => s + (onlineByPass.get(pt) ?? 0), 0);
    const totA = stockPassTypes.reduce((s, pt) => s + (ambByPass.get(pt) ?? 0), 0);
    const totP = stockPassTypes.reduce((s, pt) => s + (posByPass.get(pt) ?? 0), 0);
    const stockTotalCells = ["TOTAL", totO, totA, totP, totO + totA + totP];
    setDataRow(wsStock, rs, stockTotalCells, true, stockHighlights);
    const stockTotalRow = wsStock.getRow(rs);
    for (let col = 1; col <= lastColStock; col++) {
      const cell = stockTotalRow.getCell(col);
      cell.font = { name: "Arial", size: 10, bold: true, color: THEME.white };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: THEME.primary };
      cell.border = thinBorder(THEME.primary);
    }
    rs += 1;
    setColumnWidths(wsStock, [42, 16, 18, 22, 18]);
  }
  const lockPassword = getWorkbookLockPassword();
  if (lockPassword) {
    try {
      await protectWorkbookWorksheets(workbook, lockPassword);
    } catch (e) {
      console.warn("[reportsExcelExport] Worksheet protection failed:", e);
    }
  }
  const buf = await workbook.xlsx.writeBuffer();
  const filename = `Andiamo_Report_${params.eventId ? slugify(params.eventName || "event") : "all_events"}_${periodLabel.replace(/\s+/g, "_")}_${Date.now()}.xlsx`;
  return { buffer: Buffer.from(buf), filename, rowCount: orders.length };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  buildReportsExcelBuffer
});
