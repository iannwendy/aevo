const nodemailer = require('nodemailer');
const crypto = require('crypto');
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
 * Anti-spam & deliverability hardening:
 *   - SPF/DKIM/DMARC alignment: aligns From address and Message-ID domain with authenticated SMTP_USER
 *   - Explicit FQDN EHLO hostname (`name`) so Docker container IDs / .local hostnames never leak into Received headers
 *   - Personalized To header (`"Full Name" <email>`) and monitored Reply-To header
 *   - Transactional headers (`X-Entity-Ref-ID`, `X-Auto-Response-Suppress`, `Content-Language`) without bulk/promo flags
 *   - Clean preheader without 1px font, same-color-as-background text, or zero-width joiner obfuscation (`&#847;&zwnj;`)
 *   - Public HTTPS URL normalization (rewrites loopback `http://localhost:3000` links in emails to `https://aevo.io.vn`)
 *   - Descriptive anchor text (no naked domain or raw JWT URL anchor text that triggers anti-phishing filters)
 *   - Hard-bounce guard for test/demo/seed domains (`@aevo.com`, `@example.com`, `.local`, etc.) to protect sender reputation
 */
let transporter = null;
let transporterKey = '';
let usingSmtp = false;

function getPublicSiteUrl() {
  const explicit = String(
    process.env.EMAIL_PUBLIC_URL || process.env.PUBLIC_SITE_URL || ''
  ).trim();
  if (explicit) {
    return explicit.replace(/\/+$/, '');
  }

  const raw = String(process.env.CLIENT_URL || 'https://aevo.io.vn')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const prodUrl =
    raw.find((u) => u.includes('aevo.io.vn')) ||
    raw.find((u) => /^https:\/\//i.test(u) && !/localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(u));
  return (prodUrl || 'https://aevo.io.vn').replace(/\/+$/, '');
}

/**
 * Rewrites loopback origins (`http://localhost:3000`) in action links to the public
 * HTTPS storefront URL so outgoing SMTP emails never trigger `WEIRD_PORT`,
 * `LOCALHOST_URI`, or `HTTPS_HTTP_MISMATCH` anti-phishing rules.
 */
function normalizePublicEmailUrl(rawUrl, siteUrl = getPublicSiteUrl()) {
  const cleaned = stripCrLf(String(rawUrl || '').trim());
  if (!cleaned) return '';
  return cleaned.replace(
    /^https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::\d+)?(?=\/|\?|$)/i,
    siteUrl
  );
}

/**
 * Parse and align sender identity so From address, Reply-To, Message-ID, and
 * SMTP EHLO domain are consistent with the authenticated SMTP account.
 */
function resolveSenderConfig() {
  const smtpHost = stripCrLf(process.env.SMTP_HOST || '').trim().toLowerCase();
  const smtpUser = stripCrLf(process.env.SMTP_USER || '').trim();
  const rawFrom = stripCrLf(process.env.SMTP_FROM || '').trim();

  let fromName = 'AEVO Store';
  let fromAddress = smtpUser || 'support@aevo.io.vn';

  if (rawFrom) {
    const angleMatch = rawFrom.match(/^(.*?)<([^<>]+)>\s*$/);
    if (angleMatch) {
      const parsedName = angleMatch[1].replace(/^["']+|["']+$/g, '').trim();
      const parsedAddr = angleMatch[2].trim();
      if (parsedName) {
        fromName = parsedName === 'AEVO' ? 'AEVO Store' : parsedName;
      }
      if (parsedAddr) {
        fromAddress = parsedAddr;
      }
    } else if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawFrom)) {
      fromAddress = rawFrom;
    }
  }

  // Ensure DMARC/SPF alignment when relaying through Gmail or freemail SMTP
  const isGmailRelay =
    smtpHost.includes('gmail.com') || /@gmail\.com$/i.test(smtpUser);
  if (isGmailRelay && smtpUser && fromAddress.toLowerCase() !== smtpUser.toLowerCase()) {
    fromAddress = smtpUser;
  }

  const domainPart = (fromAddress.split('@')[1] || 'aevo.io.vn')
    .trim()
    .toLowerCase();
  const senderDomain = /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domainPart)
    ? domainPart
    : 'aevo.io.vn';
  const ehloDomain =
    stripCrLf(process.env.SMTP_EHLO_DOMAIN || '').trim() ||
    (senderDomain !== 'gmail.com' ? senderDomain : 'aevo.io.vn');
  const replyTo = stripCrLf(
    process.env.SMTP_REPLY_TO || smtpUser || fromAddress
  ).trim();

  return {
    fromName,
    fromAddress,
    senderDomain,
    ehloDomain,
    replyTo,
  };
}

