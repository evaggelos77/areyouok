const webpush = require('web-push');

const keys = webpush.generateVAPIDKeys();
console.log('VAPID_PUBLIC_KEY=' + keys.publicKey);
console.log('VAPID_PRIVATE_KEY=' + keys.privateKey);
console.log('VAPID_SUBJECT=mailto:you@example.com');
console.log('\n👉 Βάλ’ τα στο .env και κάνε restart τον server.');
