import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const file = path.join(root, 'careerRoutes.cjs');
let s = fs.readFileSync(file, 'utf8');
const marker = '  // —— Admin: settings';
const i = s.indexOf(marker);
if (i < 0) throw new Error('Admin marker not found');
const head = s.slice(0, i);
let tail = s.slice(i);
const from = "if (!db) return careerServiceError(res, 500, 'Not configured');";
const to = 'const db = requireCareerAdminDb(res); if (!db) return;';
tail = tail.split(from).join(to);
fs.writeFileSync(file, head + tail);
console.log('Updated admin career route db checks:', tail.split(to).length - 1);
