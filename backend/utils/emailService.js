import emailjs from "@emailjs/nodejs";

// Initialize EmailJS
emailjs.init({
  publicKey: process.env.EMAILJS_PUBLIC_KEY,
  privateKey: process.env.EMAILJS_PRIVATE_KEY,
});

/**
 * Send OTP to Super Admin for user approval using EmailJS
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
    console.log("📧 Attempting to send OTP email via EmailJS...");
    console.log(`   To: ${superAdminEmail}`);
    console.log(`   User: ${userName}, Branch: ${branch}, OTP: ${otp}`);

    const templateParams = {
      to_email: superAdminEmail,
      reply_to: process.env.EMAILJS_REPLY_TO,
      user_name: userName,
      username: userName,
      user_email: userEmail,
      branch_code: branch,
      role: role,
      otp_code: otp,
    };

    const result = await emailjs.send(
      process.env.EMAILJS_SERVICE_ID,
      process.env.EMAILJS_TEMPLATE_ID,
      templateParams,
      {
        publicKey: process.env.EMAILJS_PUBLIC_KEY,
        privateKey: process.env.EMAILJS_PRIVATE_KEY,
      }
    );

    console.log("✅ OTP email sent successfully via EmailJS:", result.status);
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
 * Send approval notification to user using EmailJS
 */
export const sendApprovalEmail = async (userEmail, userName) => {
  try {
    const templateParams = {
      to_email: userEmail,
      reply_to: process.env.EMAILJS_REPLY_TO,
      user_name: userName,
      username: userName,
    };

    const result = await emailjs.send(
      process.env.EMAILJS_SERVICE_ID,
      "template_approval_notification", // You'll need to create this template
      templateParams,
      {
        publicKey: process.env.EMAILJS_PUBLIC_KEY,
        privateKey: process.env.EMAILJS_PRIVATE_KEY,
      }
    );

    console.log("✅ Approval email sent successfully to user:", result.status);
    return { success: true, message: "Approval email sent" };
  } catch (error) {
    console.error("❌ Failed to send approval email:", error.message);
    throw error;
  }
};
