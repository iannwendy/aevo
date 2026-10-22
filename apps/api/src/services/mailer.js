const nodemailer = require('nodemailer');
const { escapeHtml, stripCrLf } = require('../utils/security');

/**
 * Transactional email.
 *
 * SMTP credentials are optional: without them the mailer runs in "log" mode
 * and writes the message to the API log instead of sending it. That keeps a
 * fresh clone working end to end (the reset link is visible in the log) while
 * still sending real mail in a configured deployment.
 */
let transporter = null;
let usingSmtp = false;

function getTransporter() {
  if (transporter) return transporter;

  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    usingSmtp = true;
  } else {
    transporter = { sendMail: async (mail) => ({ messageId: 'dev-mode', ...mail }) };
    usingSmtp = false;
  }

  return transporter;
}

async function sendMail({ to, subject, html, text }) {
  const from = stripCrLf(process.env.SMTP_FROM || 'AEVO <no-reply@aevo.com>');
  const safeTo = stripCrLf(to);
  const safeSubject = stripCrLf(subject);
  const mail = { from, to: safeTo, subject: safeSubject, html, text };

  if (!usingSmtp) {
    console.log(`[mailer] SMTP not configured - email not sent.\n[mailer] to: ${safeTo}\n[mailer] subject: ${safeSubject}\n[mailer] ${text}`);
    return { sent: false, preview: text, htmlPreview: html };
  }

  try {
    const info = await getTransporter().sendMail(mail);
    return { sent: true, messageId: info.messageId };
  } catch (error) {
    console.error('[mailer] send failed:', error.message);
    return { sent: false, error: error.message };
  }
}

/**
 * Password reset link.
 *
 * The requirement asks for a confirmation email after checkout and a reset
 * link for password recovery. The reset link is also written to the log when
 * SMTP is not configured, so local development can still complete the flow.
 */
