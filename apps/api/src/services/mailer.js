const nodemailer = require('nodemailer');
const { escapeHtml, stripCrLf } = require('../utils/security');

/**
 * Transactional email service — AEVO Design System HTML Templates.
 *
 * Visual language matches the storefront & auth cards on https://aevo.io.vn:
 *   - Warm Porcelain Canvas (#F5F5F3)
 *   - Pure Surface Card (#FFFFFF) with 1px Hairline Border (#E5E5E3) & 16px Radius
 *   - Obsidian Ink Typography (#171717), Muted Secondary Copy (#737373), Sage Accent (#52665C)
 *   - Monospace Eyebrow Badges ('Geist Mono', monospace) & Full-Width 48px Primary CTA Button
 *
 * SMTP credentials are optional: without them the mailer runs in "log" mode
 * and writes the message to the API log instead of sending it. That keeps a
 * fresh clone working end to end (the reset link is visible in the log) while
 * still sending real mail in a configured deployment.
 */
let transporter = null;
let transporterKey = '';
let usingSmtp = false;

function getPublicSiteUrl() {
  const raw = String(process.env.CLIENT_URL || 'https://aevo.io.vn')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const prodUrl = raw.find((u) => u.includes('aevo.io.vn'));
  return (prodUrl || raw[0] || 'https://aevo.io.vn').replace(/\/+$/, '');
}

function getTransporter() {
  const cleanPass = String(process.env.SMTP_PASS || '').replace(/\s+/g, '');
  const currentKey = [
    process.env.SMTP_HOST || '',
    process.env.SMTP_PORT || '',
    process.env.SMTP_SECURE || '',
    process.env.SMTP_USER || '',
    cleanPass ? 'set' : '',
  ].join('|');

  if (transporter && transporterKey === currentKey) {
    return transporter;
  }

  transporterKey = currentKey;

  if (process.env.SMTP_HOST && process.env.SMTP_USER && cleanPass) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: cleanPass,
      },
    });
    usingSmtp = true;
  } else {
    transporter = { sendMail: async (mail) => ({ messageId: 'dev-mode', ...mail }) };
    usingSmtp = false;
  }

  return transporter;
}

/**
 * Shared AEVO editorial card layout for all transactional emails.
 */
