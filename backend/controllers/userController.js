import userModel from "../models/userModel.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import validator from "validator";
import { generateOTP, sendOTPEmail, verifyOTP } from "../utils/otpService.js";

// login user

const loginUser = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await userModel.findOne({ email });
    if (!user) {
      return res.json({ success: false, message: "User Doesn't exist" });
    }

    // Check if email is verified (skip for Google users)
    if (!user.isGoogleUser && !user.isEmailVerified) {
      return res.json({
        success: false,
        message: "Please verify your email first",
        requiresVerification: true,
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.json({ success: false, message: "Invalid Credentials" });
    }
    const role = user.role;
    const name = user.name;
    const token = createToken(user._id);
    res.json({ success: true, token, role, name });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Error" });
  }
};

// Create token

const createToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET);
};

// register user - Phase 1: Create account
const registerUser = async (req, res) => {
  const { name, email, password } = req.body;
  try {
    // checking user already exists
    const exists = await userModel.findOne({ email });
    if (exists) {
      return res.json({ success: false, message: "User already exists" });
    }

    // validating email format and strong password
    if (!validator.isEmail(email)) {
      return res.json({ success: false, message: "Please enter valid email" });
    }
    if (password.length < 8) {
      return res.json({
        success: false,
        message: "Please enter strong password",
      });
    }

    // Hash user password
    const salt = await bcrypt.genSalt(Number(process.env.SALT));
    const hashedPassword = await bcrypt.hash(password, salt);

    // Generate OTP
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes validity

    // Create new user (not verified yet)
    const newUser = new userModel({
      name: name,
      email: email,
      password: hashedPassword,
      isEmailVerified: false,
      otp: otp,
      otpExpiry: otpExpiry,
    });

    const user = await newUser.save();

    // Send OTP to email
    const emailResult = await sendOTPEmail(email, otp, name);

    if (!emailResult.success) {
      // Delete user if email sending fails
      await userModel.findByIdAndDelete(user._id);
      return res.json({
        success: false,
        message: "Failed to send OTP. Please try again.",
      });
    }

    res.json({
      success: true,
      message: "User created. OTP sent to your email.",
      userId: user._id,
      email: user.email,
      requiresOTPVerification: true,
    });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Error" });
  }
};

// Google Login - handle users signing in with Google
const googleLogin = async (req, res) => {
  try {
    const { idToken, name, email, photoURL } = req.body;

    if (!idToken || !email) {
      return res.json({ success: false, message: "Invalid request" });
    }

    // Check if user already exists
    let user = await userModel.findOne({ email });

    if (!user) {
      // Create new user with Google info
      user = new userModel({
        name: name || email.split("@")[0],
        email: email,
        password: "google-oauth", // Placeholder for Google users
        photoURL: photoURL || "",
        isGoogleUser: true,
      });

      await user.save();
    }

    // Generate JWT token
    const token = createToken(user._id);
    const role = user.role;

    res.json({
      success: true,
      token,
      role,
      name: user.name,
    });
  } catch (error) {
    console.error("Google login error:", error);
    res.json({ success: false, message: "Error logging in with Google" });
  }
};

// Send OTP to email
const sendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.json({ success: false, message: "Email is required" });
    }

    const user = await userModel.findOne({ email });
    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }

    // If already verified, no need to send OTP
    if (user.isEmailVerified) {
      return res.json({
        success: false,
        message: "Email is already verified",
      });
    }

    // Generate new OTP
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Update user with new OTP
    user.otp = otp;
    user.otpExpiry = otpExpiry;
    user.otpAttempts = 0;
    await user.save();

    // Send OTP email
    const emailResult = await sendOTPEmail(email, otp, user.name);

    if (!emailResult.success) {
      return res.json({ success: false, message: "Failed to send OTP" });
    }

    res.json({ success: true, message: "OTP sent to your email" });
  } catch (error) {
    console.error("Error sending OTP:", error);
    res.json({ success: false, message: "Error sending OTP" });
  }
};

// Verify OTP and activate account
const verifyEmailOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.json({ success: false, message: "Email and OTP required" });
    }

    const user = await userModel.findOne({ email });
    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }

    // Check if already verified
    if (user.isEmailVerified) {
      return res.json({
        success: false,
        message: "Email is already verified",
      });
    }

    // Verify OTP
    const verification = verifyOTP(user.otp, otp, user.otpExpiry);

    if (!verification.success) {
      // Increment OTP attempts
      user.otpAttempts = (user.otpAttempts || 0) + 1;

      // Lock account after 5 failed attempts
      if (user.otpAttempts >= 5) {
        return res.json({
          success: false,
          message: "Too many failed attempts. Please request a new OTP.",
          accountLocked: true,
        });
      }

      await user.save();
      return res.json({
        success: false,
        message: verification.message,
        attemptsLeft: 5 - user.otpAttempts,
      });
    }

    // OTP verified successfully
    user.isEmailVerified = true;
    user.otp = null;
    user.otpExpiry = null;
    user.otpAttempts = 0;
    await user.save();

    // Generate token
    const token = createToken(user._id);

    res.json({
      success: true,
      message: "Email verified successfully",
      token,
      role: user.role,
      name: user.name,
    });
  } catch (error) {
    console.error("Error verifying OTP:", error);
    res.json({ success: false, message: "Error verifying OTP" });
  }
};

// Resend OTP
const resendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.json({ success: false, message: "Email is required" });
    }

    const user = await userModel.findOne({ email });
    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }

    if (user.isEmailVerified) {
      return res.json({
        success: false,
        message: "Email is already verified",
      });
    }

    // Generate new OTP
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    user.otp = otp;
    user.otpExpiry = otpExpiry;
    user.otpAttempts = 0; // Reset attempts on resend
    await user.save();

    // Send OTP email
    const emailResult = await sendOTPEmail(email, otp, user.name);

    if (!emailResult.success) {
      return res.json({ success: false, message: "Failed to send OTP" });
    }

    res.json({ success: true, message: "OTP resent to your email" });
  } catch (error) {
    console.error("Error resending OTP:", error);
    res.json({ success: false, message: "Error resending OTP" });
  }
};

export {
  loginUser,
  registerUser,
  googleLogin,
  sendOTP,
  verifyEmailOTP,
  resendOTP,
};
