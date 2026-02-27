import React, { useContext, useState, useEffect } from "react";
import "./OTPVerification.css";
import { assets } from "../../assets/frontend_assets/assets";
import { StoreContext } from "../../context/StoreContext";
import axios from "axios";
import { toast } from "react-toastify";

const OTPVerification = ({ email, onVerificationSuccess, onBackClick }) => {
  const { url, setToken, setUserName, setShowWelcome } =
    useContext(StoreContext);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [otpAttempts, setOtpAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);

  // Countdown timer for resend button
  useEffect(() => {
    let interval;
    if (resendCountdown > 0) {
      interval = setInterval(() => {
        setResendCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendCountdown]);

  const handleOTPChange = (e) => {
    const value = e.target.value.replace(/[^\d]/g, "").slice(0, 6);
    setOtp(value);
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();

    if (otp.length !== 6) {
      toast.error("Please enter a 6-digit OTP");
      return;
    }

    if (isLocked) {
      toast.error("Too many failed attempts. Please request a new OTP.");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(url + "/api/user/verify-otp", {
        email,
        otp,
      });

      if (response.data.success) {
        toast.success("Email verified successfully!");

        // Set token and user data
        setToken(response.data.token);
        localStorage.setItem("token", response.data.token);
        setUserName(response.data.name);
        setShowWelcome(true);

        // Call the success callback
        setTimeout(() => {
          onVerificationSuccess();
        }, 1000);
      } else {
        setOtpAttempts((prev) => prev + 1);

        if (response.data.accountLocked) {
          setIsLocked(true);
          toast.error(
            "Account locked due to multiple failed attempts. Request a new OTP.",
          );
        } else {
          const attemptsLeft = response.data.attemptsLeft || 5 - otpAttempts;
          toast.error(
            `${response.data.message} (${attemptsLeft} attempts left)`,
          );
        }
      }
    } catch (error) {
      console.error("Error verifying OTP:", error);
      toast.error("Failed to verify OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (resendCountdown > 0) return;

    setLoading(true);
    try {
      const response = await axios.post(url + "/api/user/resend-otp", {
        email,
      });

      if (response.data.success) {
        toast.success("OTP resent to your email!");
        setResendCountdown(60); // 60 seconds cooldown
        setOtp("");
        setOtpAttempts(0);
        setIsLocked(false);
      } else {
        toast.error(response.data.message || "Failed to resend OTP");
      }
    } catch (error) {
      console.error("Error resending OTP:", error);
      toast.error("Failed to resend OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="otp-verification">
      <div className="otp-verification-container">
        <div className="otp-verification-header">
          <button
            type="button"
            className="back-btn"
            onClick={onBackClick}
            disabled={loading}
          >
            ← Back
          </button>
          <h2>Verify Your Email</h2>
          <img
            onClick={onBackClick}
            src={assets.cross_icon}
            alt="Close"
            className="close-btn"
          />
        </div>

        <div className="otp-verification-content">
          <div className="otp-info">
            <p className="info-text">
              We've sent a 6-digit verification code to:
            </p>
            <p className="email-text">{email}</p>
            <p className="info-text small">
              The code will expire in 10 minutes
            </p>
          </div>

          <form onSubmit={handleVerifyOTP} className="otp-form">
            <input
              type="text"
              inputMode="numeric"
              placeholder="000000"
              value={otp}
              onChange={handleOTPChange}
              disabled={loading || isLocked}
              maxLength="6"
              className="otp-input"
            />

            <button
              type="submit"
              disabled={loading || otp.length !== 6 || isLocked}
              className="verify-btn"
            >
              {loading ? "Verifying..." : "Verify OTP"}
            </button>
          </form>

          <div className="otp-footer">
            <p>Didn't receive the code?</p>
            <button
              type="button"
              onClick={handleResendOTP}
              disabled={resendCountdown > 0 || loading || isLocked}
              className="resend-btn"
            >
              {resendCountdown > 0
                ? `Resend in ${resendCountdown}s`
                : "Resend OTP"}
            </button>
          </div>

          {otpAttempts > 2 && (
            <div className="warning-message">
              ⚠️ {5 - otpAttempts} attempts remaining before account lockup
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OTPVerification;
