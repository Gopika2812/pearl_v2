import nodemailer from "nodemailer";

/**
 * Initialize Gmail SMTP transporter
 */
const createTransporter = () => {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_EMAIL,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
};

/**
 * Send OTP to Super Admin for user approval
 */
export const sendOTPEmail = async (
  superAdminEmail,
  userName,
  otp,
  branch,
  role,
  userEmail
) => {
  try {
    console.log("📧 Attempting to send OTP email...");
    console.log(`   From: ${process.env.GMAIL_EMAIL}`);
    console.log(`   To: ${superAdminEmail}`);
    console.log(`   User: ${userName}, Branch: ${branch}, OTP: ${otp}`);
    
    const transporter = createTransporter();

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5; border-radius: 10px;">
        <h2 style="color: #1976d2; text-align: center;">📋 New User Registration - OTP Approval</h2>
        
        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0 0 20px 0; color: #333;">A new user has registered for your system. Please review:</p>
          
          <table style="width: 100%; border-collapse: collapse;">
            <tr style="background: #f9f9f9;">
              <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold; width: 150px;">Username</td>
              <td style="padding: 12px; border: 1px solid #ddd;">${userName}</td>
            </tr>
            <tr>
              <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold;">Email</td>
              <td style="padding: 12px; border: 1px solid #ddd;">${userEmail}</td>
            </tr>
            <tr style="background: #f9f9f9;">
              <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold;">Branch Code</td>
              <td style="padding: 12px; border: 1px solid #ddd;">${branch}</td>
            </tr>
            <tr>
              <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold;">Role</td>
              <td style="padding: 12px; border: 1px solid #ddd;">${role}</td>
            </tr>
          </table>
          
          <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <h3 style="margin: 0 0 10px 0; color: #d32f2f;">🔐 OTP Code for User Verification</h3>
            <p style="margin: 0; font-size: 24px; font-weight: bold; color: #d32f2f; letter-spacing: 2px;">${otp}</p>
            <p style="margin: 10px 0 0 0; font-size: 12px; color: #666;">⏱️ Valid for 5 minutes only</p>
          </div>
          
          <p style="margin: 20px 0 0 0; color: #666; font-size: 13px;">
            Share this OTP with the registering user to complete their registration. They will enter this code to activate their account.
          </p>
        </div>
        
        <div style="text-align: center; color: #999; font-size: 11px; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 15px;">
          <p>This is an automated message from Pearl ERP System. Please do not reply to this email.</p>
        </div>
      </div>
    `;

    const mailOptions = {
      from: `"Pearl ERP" <${process.env.GMAIL_EMAIL}>`,
      to: superAdminEmail,
      subject: `🔐 New User Registration OTP - ${userName}`,
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("✅ OTP email sent successfully:", info.messageId);
    return { success: true, message: "OTP sent to super admin" };
  } catch (error) {
    console.error("❌ Failed to send OTP email");
    console.error("   Error Code:", error.code);
    console.error("   Error Message:", error.message);
    console.error("   Full Error:", error);

    // Fallback: Log OTP to console for testing
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📧 EMAIL FALLBACK - OTP for debugging:");
    console.log(`   User: ${userName}`);
    console.log(`   Branch: ${branch}`);
    console.log(`   Role: ${role}`);
    console.log(`   🔐 OTP CODE: ${otp}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    throw error;
  }
};

/**
 * Send approval notification to user
 */
export const sendApprovalEmail = async (userEmail, userName) => {
  try {
    const transporter = createTransporter();

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5; border-radius: 10px;">
        <h2 style="color: #4caf50; text-align: center;">✅ Registration Approved!</h2>
        
        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0 0 20px 0; color: #333;">Hello ${userName},</p>
          
          <p style="color: #333; line-height: 1.6;">Your registration has been approved by the Super Admin! You can now log in to the Pearl ERP System using your credentials:</p>
          
          <div style="background: #f0f8ff; border-left: 4px solid #1976d2; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0 0 10px 0; color: #333;"><strong>Username:</strong> ${userName}</p>
            <p style="margin: 0; color: #333;"><strong>Password:</strong> (the one you created during registration)</p>
          </div>
          
          <p style="margin: 20px 0 0 0; color: #333;">
            <a href="https://pearls-erp.com/branch-login" style="background: #1976d2; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
              Go to Login
            </a>
          </p>
        </div>
        
        <div style="text-align: center; color: #999; font-size: 11px; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 15px;">
          <p>Welcome to Pearl ERP System!</p>
        </div>
      </div>
    `;

    const mailOptions = {
      from: `"Pearl ERP" <${process.env.GMAIL_EMAIL}>`,
      to: userEmail,
      subject: "✅ Your Registration Has Been Approved!",
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Approval email sent to user:", info.messageId);
    return { success: true, message: "Approval notification sent" };
  } catch (error) {
    console.error("❌ Failed to send approval email:", error.message);

    // Fallback: Log to console for testing
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📧 EMAIL FALLBACK - Approval Notification:");
    console.log(`   User: ${userName}`);
    console.log(`   Email: ${userEmail}`);
    console.log("   ✅ Registration has been approved!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    throw error;
  }
};
