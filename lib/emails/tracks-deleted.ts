export function tracksDeletedEmail({ partyTitle }: { partyTitle: string }) {
  return {
    subject: "Your listening party files have been removed",
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; max-width: 480px; width: 100%;">
          <!-- Header -->
          <tr>
            <td style="background-color: #18181b; padding: 32px 32px 24px;">
              <p style="margin: 0; font-size: 18px; font-weight: 700; color: #ffffff; letter-spacing: -0.025em;">sideroom</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              <h1 style="margin: 0 0 16px; font-size: 20px; font-weight: 600; color: #18181b;">
                Your files have been removed
              </h1>
              <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #52525b;">
                The audio files for <strong style="color: #18181b;">${partyTitle}</strong> have been automatically removed, 48 hours after your listening party ended.
              </p>
              <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #52525b;">
                Cover artwork has been preserved so your past party remains visible on your dashboard.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 0 32px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-top: 1px solid #e4e4e7; padding-top: 20px;">
                    <p style="margin: 0; font-size: 13px; color: #a1a1aa;">
                      sideroom &mdash; Private listening sessions for unreleased music.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim(),
  };
}