function renderAevoEmailLayout({
  preheader = '',
  badgeText = 'SECURITY',
  eyebrow = 'ACCOUNT',
  heading = '',
  bodyHtml = '',
  footerHtml = '',
  siteUrl = getPublicSiteUrl(),
}) {
  const safePreheader = escapeHtml(preheader);
  const safeBadge = escapeHtml(badgeText);
  const safeEyebrow = escapeHtml(eyebrow);
  const safeHeading = escapeHtml(heading);
  const safeSiteUrl = escapeHtml(siteUrl);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${safeHeading} — AEVO</title>
</head>
<body style="margin:0;padding:0;background-color:#F5F5F3;color:#171717;font-family:-apple-system,BlinkMacSystemFont,'Geist','Inter','Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <!-- Hidden inbox preheader text -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:#F5F5F3;">
    ${safePreheader}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F5F5F3;width:100%;margin:0;padding:48px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card Surface (matches max-w-md bg-surface border-border rounded-2xl p-8 md:p-10) -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:460px;width:100%;background-color:#FFFFFF;border:1px solid #E5E5E3;border-radius:16px;box-shadow:0 1px 3px rgba(23,23,23,0.04),0 8px 24px rgba(23,23,23,0.03);overflow:hidden;">
          <tr>
            <td style="padding:36px 36px 32px 36px;">
              <!-- Top Brand Row: aevo. wordmark + precision status pill -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="left" valign="middle">
                    <a href="${safeSiteUrl}" target="_blank" rel="noopener noreferrer" style="font-size:24px;font-weight:600;letter-spacing:-0.03em;color:#171717;text-decoration:none;display:inline-block;">
                      aevo.
                    </a>
                  </td>
                  <td align="right" valign="middle">
                    <span style="display:inline-block;border:1px solid #E5E5E3;background-color:#FAFAFA;border-radius:10px;padding:6px 10px;font-family:'Geist Mono',ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:11px;font-weight:500;color:#737373;letter-spacing:0.08em;text-transform:uppercase;">
                      ${safeBadge}
                    </span>
                  </td>
                </tr>
              </table>

              <!-- Eyebrow & Heading -->
              <div style="font-family:'Geist Mono',ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:12px;color:#737373;text-transform:uppercase;letter-spacing:0.08em;margin-top:32px;">
                ${safeEyebrow}
              </div>
              <h1 style="font-size:30px;line-height:1.2;font-weight:600;letter-spacing:-0.025em;color:#171717;margin:8px 0 12px 0;">
                ${safeHeading}
              </h1>

              <!-- Dynamic Body Content -->
              ${bodyHtml}

              <!-- Card Footer -->
              ${
                footerHtml
                  ? `<div style="margin-top:28px;padding-top:20px;border-top:1px solid #E5E5E3;font-size:13px;line-height:1.6;color:#737373;">
                      ${footerHtml}
                    </div>`
                  : ''
              }
            </td>
          </tr>
        </table>

        <!-- Minimal Brand Sub-footer -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:460px;width:100%;margin-top:20px;">
          <tr>
            <td align="center" style="font-size:12px;line-height:1.6;color:#737373;padding:0 16px;">
              <div style="font-weight:500;color:#171717;letter-spacing:-0.01em;">AEVO — Premium Computing</div>
              <div style="margin-top:2px;">
                <a href="${safeSiteUrl}" target="_blank" rel="noopener noreferrer" style="color:#737373;text-decoration:underline;text-underline-offset:3px;">aevo.io.vn</a>
                &nbsp;&bull;&nbsp; Ho Chi Minh City, Vietnam
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendMail({ to, subject, html, text }) {
  const defaultFrom = process.env.SMTP_USER
    ? `AEVO <${process.env.SMTP_USER}>`
    : 'AEVO <no-reply@aevo.io.vn>';
  const from = stripCrLf(process.env.SMTP_FROM || defaultFrom);
  const safeTo = stripCrLf(to);
  const safeSubject = stripCrLf(subject);
  const mail = {
    from,
    to: safeTo,
    subject: safeSubject,
    html,
    text,
  };

  const activeTransporter = getTransporter();
  const isReservedTestAddress = /@(example\.com|example\.org|example\.net|test\.local)$/i.test(safeTo);

  if (!usingSmtp || isReservedTestAddress) {
    console.log(
      `[mailer] ${isReservedTestAddress ? 'Test address skipped' : 'SMTP not configured'} - email logged.\n[mailer] to: ${safeTo}\n[mailer] subject: ${safeSubject}\n[mailer] ${text}`
    );
    return { sent: false, preview: text, htmlPreview: html };
  }

  try {
    const info = await activeTransporter.sendMail(mail);
    console.log(`[mailer] Email sent to ${safeTo} (messageId: ${info.messageId})`);
    return { sent: true, messageId: info.messageId, preview: text, htmlPreview: html };
  } catch (error) {
    console.error('[mailer] send failed:', error.message);
    return { sent: false, error: error.message, preview: text, htmlPreview: html };
  }
}

/**
 * Password reset link.
 *
 * Matches the exact UI of https://aevo.io.vn/forgot-password and /reset-password.
 */
async function sendPasswordResetEmail(to, fullName, link) {
  const subject = 'Reset your AEVO password';
  const safeName = escapeHtml(fullName || 'Customer');
  const safeEmail = escapeHtml(stripCrLf(to || ''));
  const safeLink = escapeHtml(link || '');
  const siteUrl = getPublicSiteUrl();
  const safeLoginUrl = escapeHtml(`${siteUrl}/login`);

  const text = [
    `Hi ${stripCrLf(fullName || 'Customer')},`,
    '',
    'We received a request to reset the password for your AEVO account.',
    'Use the link below to set a new password (valid for 1 hour):',
    '',
    link,
    '',
    'If you did not request a password reset, you can safely ignore this email.',
    '',
    `Remembered it? Sign in at ${siteUrl}/login`,
  ].join('\n');

  const bodyHtml = `
    <p style="font-size:15px;line-height:1.6;color:#737373;margin:0 0 12px 0;">
      Hi <strong style="color:#171717;font-weight:500;">${safeName}</strong>,
    </p>
    <p style="font-size:15px;line-height:1.6;color:#737373;margin:0 0 24px 0;">
      Enter the link below to choose a new password for your account (<span style="color:#171717;font-weight:500;">${safeEmail}</span>). For your security, this recovery link is single-use and expires in <strong style="color:#171717;font-weight:500;">1 hour</strong>.
    </p>

    <!-- Primary Full-Width CTA Button (matches .btn-primary h-12 rounded-lg on /forgot-password) -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
      <tr>
        <td align="center" style="border-radius:10px;background-color:#171717;">
          <a href="${safeLink}" target="_blank" rel="noopener noreferrer" style="display:block;width:100%;box-sizing:border-box;background-color:#171717;color:#FFFFFF;font-size:15px;font-weight:500;line-height:48px;height:48px;text-align:center;text-decoration:none;border-radius:10px;letter-spacing:-0.01em;">
            Reset password
          </a>
        </td>
      </tr>
    </table>

    <!-- Muted Surface Panel for Direct Link Copy -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F5F5F3;border:1px solid #E5E5E3;border-radius:12px;margin-top:20px;">
      <tr>
        <td style="padding:14px 16px;">
          <div style="font-family:'Geist Mono',ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:11px;color:#737373;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">
            Direct Recovery URL
          </div>
          <div style="font-family:'Geist Mono',ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:12px;line-height:1.5;color:#171717;word-break:break-all;">
            <a href="${safeLink}" target="_blank" rel="noopener noreferrer" style="color:#52665C;text-decoration:underline;">${safeLink}</a>
          </div>
        </td>
      </tr>
    </table>
  `;

  const footerHtml = `
    <p style="margin:0 0 12px 0;">
      Didn&rsquo;t request this email? No changes have been made to your account &mdash; you can safely ignore this message.
    </p>
    <p style="margin:0;color:#737373;">
      Remembered it?
      <a href="${safeLoginUrl}" target="_blank" rel="noopener noreferrer" style="color:#171717;font-weight:500;text-decoration:underline;text-underline-offset:3px;">Back to sign in</a>
    </p>
  `;

  const html = renderAevoEmailLayout({
    preheader: 'Use this link to reset your AEVO password. Valid for 1 hour.',
    badgeText: 'SECURITY',
    eyebrow: 'ACCOUNT',
    heading: 'Reset your password',
    bodyHtml,
    footerHtml,
    siteUrl,
  });

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
  const siteUrl = getPublicSiteUrl();
  const safeLoginUrl = escapeHtml(`${siteUrl}/login`);

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

  const bodyHtml = `
    <p style="font-size:15px;line-height:1.6;color:#737373;margin:0 0 12px 0;">
      Hi <strong style="color:#171717;font-weight:500;">${safeName}</strong>,
    </p>
    <p style="font-size:15px;line-height:1.6;color:#737373;margin:0 0 20px 0;">
      Your AEVO account is ready. Use your temporary credentials below to sign in, or set a personal password right away.
    </p>
    ${
      temporaryPassword
        ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F5F5F3;border:1px solid #E5E5E3;border-radius:12px;margin:20px 0;">
            <tr>
              <td style="padding:16px 18px;font-family:'Geist Mono',ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:13px;line-height:1.7;color:#171717;">
                <div><span style="color:#737373;">Email:</span> <strong>${safeEmail}</strong></div>
                <div><span style="color:#737373;">Temporary Password:</span> <strong>${safePassword}</strong></div>
              </td>
            </tr>
          </table>`
        : ''
    }
    ${
      resetUrl
        ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 8px 0;">
            <tr>
              <td align="center" style="border-radius:10px;background-color:#171717;">
                <a href="${safeLink}" target="_blank" rel="noopener noreferrer" style="display:block;width:100%;box-sizing:border-box;background-color:#171717;color:#FFFFFF;font-size:15px;font-weight:500;line-height:48px;height:48px;text-align:center;text-decoration:none;border-radius:10px;">
                  Set new password
                </a>
              </td>
            </tr>
          </table>`
        : ''
    }
  `;

  const footerHtml = `
    <p style="margin:0;">
      Ready to explore?
      <a href="${safeLoginUrl}" target="_blank" rel="noopener noreferrer" style="color:#171717;font-weight:500;text-decoration:underline;text-underline-offset:3px;">Sign in to your account</a>
    </p>
  `;

  const html = renderAevoEmailLayout({
    preheader: 'Your AEVO account has been created.',
    badgeText: 'WELCOME',
    eyebrow: 'ACCOUNT',
    heading: 'Welcome to AEVO',
    bodyHtml,
    footerHtml,
    siteUrl,
  });

  return sendMail({ to, subject, html, text });
}

/** Order confirmation email (requirement: "confirmation email with the details of the order"). */
async function sendOrderConfirmationEmail(to, fullName, order, autoAccountCredentials = null) {
  const safeOrderNum = escapeHtml(order.orderNumber);
  const safeName = escapeHtml(fullName || 'Customer');
  const safePayment = escapeHtml(String(order.paymentMethod || 'cod').toUpperCase());
  const siteUrl = getPublicSiteUrl();
  const subject = `AEVO order ${stripCrLf(order.orderNumber)} confirmed`;

  const rows = (order.items || [])
    .map(
      (i) =>
        `<tr>
          <td style="padding:10px 0;border-bottom:1px solid #E5E5E3;font-size:14px;color:#171717;">
            ${escapeHtml(i.productName)} <span style="color:#737373;font-family:'Geist Mono',ui-monospace,monospace;font-size:12px;">&times;${Number(i.quantity) || 1}</span>
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #E5E5E3;text-align:right;font-family:'Geist Mono',ui-monospace,monospace;font-size:13px;font-weight:500;color:#171717;white-space:nowrap;">
            ${Number(i.price).toLocaleString('vi-VN')} VND
          </td>
        </tr>`
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
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F5F5F3;border:1px solid #E5E5E3;border-radius:12px;margin-top:20px;">
        <tr>
          <td style="padding:16px 18px;font-size:13px;line-height:1.6;color:#171717;">
            <div style="font-weight:600;margin-bottom:6px;">Account Created for Order Tracking</div>
            <div style="font-family:'Geist Mono',ui-monospace,monospace;">Email: ${escapeHtml(autoAccountCredentials.email || to)}</div>
            <div style="font-family:'Geist Mono',ui-monospace,monospace;">Temporary Password: ${escapeHtml(autoAccountCredentials.temporaryPassword)}</div>
            ${
              autoAccountCredentials.resetUrl
                ? `<div style="margin-top:10px;"><a href="${escapeHtml(autoAccountCredentials.resetUrl)}" style="color:#171717;font-weight:500;text-decoration:underline;">Set a new password &rarr;</a></div>`
                : ''
            }
          </td>
        </tr>
      </table>`
    : '';

  const text = `Hi ${stripCrLf(fullName || 'Customer')},\n\nThanks for your order ${stripCrLf(order.orderNumber)}.\n\n${(order.items || [])
    .map((i) => `- ${stripCrLf(i.productName)} x${Number(i.quantity) || 1}: ${Number(i.price).toLocaleString('vi-VN')} VND`)
    .join('\n')}\n\nTotal: ${Number(order.totalAmount).toLocaleString('vi-VN')} VND\nPayment: ${stripCrLf(order.paymentMethod)}${accountText}\n\nWe will email you when the order ships.`;

  const bodyHtml = `
    <p style="font-size:15px;line-height:1.6;color:#737373;margin:0 0 12px 0;">
      Hi <strong style="color:#171717;font-weight:500;">${safeName}</strong>,
    </p>
    <p style="font-size:15px;line-height:1.6;color:#737373;margin:0 0 20px 0;">
      Thank you for your order with AEVO. Below is a summary of your hardware configuration and order total.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;border-top:1px solid #E5E5E3;">
      ${rows}
      <tr>
        <td style="padding:14px 0 4px 0;font-size:15px;font-weight:600;color:#171717;">Total</td>
        <td style="padding:14px 0 4px 0;text-align:right;font-family:'Geist Mono',ui-monospace,monospace;font-size:16px;font-weight:600;color:#171717;">
          ${Number(order.totalAmount).toLocaleString('vi-VN')} VND
        </td>
      </tr>
    </table>
    <p style="color:#737373;font-size:13px;margin:14px 0 0 0;">
      Payment method: <strong style="color:#171717;font-weight:500;">${safePayment}</strong>. We will notify you as soon as your shipment dispatches.
    </p>
    ${accountHtml}
  `;

  const footerHtml = `
    <p style="margin:0;">
      Track your order status anytime in
      <a href="${escapeHtml(`${siteUrl}/account/orders`)}" target="_blank" rel="noopener noreferrer" style="color:#171717;font-weight:500;text-decoration:underline;text-underline-offset:3px;">Your Orders</a>.
    </p>
  `;

  const html = renderAevoEmailLayout({
    preheader: `Your AEVO order ${stripCrLf(order.orderNumber)} is confirmed.`,
    badgeText: safeOrderNum,
    eyebrow: 'ORDER CONFIRMATION',
    heading: `Order ${safeOrderNum} confirmed`,
    bodyHtml,
    footerHtml,
    siteUrl,
  });

  return sendMail({ to, subject, html, text });
}

module.exports = {
  sendMail,
  sendPasswordResetEmail,
  sendWelcomeAccountEmail,
  sendOrderConfirmationEmail,
  renderAevoEmailLayout,
};

