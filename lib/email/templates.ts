const BRAND_COLOR = "#10B981";

function layout(content: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:480px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:${BRAND_COLOR};padding:24px 32px;">
      <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">SplitEase</h1>
    </div>
    <div style="padding:32px;">
      ${content}
    </div>
    <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">
      <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">
        SplitEase &mdash; Split smart. Stay even.
      </p>
    </div>
  </div>
</body>
</html>`;
}

function button(url: string, text: string): string {
  return `<a href="${url}" style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">${text}</a>`;
}

export function welcomeEmail(name: string): string {
  return layout(`
    <h2 style="margin:0 0 16px;color:#111827;font-size:18px;">Welcome, ${name}!</h2>
    <p style="color:#4b5563;line-height:1.6;margin:0 0 16px;">
      Your account has been created. You can now create groups, add expenses, and split bills with friends and family.
    </p>
    <p style="color:#4b5563;line-height:1.6;margin:0 0 24px;">
      Get started by creating your first group.
    </p>
    ${button(`${process.env.NEXT_PUBLIC_APP_URL}/groups`, "Go to SplitEase")}
  `);
}

export function passwordResetEmail(name: string, resetUrl: string): string {
  return layout(`
    <h2 style="margin:0 0 16px;color:#111827;font-size:18px;">Reset your password</h2>
    <p style="color:#4b5563;line-height:1.6;margin:0 0 16px;">
      Hi ${name}, we received a request to reset your password. Click the button below to set a new one.
    </p>
    <p style="margin:0 0 24px;">
      ${button(resetUrl, "Reset Password")}
    </p>
    <p style="color:#9ca3af;font-size:13px;line-height:1.5;margin:0;">
      This link expires in 1 hour. If you didn&rsquo;t request this, you can safely ignore this email.
    </p>
  `);
}

export function addedToGroupEmail(
  name: string,
  groupName: string,
  inviterName: string
): string {
  return layout(`
    <h2 style="margin:0 0 16px;color:#111827;font-size:18px;">You&rsquo;ve been added to a group</h2>
    <p style="color:#4b5563;line-height:1.6;margin:0 0 16px;">
      Hi ${name}, <strong>${inviterName}</strong> added you to <strong>${groupName}</strong>.
    </p>
    <p style="margin:0 0 24px;">
      ${button(`${process.env.NEXT_PUBLIC_APP_URL}/groups`, "View Group")}
    </p>
  `);
}

export function expenseAddedEmail(
  name: string,
  description: string,
  amount: string,
  currency: string,
  groupName: string,
  payerName: string
): string {
  return layout(`
    <h2 style="margin:0 0 16px;color:#111827;font-size:18px;">New expense in ${groupName}</h2>
    <p style="color:#4b5563;line-height:1.6;margin:0 0 8px;">
      Hi ${name}, a new expense was added:
    </p>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:0 0 16px;">
      <p style="margin:0 0 4px;font-weight:600;color:#111827;">${description}</p>
      <p style="margin:0;color:#4b5563;">
        <strong>${amount} ${currency}</strong> paid by ${payerName}
      </p>
    </div>
    <p style="margin:0 0 24px;">
      ${button(`${process.env.NEXT_PUBLIC_APP_URL}/groups`, "View Details")}
    </p>
  `);
}

export function settlementRecordedEmail(
  name: string,
  amount: string,
  currency: string,
  groupName: string,
  fromName: string,
  toName: string
): string {
  return layout(`
    <h2 style="margin:0 0 16px;color:#111827;font-size:18px;">Settlement in ${groupName}</h2>
    <p style="color:#4b5563;line-height:1.6;margin:0 0 8px;">
      Hi ${name}, a settlement has been recorded:
    </p>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:0 0 16px;">
      <p style="margin:0;color:#4b5563;">
        <strong>${fromName}</strong> paid <strong>${amount} ${currency}</strong> to <strong>${toName}</strong>
      </p>
    </div>
    <p style="margin:0 0 24px;">
      ${button(`${process.env.NEXT_PUBLIC_APP_URL}/groups`, "View Details")}
    </p>
  `);
}
