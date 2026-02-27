import nodemailer from "nodemailer";

// Generate 6-digit OTP
export const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Configure email transporter with proper Gmail settings
let transporter = null;
let transporterInitialized = false;

const initializeTransporter = () => {
  if (transporterInitialized) return transporter;

  const smtpEmail = process.env.SMTP_EMAIL?.trim();
  const smtpPassword = process.env.SMTP_PASSWORD?.trim().replace(/\s/g, "");

  console.log("\n========== NODEMAILER INITIALIZATION ==========");
  console.log("📧 SMTP_EMAIL:", smtpEmail ? "✓ Configured" : "✗ Missing");
  console.log("🔑 SMTP_PASSWORD:", smtpPassword ? "✓ Configured" : "✗ Missing");

  if (!smtpEmail || !smtpPassword) {
    console.error(
      "❌ SMTP credentials not configured. OTP emails will NOT be sent.",
    );
    console.error("📝 .env file should contain:");
    console.error("   SMTP_EMAIL=your-email@gmail.com");
    console.error("   SMTP_PASSWORD=your-app-password (16 characters)");
    transporterInitialized = true;
    return null;
  }

  try {
    transporter = nodemailer.createTransport({
      service: "gmail",
      host: "smtp.gmail.com",
      port: 587,
      secure: false, // TLS
      auth: {
        user: smtpEmail,
        pass: smtpPassword,
      },
      connectionTimeout: 10000,
      socketTimeout: 10000,
      greetingTimeout: 10000,
      pool: {
        maxConnections: 1,
        maxMessages: 1,
        rateDelta: 20000,
        rateLimit: 1,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    // Verify transporter connection asynchronously
    transporter.verify((error, success) => {
      if (error) {
        console.error("❌ SMTP Connection Error:", error.message);
        console.error("📋 Error Code:", error.code);
        if (error.message.includes("Invalid login") || error.code === "EAUTH") {
          console.error("💡 Fix: Verify SMTP credentials");
          console.error(
            "   - Ensure you have 2-Factor Authentication enabled on Gmail",
          );
          console.error("   - Use an App Password (not your Gmail password)");
          console.error(
            "   - App Password should be 16 characters without spaces",
          );
          console.error(
            "   - Check: https://myaccount.google.com/apppasswords",
          );
        } else if (error.code === "ECONNRESET" || error.code === "ETIMEDOUT") {
          console.error("💡 Fix: Network or firewall issue");
          console.error("   - Check your internet connection");
          console.error("   - Verify Gmail SMTP server is accessible");
          console.error("   - Try disabling VPN/proxy temporarily");
        }
      } else {
        console.log("✅ SMTP Connected successfully!");
        console.log("📧 Ready to send OTP emails");
      }
    });

    console.log("=========== INITIALIZATION COMPLETE ===========\n");
    transporterInitialized = true;
    return transporter;
  } catch (error) {
    console.error("❌ Nodemailer setup error:", error.message);
    transporterInitialized = true;
    return null;
  }
};

// Initialize on first use
const getTransporter = () => {
  if (!transporterInitialized) {
    return initializeTransporter();
  }
  return transporter;
};

// Send OTP via email
export const sendOTPEmail = async (email, otp, name) => {
  try {
    const mailTransporter = getTransporter();

    if (!mailTransporter) {
      console.error("❌ Email service not configured");
      return {
        success: false,
        message: "Email service not configured. Please contact admin.",
      };
    }

    const mailOptions = {
      from: `"MealMate" <${process.env.SMTP_EMAIL}>`,
      to: email,
      subject: "🍕 Email Verification - MealMate Food Delivery",
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f5f5f5;">
          <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px; letter-spacing: 2px;">🍕 MealMate</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">Food Delivery</p>
          </div>
          <div style="background-color: white; padding: 40px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <h2 style="color: #1d1d1d; margin: 0 0 20px 0; font-size: 22px;">Hello ${name || "User"},</h2>
            
            <p style="color: #666; font-size: 15px; line-height: 1.6; margin: 0 0 25px 0;">
              Welcome to MealMate! To verify your email address and complete your registration, please use the One-Time Password (OTP) below:
            </p>

            <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-left: 4px solid #22c55e; padding: 20px; border-radius: 8px; margin: 25px 0; text-align: center;">
              <p style="color: #666; margin: 0 0 10px 0; font-size: 12px;">Your verification code</p>
              <h1 style="color: #16a34a; letter-spacing: 8px; margin: 0; font-size: 36px; font-weight: bold; font-family: 'Courier New', monospace;">${otp}</h1>
              <p style="color: #999; margin: 10px 0 0 0; font-size: 12px;">Valid for 10 minutes only</p>
            </div>

            <div style="background-color: #f9f9f9; border-radius: 8px; padding: 15px; margin: 25px 0;">
              <ul style="margin: 0; padding-left: 20px; color: #666; font-size: 13px;">
                <li style="margin-bottom: 8px;">Do not share this code with anyone</li>
                <li style="margin-bottom: 8px;">MealMate will never ask for your OTP via email</li>
                <li>This code expires in 10 minutes</li>
              </ul>
            </div>

            <p style="color: #999; font-size: 12px; line-height: 1.6; margin: 25px 0 0 0; border-top: 1px solid #eee; padding-top: 20px;">
              If you didn't create this account, please ignore this email or contact our support team.
            </p>
            <p style="color: #999; font-size: 11px; margin: 15px 0 0 0;">
              © 2026 MealMate Food Delivery. All rights reserved.<br>
              Made with ❤️ for you
            </p>
          </div>
        </div>
      `,
    };

    const info = await mailTransporter.sendMail(mailOptions);
    console.log(
      `✅ OTP sent successfully to ${email} (Message ID: ${info.messageId})`,
    );
    return { success: true, message: "OTP sent to your email" };
  } catch (error) {
    console.error("❌ Error sending OTP email:", error.message);
    console.error("📋 Error Code:", error.code);
    console.error("📋 Full Error:", error);

    // Provide specific fixes based on error type
    if (error.code === "ECONNRESET" || error.code === "ETIMEDOUT") {
      console.error("🔧 Connection Reset/Timeout - Possible fixes:");
      console.error("   1. Check your internet connection");
      console.error(
        "   2. Verify Gmail SMTP is accessible (smtp.gmail.com:587)",
      );
      console.error("   3. Disable VPN/proxy if using");
      console.error("   4. Check if 2FA is enabled on Gmail");
      console.error(
        "   5. Verify you're using a 16-character App Password, not your Gmail password",
      );
    } else if (
      error.code === "EAUTH" ||
      error.message.includes("Invalid login")
    ) {
      console.error("🔧 Authentication Failed - Possible fixes:");
      console.error("   1. Go to: https://myaccount.google.com/apppasswords");
      console.error("   2. Generate a new App Password");
      console.error(
        "   3. Update SMTP_PASSWORD in .env (16 characters, no spaces)",
      );
      console.error("   4. Restart the server");
    }

    return {
      success: false,
      message: "Failed to send OTP email. Please try again.",
    };
  }
};

// Verify OTP
export const verifyOTP = (storedOTP, userOTP, otpExpiry) => {
  if (!storedOTP || !userOTP) {
    return { success: false, message: "OTP not found or invalid" };
  }

  if (new Date() > new Date(otpExpiry)) {
    return { success: false, message: "OTP has expired" };
  }

  if (storedOTP !== userOTP) {
    return { success: false, message: "Invalid OTP" };
  }

  return { success: true, message: "OTP verified successfully" };
};

export default getTransporter;
