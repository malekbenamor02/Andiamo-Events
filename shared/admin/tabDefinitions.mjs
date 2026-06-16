import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { ADMIN_TAB_DEFINITIONS } = require('./tabDefinitions.cjs');

export { ADMIN_TAB_DEFINITIONS };
