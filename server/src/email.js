const nodemailer = require('nodemailer');
const { config } = require('./config');

let transport;

function isEmailConfigured() {
  return Boolean(config.smtpHost && config.smtpUser && config.smtpPass && config.smtpFrom);
}

function createTransport() {
  return nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure || config.smtpPort === 465,
    requireTLS: config.smtpRequireTls,
    auth: {
      user: config.smtpUser,
      pass: config.smtpPass
    }
  });
}

function getTransport() {
  if (!transport) {
    transport = createTransport();
  }
  return transport;
}

async function sendOtpEmail({ to, code, locale }) {
  const subject = locale === 'el' ? 'Ο κωδικός σου για AreYouOK' : 'Your AreYouOK login code';
  const text =
    locale === 'el'
      ? `Ο κωδικός σύνδεσής σου είναι: ${code}\n\nΙσχύει για 10 λεπτά.`
      : `Your login code is: ${code}\n\nIt expires in 10 minutes.`;

  if (!isEmailConfigured()) {
    return { delivered: false, error: 'SMTP_NOT_CONFIGURED', preview: { subject, text } };
  }

  try {
    const message = {
      from: config.smtpFrom,
      to,
      subject,
      text
    };
    if (config.smtpReplyTo) message.replyTo = config.smtpReplyTo;

    await getTransport().sendMail(message);
    return { delivered: true };
  } catch (err) {
    return { delivered: false, error: 'OTP_EMAIL_UNAVAILABLE', details: String(err) };
  }
}

module.exports = { sendOtpEmail, isEmailConfigured };
