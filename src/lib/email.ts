import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.example.com',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const emailService = {
  sendPasswordReset: async (email: string, token: string): Promise<void> => {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000';
    const resetLink = `${baseUrl}/reset-password?token=${token}`;

    const mailOptions = {
      from: process.env.EMAIL_FROM || '"IntelliDoc AI" <noreply@intellidoc.ai>',
      to: email,
      subject: 'Password Reset Request - IntelliDoc AI',
      text: `You requested a password reset. Click the following link to reset your password: ${resetLink}\n\nIf you did not request this, please ignore this email.`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reset your IntelliDoc AI password</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #fafafa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
          <table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#fafafa">
            <tr>
              <td align="center" style="padding: 40px 0;">
                <table width="100%" max-width="600" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border: 1px solid #eaeaea; border-radius: 8px; margin: 0 auto; text-align: left;">
                  <tr>
                    <td style="padding: 40px;">
                       
                      
                      <h1 style="color: #111827; font-size: 24px; font-weight: 600; margin: 0 0 16px 0; padding: 0;">Reset your password</h1>
                      
                      <p style="color: #4b5563; font-size: 16px; line-height: 24px; margin: 0 0 24px 0;">
                        We received a request to reset the password for your IntelliDoc AI account. Click the button below to securely set up a new password.
                      </p>
                      
                      <table border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                        <tr>
                          <td align="center" bgcolor="#000000" style="border-radius: 6px;">
                            <a href="${resetLink}" target="_blank" style="font-size: 14px; font-weight: 500; color: #ffffff; text-decoration: none; padding: 12px 24px; display: inline-block; border-radius: 6px;">Reset Password</a>
                          </td>
                        </tr>
                      </table>
                      
                      <p style="color: #6b7280; font-size: 14px; line-height: 20px; margin: 0 0 24px 0;">
                        If you didn't request this, you can safely ignore this email. Your password will remain unchanged. This link will expire in 1 hour.
                      </p>
                      
                      <hr style="border: none; border-top: 1px solid #eaeaea; margin: 32px 0 24px 0;" />
                      
                      <p style="color: #9ca3af; font-size: 12px; line-height: 16px; margin: 0;">
                        If you're having trouble clicking the password reset button, copy and paste the URL below into your web browser:<br/><br/>
                        <a href="${resetLink}" style="color: #2563eb; text-decoration: none; word-break: break-all;">${resetLink}</a>
                      </p>
                    </td>
                  </tr>
                </table>
                <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 24px;">
                  © ${new Date().getFullYear()} IntelliDoc AI. All rights reserved.
                </p>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    };

    try {
      if (process.env.NODE_ENV !== 'test') {
        await transporter.sendMail(mailOptions);
        console.log(`Password reset email sent successfully to ${email}`);
      }
    } catch (error) {
      console.error('Error sending password reset email:', error);
      throw new Error('Failed to send password reset email');
    }
  }
};