async function sendPasswordResetEmail(to, fullName, link) {
  const subject = 'Reset your AEVO password';
  const safeName = escapeHtml(fullName || 'Customer');
  const safeLink = escapeHtml(link || '');
  const text = `Hi ${stripCrLf(fullName || 'Customer')},\n\nUse the link below to reset your AEVO password. It expires in 1 hour.\n\n${link}\n\nIf you did not request this, you can ignore this email.`;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto">
      <h1 style="font-size:20px">Reset your AEVO password</h1>
      <p>Hi ${safeName},</p>
      <p>Use the button below to choose a new password. The link expires in 1 hour.</p>
      <p><a href="${safeLink}" style="display:inline-block;background:#171717;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Reset password</a></p>
      <p style="color:#737373;font-size:13px">If the button does not work, copy this link:<br>${safeLink}</p>
      <p style="color:#737373;font-size:13px">If you did not request a password reset, you can ignore this email.</p>
    </div>`;

  const result = await sendMail({ to, subject, html, text });
  if (!result.sent) {
    console.log(`[mailer] password reset link for ${stripCrLf(to)}: ${link}`);
  }
  return result;
}

/** Welcome email with auto-generated password & setup link for new accounts. */
async function sendWelcomeAccountEmail({ to, fullName, temporaryPassword, resetUrl }) {
  const subject = 'Welcome to AEVO — Your Account & Password Details';
  const safeName = escapeHtml(fullName || 'Customer');
  const safeEmail = escapeHtml(to || '');
  const safePassword = escapeHtml(temporaryPassword || '');
  const safeLink = escapeHtml(resetUrl || '');

  const text = [
    `Hi ${stripCrLf(fullName || 'Customer')},`,
    '',
    'Your AEVO account has been created.',
    temporaryPassword ? `Email: ${stripCrLf(to)}\nTemporary Password: ${stripCrLf(temporaryPassword)}` : '',
    resetUrl ? `\nSet or change your password anytime using this link:\n${resetUrl}` : '',
    '',
    'You can sign in with your email and temporary password to view your order history and loyalty points.',
  ]
    .filter(Boolean)
    .join('\n');

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto">
      <h1 style="font-size:20px">Welcome to AEVO</h1>
      <p>Hi ${safeName},</p>
      <p>Your AEVO account is ready. Use the temporary password below to sign in, or set your own password using the link provided.</p>
      ${
        temporaryPassword
          ? `<div style="padding:12px 16px;background:#F7F6F2;border:1px solid #E5E5E3;border-radius:8px;font-family:monospace;font-size:14px;margin:16px 0">
              <div><strong>Email:</strong> ${safeEmail}</div>
              <div><strong>Temporary Password:</strong> ${safePassword}</div>
            </div>`
          : ''
      }
      ${
        resetUrl
          ? `<p><a href="${safeLink}" style="display:inline-block;background:#171717;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Set new password</a></p>`
          : ''
      }
    </div>`;

  return sendMail({ to, subject, html, text });
}

/** Order confirmation email (requirement: "confirmation email with the details of the order"). */
async function sendOrderConfirmationEmail(to, fullName, order, autoAccountCredentials = null) {
  const safeOrderNum = escapeHtml(order.orderNumber);
  const safeName = escapeHtml(fullName || 'Customer');
  const safePayment = escapeHtml(order.paymentMethod || 'cod');
  const subject = `AEVO order ${stripCrLf(order.orderNumber)} confirmed`;
  const rows = (order.items || [])
    .map(
      (i) =>
        `<tr><td style="padding:6px 0">${escapeHtml(i.productName)} x${Number(i.quantity) || 1}</td><td style="padding:6px 0;text-align:right">${Number(i.price).toLocaleString('vi-VN')} VND</td></tr>`
    )
    .join('');

  const accountText = autoAccountCredentials?.temporaryPassword
    ? `\n\nAccount Automatically Created for Order Tracking:\nEmail: ${stripCrLf(
        autoAccountCredentials.email || to
      )}\nTemporary Password: ${stripCrLf(autoAccountCredentials.temporaryPassword)}${
        autoAccountCredentials.resetUrl
          ? `\nSet Your Own Password: ${autoAccountCredentials.resetUrl}`
          : ''
      }`
    : '';

  const accountHtml = autoAccountCredentials?.temporaryPassword
    ? `<div style="padding:12px 16px;background:#F7F6F2;border:1px solid #E5E5E3;border-radius:8px;font-size:13px;margin:16px 0">
        <div style="font-weight:600;margin-bottom:6px">Account Automatically Created for Order Tracking</div>
        <div style="font-family:monospace">Email: ${escapeHtml(autoAccountCredentials.email || to)}</div>
        <div style="font-family:monospace">Temporary Password: ${escapeHtml(autoAccountCredentials.temporaryPassword)}</div>
        ${
          autoAccountCredentials.resetUrl
            ? `<div style="margin-top:8px"><a href="${escapeHtml(autoAccountCredentials.resetUrl)}" style="color:#171717;text-decoration:underline">Set a new password</a></div>`
            : ''
        }
      </div>`
    : '';

  const text = `Hi ${stripCrLf(fullName || 'Customer')},\n\nThanks for your order ${stripCrLf(order.orderNumber)}.\n\n${(order.items || [])
    .map((i) => `- ${stripCrLf(i.productName)} x${Number(i.quantity) || 1}: ${Number(i.price).toLocaleString('vi-VN')} VND`)
    .join('\n')}\n\nTotal: ${Number(order.totalAmount).toLocaleString('vi-VN')} VND\nPayment: ${stripCrLf(order.paymentMethod)}${accountText}\n\nWe will email you when the order ships.`;

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto">
      <h1 style="font-size:20px">Order ${safeOrderNum} confirmed</h1>
      <p>Hi ${safeName},</p>
      <p>Thanks for shopping with AEVO. Here is your order summary.</p>
      <table style="width:100%;border-collapse:collapse;border-top:1px solid #E5E5E3">${rows}</table>
      <p style="font-size:18px;font-weight:600">Total: ${Number(order.totalAmount).toLocaleString('vi-VN')} VND</p>
      <p style="color:#737373;font-size:13px">Payment method: ${safePayment}. We will email you when the order ships.</p>
      ${accountHtml}
    </div>`;

  return sendMail({ to, subject, html, text });
}

module.exports = {
  sendMail,
  sendPasswordResetEmail,
  sendWelcomeAccountEmail,
  sendOrderConfirmationEmail,
};
