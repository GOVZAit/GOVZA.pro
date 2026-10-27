import assert from 'node:assert/strict';
import { zodResolver } from '@hookform/resolvers/zod';
import { fromZodError } from 'zod-validation-error';
import { loginSchema, registerSchema, masterSettingsSchema } from '../shared/schema';

const options = { fields: {}, shouldUseNativeValidation: false };
const resolveLogin = zodResolver(loginSchema);
const invalid = await resolveLogin({ identifier: '', password: '' }, {}, options);
assert.ok(invalid.errors.identifier?.message);
assert.ok(invalid.errors.password?.message);
const credentials = { identifier: 'validation@example.com', password: 'test-password' };
const valid = await resolveLogin(credentials, {}, options);
assert.deepEqual(valid.errors, {});
assert.deepEqual(valid.values, credentials);

const registration = { name: 'Test User', identifier: 'validation@example.com', password: 'test-password', role: 'client' as const };
assert.equal(registerSchema.safeParse(registration).success, true);
assert.equal(registerSchema.safeParse({ ...registration, role: 'admin' }).success, false);
const bounded = masterSettingsSchema.safeParse({ services: Array.from({ length: 31 }, () => ({ name: 'Service', price: '100' })) });
assert.equal(bounded.success, false);
if (!bounded.success) assert.ok(fromZodError(bounded.error).message.length > 0);
console.log('Validation dependency regression checks passed.');
