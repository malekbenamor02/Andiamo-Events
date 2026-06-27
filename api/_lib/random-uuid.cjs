'use strict';

const crypto = require('node:crypto');

/** RFC 4122 v4 UUID via Node built-in (no external uuid package in serverless). */
function randomUuid() {
  return crypto.randomUUID();
}

module.exports = { randomUuid };
