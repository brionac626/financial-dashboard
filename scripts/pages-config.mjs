import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseEnv } from 'node:util';

export const settingNames = ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_PROJECT_NAME'];
const nonempty = value => typeof value === 'string' && value.trim() !== '';

export function loadPagesConfig(root, environment = process.env) {
  let fileValues = {};
  try { fileValues = parseEnv(readFileSync(join(root, '.env'), 'utf8')); }
  catch (error) {
    if (error.code !== 'ENOENT') throw new Error('Unable to read the project .env file.');
  }
  const settings = Object.fromEntries(settingNames.map(name => [name,
    nonempty(environment[name]) ? environment[name] : nonempty(fileValues[name]) ? fileValues[name] : '',
  ]));
  if (!settings.CLOUDFLARE_PROJECT_NAME) {
    try { settings.CLOUDFLARE_PROJECT_NAME = JSON.parse(readFileSync(join(root, 'wrangler.jsonc'), 'utf8')).name; }
    catch { throw new Error('Unable to read the project name from wrangler.jsonc.'); }
  }
  if (typeof settings.CLOUDFLARE_PROJECT_NAME !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(settings.CLOUDFLARE_PROJECT_NAME)) {
    throw new Error('Invalid Cloudflare Pages project name.');
  }
  return settings;
}
