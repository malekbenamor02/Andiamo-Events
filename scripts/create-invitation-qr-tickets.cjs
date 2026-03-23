#!/usr/bin/env node
/**
 * Run on your machine only (not deployed). Uses service role from .env.
 *
 * Interactive CLI: inserts qr_tickets with source='Invitation', payment_method='external_app',
 * uploads QR PNGs to the same Supabase `tickets` bucket as online orders, and sends email
 * via buildOnlineTicketEmailHtml (official online ticket template).
 *
 * Requires .env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, EMAIL_HOST, EMAIL_USER, EMAIL_PASS
 *
 *   node scripts/create-invitation-qr-tickets.cjs
 */

'use strict';

const path = require('path');
const readline = require('readline');
const { randomUUID } = require('crypto');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');
const QRCode = require('qrcode');

const { buildOnlineTicketEmailHtml } = require(path.join(
  __dirname,
  '..',
  'api',
  'lib',
  'online-ticket-email-html.cjs'
));

function getEmailTransporter() {
  const host = process.env.EMAIL_HOST;
  const port = parseInt(process.env.EMAIL_PORT || '587', 10);
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  if (!host || !user || !pass) {
    throw new Error('Email configuration incomplete (EMAIL_HOST, EMAIL_USER, EMAIL_PASS).');
  }
  return nodemailer.createTransport({
    host,
    port,
    secure: false,
    requireTLS: true,
    tls: { rejectUnauthorized: false },
    auth: { user: user.trim(), pass },
  });
}

function ask(rl, q) {
  return new Promise((resolve) => rl.question(q, resolve));
}

