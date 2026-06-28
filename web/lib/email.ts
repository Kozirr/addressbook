import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL;

let resend: Resend | null = null;
if (RESEND_API_KEY) {
  resend = new Resend(RESEND_API_KEY);
}

export async function sendConfirmationEmail(email: string, code: string): Promise<void> {
  if (!resend || !FROM_EMAIL) {
    console.log("[Email] Confirmation email would be sent:");
    console.log(`  To: ${email}`);
    console.log(`  From: ${FROM_EMAIL ?? "not configured"}`);
    console.log(`  Code: ${code}`);
    return;
  }

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: "Confirm your email address",
    html: `
      <p>Welcome to Address Book.</p>
      <p>Use this code to confirm your email address:</p>
      <p style="font-size: 24px; font-weight: 700; letter-spacing: 0.3em;">${code}</p>
      <p>This code will expire in 15 minutes.</p>
    `,
  });

  if (error) {
    throw new Error(`Failed to send email: ${error.message}`);
  }
}

export async function sendPasswordResetEmail(email: string, code: string): Promise<void> {
  if (!resend || !FROM_EMAIL) {
    console.log("[Email] Password reset email would be sent:");
    console.log(`  To: ${email}`);
    console.log(`  From: ${FROM_EMAIL ?? "not configured"}`);
    console.log(`  Code: ${code}`);
    return;
  }

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: "Reset your password",
    html: `
      <p>Use this code to reset your Address Book password:</p>
      <p style="font-size: 24px; font-weight: 700; letter-spacing: 0.3em;">${code}</p>
      <p>This code will expire in 15 minutes.</p>
    `,
  });

  if (error) {
    throw new Error(`Failed to send email: ${error.message}`);
  }
}
