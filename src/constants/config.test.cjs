require('@babel/register')({ presets: ['babel-preset-expo'] });

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  EMAIL_PATTERN,
  MIN_PASSWORD_LENGTH,
  isValidEmail,
  getFirebaseErrorMessage,
} = require('./config');

test('email must follow the name@domain.tld format', () => {
  assert.equal(isValidEmail('student@example.com'), true);
  assert.equal(isValidEmail('  student@example.com  '), true);
  assert.equal(isValidEmail('a.b-c_d@sub.domain.edu.vn'), true);

  ['', '   ', 'student', 'student@', 'student@example', '@example.com',
    'stu dent@example.com', 'student@@example.com'].forEach((value) => {
    assert.equal(isValidEmail(value), false, `phải chặn: ${JSON.stringify(value)}`);
  });
});

test('email pattern is exported for the auth forms', () => {
  assert.ok(EMAIL_PATTERN instanceof RegExp);
});

test('password must have at least 6 characters', () => {
  assert.equal(MIN_PASSWORD_LENGTH, 6);
  assert.ok('demo5'.length < MIN_PASSWORD_LENGTH);
  assert.ok('demo06'.length >= MIN_PASSWORD_LENGTH);
});

test('Firebase auth errors are mapped to Vietnamese messages', () => {
  assert.equal(
    getFirebaseErrorMessage({ code: 'auth/invalid-credential' }),
    'Email hoặc mật khẩu không chính xác.'
  );
  assert.equal(
    getFirebaseErrorMessage({ code: 'auth/wrong-password' }),
    'Mật khẩu không chính xác.'
  );
  assert.equal(getFirebaseErrorMessage({ code: 'auth/invalid-email' }), 'Email không đúng định dạng.');
  assert.match(
    getFirebaseErrorMessage({ code: 'auth/weak-password' }),
    /ít nhất 6 ký tự/
  );
  assert.match(
    getFirebaseErrorMessage({ code: 'auth/email-already-in-use' }),
    /Email này đã tồn tại/
  );
});