function parseIndex(line, max) {
  const n = parseInt(String(line).trim(), 10);
  if (!Number.isFinite(n) || n < 1 || n > max) return null;
  return n - 1;
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
  }

  const sb = createClient(url, key);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  try {
    const nowIso = new Date().toISOString();
    const { data: events, error: evErr } = await sb
      .from('events')
      .select('id, name, date, venue, city, event_status')
      .gte('date', nowIso)
      .order('date', { ascending: true });
    if (evErr) throw evErr;
    const list = (events || []).filter((e) => e.event_status !== 'cancelled');

    if (!list.length) {
      console.log('No upcoming events found.');
      process.exit(0);
    }

    console.log('\nUpcoming events:\n');
    list.forEach((e, i) => {
      console.log(`  ${i + 1}. ${e.name} — ${e.date} (${e.city || '—'})`);
    });
    const evPick = parseIndex(await ask(rl, '\nSelect event number: '), list.length);
    if (evPick === null) {
      console.error('Invalid selection.');
      process.exit(1);
    }
    const event = list[evPick];

    const { data: passes, error: pErr } = await sb
      .from('event_passes')
      .select('id, name, price')
      .eq('event_id', event.id)
      .eq('is_active', true)
      .order('price', { ascending: true });

    if (pErr) throw pErr;
    if (!passes?.length) {
      console.log('No active passes for this event.');
      process.exit(0);
    }

    console.log('\nPasses:\n');
    passes.forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.name} — ${Number(p.price).toFixed(2)} TND`);
    });
    const passPick = parseIndex(await ask(rl, '\nSelect pass number: '), passes.length);
    if (passPick === null) {
      console.error('Invalid selection.');
      process.exit(1);
    }
    const pass = passes[passPick];

    const qtyRaw = await ask(rl, 'Quantity (integer): ');
    const quantity = parseInt(String(qtyRaw).trim(), 10);
    if (!Number.isFinite(quantity) || quantity < 1 || quantity > 500) {
      console.error('Invalid quantity (use 1–500).');
      process.exit(1);
    }

    const buyerName = String(await ask(rl, 'Buyer full name: ')).trim();
    const buyerEmail = String(await ask(rl, 'Buyer email: ')).trim();
    const buyerCity = String(await ask(rl, 'Buyer city: ')).trim();
    const buyerPhone = String(
      await ask(rl, 'Buyer phone (Enter for N/A — stored in qr_tickets): ')
    ).trim() || 'N/A';

    if (!buyerName || !buyerEmail || !buyerCity) {
      console.error('Name, email, and city are required.');
      process.exit(1);
    }

    const unit = Number(pass.price);
    const totalAmount = unit * quantity;
    const syntheticOrderId = randomUUID();

    console.log('\n—— Summary ——');
    console.log(`Event:   ${event.name}`);
    console.log(`Pass:    ${pass.name} x ${quantity} @ ${unit.toFixed(2)} TND`);
    console.log(`Total:   ${totalAmount.toFixed(2)} TND`);
    console.log(`Buyer:   ${buyerName} <${buyerEmail}>`);
    console.log(`City:    ${buyerCity}`);
    console.log(`Phone:   ${buyerPhone}`);
    console.log(`source=Invitation | payment_method=external_app`);
    console.log('Creates rows only in qr_tickets (+ ticket images in storage).');

    const ok = String(await ask(rl, '\nType YES to confirm: ')).trim().toUpperCase();
    if (ok !== 'YES') {
      console.log('Aborted.');
      process.exit(0);
    }

    const storagePrefix = `tickets/invitation-cli/${syntheticOrderId}`;
    const rows = [];
    const ticketsForMap = [];

    for (let i = 0; i < quantity; i++) {
      const secureToken = randomUUID();
      const fileName = `${storagePrefix}/${secureToken}.png`;
      const qrCodeBuffer = await QRCode.toBuffer(secureToken, {
        type: 'png',
        width: 500,
        margin: 2,
      });

      const { error: upErr } = await sb.storage.from('tickets').upload(fileName, qrCodeBuffer, {
        contentType: 'image/png',
        upsert: true,
      });
      if (upErr) throw new Error(`Storage upload failed: ${upErr.message}`);

      const { data: urlData } = sb.storage.from('tickets').getPublicUrl(fileName);
      const publicUrl = urlData?.publicUrl || null;
      if (!publicUrl) throw new Error('Could not resolve public URL for QR image.');

      const generatedAt = new Date().toISOString();
      rows.push({
        secure_token: secureToken,
        ticket_id: null,
        order_id: null,
        order_pass_id: null,
        invitation_id: null,
        source: 'Invitation',
        payment_method: 'external_app',
        ambassador_id: null,
        ambassador_name: null,
        ambassador_phone: null,
        buyer_name: buyerName,
        buyer_phone: buyerPhone,
        buyer_email: buyerEmail,
        buyer_city: buyerCity,
        buyer_ville: null,
        event_id: event.id,
        event_name: event.name,
        event_date: event.date,
        event_venue: event.venue || null,
        event_city: event.city || null,
        pass_type: pass.name,
        pass_price: unit,
        ticket_status: 'VALID',
        qr_code_url: publicUrl,
        generated_at: generatedAt,
      });

      ticketsForMap.push({ qr_code_url: publicUrl, secure_token: secureToken });
    }

    const { error: insErr } = await sb.from('qr_tickets').insert(rows);
    if (insErr) throw insErr;

    const ticketsByPassType = new Map([[pass.name, ticketsForMap]]);
    const emailHtml = buildOnlineTicketEmailHtml({
      customerName: buyerName,
      orderNumber: null,
      orderId: syntheticOrderId,
      eventName: event.name,
      eventTime: event.date,
      venueName: event.venue,
      passes: [{ passType: pass.name, quantity, price: unit }],
      totalAmount,
      feeAmount: undefined,
      subtotalAmount: undefined,
      ticketsByPassType,
    });

    const transporter = getEmailTransporter();
    await transporter.sendMail({
      from: '"Andiamo Events" <contact@andiamoevents.com>',
      replyTo: '"Andiamo Events" <contact@andiamoevents.com>',
      to: buyerEmail,
      subject: 'Your Digital Tickets Are Ready - Andiamo Events',
      html: emailHtml,
    });

    console.log(`\nDone. ${quantity} qr_tickets inserted; email sent to ${buyerEmail}.`);
  } catch (e) {
    console.error(e.message || e);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();
