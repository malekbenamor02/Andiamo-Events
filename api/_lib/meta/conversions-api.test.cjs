'use strict';

const test = require('node:test');
const assert = require('node:assert');

test('canSendCapiEvents allows production when configured', () => {
  const prevNodeEnv = process.env.NODE_ENV;
  const prevPixel = process.env.META_PIXEL_ID;
  const prevToken = process.env.META_CAPI_ACCESS_TOKEN;
  const prevTestCode = process.env.META_CAPI_TEST_EVENT_CODE;

  process.env.NODE_ENV = 'production';
  process.env.META_PIXEL_ID = '123';
  process.env.META_CAPI_ACCESS_TOKEN = 'secret';
  delete process.env.META_CAPI_TEST_EVENT_CODE;

  delete require.cache[require.resolve('./conversions-api.cjs')];
  const { canSendCapiEvents } = require('./conversions-api.cjs');
  assert.strictEqual(canSendCapiEvents(), true);

  process.env.NODE_ENV = prevNodeEnv;
  process.env.META_PIXEL_ID = prevPixel;
  process.env.META_CAPI_ACCESS_TOKEN = prevToken;
  if (prevTestCode != null) process.env.META_CAPI_TEST_EVENT_CODE = prevTestCode;
  else delete process.env.META_CAPI_TEST_EVENT_CODE;
  delete require.cache[require.resolve('./conversions-api.cjs')];
});

test('canSendCapiEvents blocks non-production without test code', () => {
  const prevNodeEnv = process.env.NODE_ENV;
  const prevPixel = process.env.META_PIXEL_ID;
  const prevToken = process.env.META_CAPI_ACCESS_TOKEN;
  const prevTestCode = process.env.META_CAPI_TEST_EVENT_CODE;

  process.env.NODE_ENV = 'development';
  process.env.META_PIXEL_ID = '123';
  process.env.META_CAPI_ACCESS_TOKEN = 'secret';
  delete process.env.META_CAPI_TEST_EVENT_CODE;

  delete require.cache[require.resolve('./conversions-api.cjs')];
  const { canSendCapiEvents } = require('./conversions-api.cjs');
  assert.strictEqual(canSendCapiEvents(), false);

  process.env.META_CAPI_TEST_EVENT_CODE = 'TEST12345';
  delete require.cache[require.resolve('./conversions-api.cjs')];
  const { canSendCapiEvents: canSendWithTest } = require('./conversions-api.cjs');
  assert.strictEqual(canSendWithTest(), true);

  process.env.NODE_ENV = prevNodeEnv;
  process.env.META_PIXEL_ID = prevPixel;
  process.env.META_CAPI_ACCESS_TOKEN = prevToken;
  if (prevTestCode != null) process.env.META_CAPI_TEST_EVENT_CODE = prevTestCode;
  else delete process.env.META_CAPI_TEST_EVENT_CODE;
  delete require.cache[require.resolve('./conversions-api.cjs')];
});
