import assert from 'node:assert/strict';
import test from 'node:test';
import { EnvCryptoService } from './env.crypto';
import { parseEnv, validateEnv } from './env.validation';

function cryptoService() {
  process.env.ENV_MASTER_KEY_FILE = 'missing-test-key';
  process.env.ENCRYPTION_MASTER_KEY = Buffer.alloc(32, 7).toString('base64');
  return new EnvCryptoService();
}

test('AES-256-GCM encrypts with unique IVs and authenticates context', () => {
  const service=cryptoService(), first=service.encrypt('bot-1','BOT_TOKEN','super-secret'), second=service.encrypt('bot-1','BOT_TOKEN','super-secret');
  assert.notDeepEqual(first.iv,second.iv);
  assert.notDeepEqual(first.encryptedValue,Uint8Array.from(Buffer.from('super-secret')));
  assert.equal(service.decrypt('bot-1','BOT_TOKEN',first),'super-secret');
  assert.throws(()=>service.decrypt('bot-2','BOT_TOKEN',first));
  first.authTag[0]^=1;
  assert.throws(()=>service.decrypt('bot-1','BOT_TOKEN',first));
});

test('bulk parser accepts spaces, equals and quotes', () => {
  assert.deepEqual(parseEnv("# comment\nBOT_TOKEN='abc = 123'\nexport MODE=production"),[
    {key:'BOT_TOKEN',value:'abc = 123'}, {key:'MODE',value:'production'},
  ]);
});

test('rejects reserved, malformed, duplicate and multiline values', () => {
  assert.throws(()=>validateEnv('PATH','x'));
  assert.throws(()=>validateEnv('bad-key','x'));
  assert.throws(()=>validateEnv('TOKEN','x\nleak'));
  assert.throws(()=>parseEnv('TOKEN=a\nTOKEN=b'));
});