function getTransporter() {
  const cleanPass = String(process.env.SMTP_PASS || '').replace(/\s+/g, '');
  const { ehloDomain } = resolveSenderConfig();
  const currentKey = [
    process.env.SMTP_HOST || '',
    process.env.SMTP_PORT || '',
    process.env.SMTP_SECURE || '',
    process.env.SMTP_USER || '',
    cleanPass ? 'set' : '',
    ehloDomain,
  ].join('|');

  if (transporter && transporterKey === currentKey) {
    return transporter;
  }

  transporterKey = currentKey;

  if (process.env.SMTP_HOST && process.env.SMTP_USER && cleanPass) {
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;

    const transportOptions = {
      host: process.env.SMTP_HOST,
      port,
      secure,
      name: ehloDomain,
      auth: {
        user: process.env.SMTP_USER,
        pass: cleanPass,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
      tls: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false',
      },
    };

    if (
      process.env.SMTP_DKIM_DOMAIN &&
      process.env.SMTP_DKIM_SELECTOR &&
      process.env.SMTP_DKIM_PRIVATE_KEY
    ) {
      transportOptions.dkim = {
        domainName: process.env.SMTP_DKIM_DOMAIN.trim(),
        keySelector: process.env.SMTP_DKIM_SELECTOR.trim(),
        privateKey: process.env.SMTP_DKIM_PRIVATE_KEY.replace(/\\n/g, '\n'),
      };
    }

    transporter = nodemailer.createTransport(transportOptions);
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
  badgeText = 'Member Care',
  eyebrow = 'Account',
  heading = '',
  bodyHtml = '',
  footerHtml = '',
  recipientEmail = '',
  siteUrl = getPublicSiteUrl(),
}) {
  const safePreheader = escapeHtml(preheader);
  const safeBadge = escapeHtml(badgeText);
  const safeEyebrow = escapeHtml(eyebrow);
  const safeHeading = escapeHtml(heading);
  const safeSiteUrl = escapeHtml(siteUrl);
  const safeRecipient = escapeHtml(recipientEmail);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${safeHeading} — AEVO</title>
</head>
<body style="margin:0;padding:0;background-color:#F5F5F3;color:#171717;font-family:-apple-system,BlinkMacSystemFont,'Geist','Inter','Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <!-- Inbox preview text (clean display:none without tiny-font or low-contrast spam triggers) -->
  <div style="display:none;max-height:0;max-width:0;overflow:hidden;mso-hide:all;">
    ${safePreheader}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F5F5F3;width:100%;margin:0;padding:48px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card Surface -->
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

        <!-- Minimal Brand Sub-footer (descriptive anchor text avoids domain-mismatch anti-phishing flags) -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:460px;width:100%;margin-top:20px;">
          <tr>
            <td align="center" style="font-size:12px;line-height:1.6;color:#737373;padding:0 16px;">
              <div style="font-weight:500;color:#171717;letter-spacing:-0.01em;">AEVO — Premium Computing</div>
              <div style="margin-top:2px;">
                <a href="${safeSiteUrl}" target="_blank" rel="noopener noreferrer" style="color:#737373;text-decoration:underline;text-underline-offset:3px;">AEVO Online Store</a>
                &nbsp;&bull;&nbsp; Ho Chi Minh City, Vietnam
              </div>
              ${
                safeRecipient
                  ? `<div style="margin-top:6px;font-size:11px;color:#8A8A86;">
                      This transactional message was sent to ${safeRecipient} regarding your AEVO account or order.
                    </div>`
                  : ''
              }
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function sanitizeRecipientEmail(rawTo) {
  const firstToken = String(rawTo || '')
    .trim()
    .split(/[\r\n,;\s]+/)[0];
  return stripCrLf(firstToken);
}

function sanitizeDisplayName(rawName) {
  const cleaned = stripCrLf(String(rawName || ''))
    .replace(/[<>"]/g, '')
    .trim()
    .slice(0, 80);
  return cleaned;
}

async function sendMail({ to, recipientName = '', subject, html, text }) {
  const { fromName, fromAddress, senderDomain, replyTo } = resolveSenderConfig();
  const safeTo = sanitizeRecipientEmail(to);
  const safeRecipientName = sanitizeDisplayName(recipientName);
  const safeSubject = stripCrLf(subject);
  const entityRefId = crypto.randomUUID();
  const messageId = `<${entityRefId}@${senderDomain}>`;

  const mail = {
    from: {
      name: fromName,
      address: fromAddress,
    },
    to: safeRecipientName
      ? {
          name: safeRecipientName,
          address: safeTo,
        }
      : safeTo,
    replyTo,
    subject: safeSubject,
    html,
    text,
    messageId,
    date: new Date(),
    priority: 'normal',
    headers: {
      'X-Entity-Ref-ID': entityRefId,
      'X-Auto-Response-Suppress': 'OOF, AutoReply',
      'Content-Language': 'en, vi',
    },
  };

  const activeTransporter = getTransporter();
  // Guard against RFC 2606 / RFC 6761 reserved domains AND project seed/E2E test domains (@aevo.com)
  // so automated test runs never generate hard bounces that damage SMTP sender reputation.
  const isReservedTestAddress =
    !safeTo ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeTo) ||
    /@(example\.com|example\.org|example\.net|test\.com|test\.local|aevo\.local|aevo\.com|evil\.com|localhost|invalid)$/i.test(
      safeTo
    ) ||
    /\.(test|local|example|invalid|localhost)$/i.test(safeTo);

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
  const safeRecipient = sanitizeRecipientEmail(to);
  const safeEmail = escapeHtml(safeRecipient);
  const siteUrl = getPublicSiteUrl();
  const normalizedLink = normalizePublicEmailUrl(link, siteUrl);
  const safeLink = escapeHtml(normalizedLink);
  const safeLoginUrl = escapeHtml(`${siteUrl}/login`);

  const text = [
    `Hi ${stripCrLf(fullName || 'Customer')},`,
    '',
    `We received a request to update the password for your AEVO account (${safeRecipient}).`,
    'You can choose a new password using the link below (active for 60 minutes):',
    '',
    normalizedLink,
    '',
    'If you did not request this change, no updates have been made to your account and you can safely ignore this message.',
    '',
    `Sign in to your account: ${siteUrl}/login`,
    '',
    '---',
    'AEVO — Premium Computing | Ho Chi Minh City, Vietnam',
    `This transactional message was sent to ${safeRecipient}.`,
  ].join('\n');

  const bodyHtml = `
    <p style="font-size:15px;line-height:1.6;color:#737373;margin:0 0 12px 0;">
      Hi <strong style="color:#171717;font-weight:500;">${safeName}</strong>,
    </p>
    <p style="font-size:15px;line-height:1.6;color:#737373;margin:0 0 24px 0;">
      We received a request to update the password for your AEVO account (<span style="color:#171717;font-weight:500;">${safeEmail}</span>). Select the button below to choose a new password. This link remains active for <strong style="color:#171717;font-weight:500;">60 minutes</strong>.
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

    <!-- Muted Surface Panel for Direct Link Copy (non-anchor text avoids raw-URL anchor phishing heuristics) -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F5F5F3;border:1px solid #E5E5E3;border-radius:12px;margin-top:20px;">
      <tr>
        <td style="padding:14px 16px;">
          <div style="font-family:'Geist Mono',ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:11px;color:#737373;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">
            Copy link if button does not open
          </div>
          <div style="font-family:'Geist Mono',ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:12px;line-height:1.5;color:#52665C;word-break:break-all;">
            ${safeLink}
          </div>
        </td>
      </tr>
    </table>
  `;

  const footerHtml = `
    <p style="margin:0 0 12px 0;">
      Didn&rsquo;t request this email? No changes have been made to your account &mdash; you can safely ignore this message, or reply to this email if you need assistance from AEVO Customer Care.
    </p>
    <p style="margin:0;color:#737373;">
      Remembered it?
      <a href="${safeLoginUrl}" target="_blank" rel="noopener noreferrer" style="color:#171717;font-weight:500;text-decoration:underline;text-underline-offset:3px;">Back to sign in</a>
    </p>
  `;

  const html = renderAevoEmailLayout({
    preheader: 'Update your AEVO account password. This link is active for 60 minutes.',
    badgeText: 'Member Care',
    eyebrow: 'Account',
    heading: 'Reset your password',
    bodyHtml,
    footerHtml,
    recipientEmail: safeRecipient,
    siteUrl,
  });

  const result = await sendMail({
    to,
    recipientName: fullName,
    subject,
    html,
    text,
  });
  if (!result.sent) {
    console.log(`[mailer] password reset link for ${stripCrLf(to)}: ${link}`);
  }
  return result;
}

/** Welcome email with auto-generated password & setup link for new accounts. */
async function sendWelcomeAccountEmail({ to, fullName, temporaryPassword, resetUrl }) {
  const subject = 'Welcome to AEVO — Your account is ready';
  const safeName = escapeHtml(fullName || 'Customer');
  const safeRecipient = sanitizeRecipientEmail(to);
  const safeEmail = escapeHtml(safeRecipient);
  const safePassword = escapeHtml(temporaryPassword || '');
  const siteUrl = getPublicSiteUrl();
  const normalizedResetUrl = normalizePublicEmailUrl(resetUrl, siteUrl);
  const safeLink = escapeHtml(normalizedResetUrl);
  const safeLoginUrl = escapeHtml(`${siteUrl}/login`);

  const text = [
    `Hi ${stripCrLf(fullName || 'Customer')},`,
    '',
    'Thank you for registering with AEVO. Your member account has been created and is ready to use.',
    temporaryPassword ? `Email: ${safeRecipient}\nTemporary Password: ${stripCrLf(temporaryPassword)}` : '',
    normalizedResetUrl ? `\nSet your personal password anytime using this link:\n${normalizedResetUrl}` : '',
    '',
    'You can sign in to view your order history, manage shipping addresses, and track your AEVO loyalty points.',
    '',
    '---',
    'AEVO — Premium Computing | Ho Chi Minh City, Vietnam',
    `This transactional message was sent to ${safeRecipient}.`,
  ]
    .filter(Boolean)
    .join('\n');

  const bodyHtml = `
    <p style="font-size:15px;line-height:1.6;color:#737373;margin:0 0 12px 0;">
      Hi <strong style="color:#171717;font-weight:500;">${safeName}</strong>,
    </p>
    <p style="font-size:15px;line-height:1.6;color:#737373;margin:0 0 20px 0;">
      Thank you for joining AEVO. Your account is ready so you can track orders, manage shipping addresses, and earn loyalty rewards. Below are your initial sign-in details:
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
      normalizedResetUrl
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
    preheader: 'Thank you for joining AEVO. Your member account is ready.',
    badgeText: 'Welcome',
    eyebrow: 'Account',
    heading: 'Welcome to AEVO',
    bodyHtml,
    footerHtml,
    recipientEmail: safeRecipient,
    siteUrl,
  });

  return sendMail({
    to,
    recipientName: fullName,
    subject,
    html,
    text,
  });
}

/** Order confirmation email (requirement: "confirmation email with the details of the order"). */
async function sendOrderConfirmationEmail(to, fullName, order, autoAccountCredentials = null) {
  const safeOrderNum = escapeHtml(order.orderNumber);
  const safeName = escapeHtml(fullName || 'Customer');
  const safeRecipient = sanitizeRecipientEmail(to);
  const safePayment = escapeHtml(String(order.paymentMethod || 'cod').toUpperCase());
  const siteUrl = getPublicSiteUrl();
  const subject = `AEVO order ${stripCrLf(order.orderNumber)} confirmed`;

  const normalizedCredResetUrl = autoAccountCredentials?.resetUrl
    ? normalizePublicEmailUrl(autoAccountCredentials.resetUrl, siteUrl)
    : '';

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
    ? `\n\nAccount Created for Order Tracking:\nEmail: ${stripCrLf(
        autoAccountCredentials.email || to
      )}\nTemporary Password: ${stripCrLf(autoAccountCredentials.temporaryPassword)}${
        normalizedCredResetUrl ? `\nSet Your Own Password: ${normalizedCredResetUrl}` : ''
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
              normalizedCredResetUrl
                ? `<div style="margin-top:10px;"><a href="${escapeHtml(normalizedCredResetUrl)}" style="color:#171717;font-weight:500;text-decoration:underline;">Set a new password &rarr;</a></div>`
                : ''
            }
          </td>
        </tr>
      </table>`
    : '';

  const text = `Hi ${stripCrLf(fullName || 'Customer')},\n\nThank you for your order ${stripCrLf(order.orderNumber)} with AEVO.\n\n${(order.items || [])
    .map((i) => `- ${stripCrLf(i.productName)} x${Number(i.quantity) || 1}: ${Number(i.price).toLocaleString('vi-VN')} VND`)
    .join('\n')}\n\nTotal: ${Number(order.totalAmount).toLocaleString('vi-VN')} VND\nPayment: ${stripCrLf(order.paymentMethod)}${accountText}\n\nWe will notify you by email as soon as your shipment dispatches.\n\n---\nAEVO — Premium Computing | Ho Chi Minh City, Vietnam\nThis transactional message was sent to ${safeRecipient}.`;

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
    eyebrow: 'Order Confirmation',
    heading: `Order ${safeOrderNum} confirmed`,
    bodyHtml,
    footerHtml,
    recipientEmail: safeRecipient,
    siteUrl,
  });

  return sendMail({
    to,
    recipientName: fullName,
    subject,
    html,
    text,
  });
}

module.exports = {
  sendMail,
  sendPasswordResetEmail,
  sendWelcomeAccountEmail,
  sendOrderConfirmationEmail,
  renderAevoEmailLayout,
  getPublicSiteUrl,
  normalizePublicEmailUrl,
  resolveSenderConfig,
};
