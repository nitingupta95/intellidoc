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
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2>Password Reset Request</h2>
          <p>You recently requested to reset your password for your IntelliDoc AI account. Click the button below to reset it:</p>
          <a href="${resetLink}" style="display: inline-block; padding: 12px 24px; color: #ffffff; background-color: #0f172a; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0;">Reset your password</a>
          <p style="color: #475569;">If you did not request a password reset, please ignore this email or reply to let us know. This password reset is only valid for the next 15 minutes.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
          <p style="font-size: 12px; color: #94a3b8; word-break: break-all;">If you're having trouble clicking the password reset button, copy and paste the URL below into your web browser:<br/>${resetLink}</p>
        </div>
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
