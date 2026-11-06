
"use strict";

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

function getSender() {
  const value = process.env.EMAIL_FROM || "";
  const match = value.match(/^(.*?)\s*<([^<>]+)>$/);

  const sender = match
    ? { name: match[1].trim() || "GCMS", email: match[2].trim() }
    : { name: "GCMS", email: value.trim() };

  if (
    !sender.email ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sender.email)
  ) {
    throw new Error("EMAIL_FROM must be a valid sender email.");
  }

  return sender;
}

async function sendEmail({ email, subject, text, html }) {
  const apiKey = process.env.BREVO_API_KEY;

  if (!apiKey) {
    throw new Error("BREVO_API_KEY is not configured.");
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("A valid recipient email is required.");
  }

  const response = await fetch(BREVO_API_URL, {
    method: "POST",
    headers: {
      "accept": "application/json",
      "api-key": apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender: getSender(),
      to: [{ email }],
      subject,
      textContent: text,
      htmlContent: html,
    }),
    signal: AbortSignal.timeout(15000),
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error("GCMS Brevo API error:", {
      status: response.status,
      code: result.code,
      message: result.message,
    });

    throw new Error(
      `Email provider rejected the request (HTTP ${response.status}).`
    );
  }

  console.log("GCMS email accepted by Brevo:", {
    messageId: result.messageId,
  });

  return result;
}

async function sendEmailVerificationCode(email, code) {
  await sendEmail({
    email,
    subject: "Verify your email for GCMS",
    text: [
      "Your GCMS email verification code is:",
      "",
      code,
      "",
      "This code expires in 10 minutes.",
    ].join("\n"),
    html: `
      <p>Your GCMS email verification code is:</p>
      <h2>${String(code).replace(/[&<>"']/g, "")}</h2>
      <p>This code expires in 10 minutes.</p>
    `,
  });
}


async function sendPasswordResetEmail(email, code) {
  const safeCode = String(code);

  await sendEmail({
    email,
    subject: "Your GCMS password reset code",
    text: [
      "We received a request to reset your GCMS password.",
      "",
      `Your six-digit verification code is: ${safeCode}`,
      "",
      "This code expires in 5 minutes and can only be used once.",
      "If you did not request this, you can ignore this email.",
    ].join("\n"),
    html: `
      <h2>GCMS Password Reset</h2>
      <p>We received a request to reset your GCMS password.</p>
      <p>Your six-digit verification code is:</p>
      <h1 style="letter-spacing: 6px;">${safeCode}</h1>
      <p>This code expires in 5 minutes and can only be used once.</p>
      <p>If you did not request this, you can ignore this email.</p>
    `,
  });
}

module.exports = {
  sendPasswordResetEmail,
  sendEmailVerificationCode,
};
