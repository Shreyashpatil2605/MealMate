import React, { useContext, useState } from "react";
import "./LoginPopup.css";
import { assets } from "../../assets/frontend_assets/assets";
import { StoreContext } from "../../context/StoreContext";
import axios from "axios";
import { toast } from "react-toastify";
import { auth, googleProvider, signInWithPopup } from "../../firebase";
import OTPVerification from "../OTPVerification/OTPVerification";

const LoginPopup = ({ setShowLogin }) => {
  const { url, setToken, setUserName, setShowWelcome } =
    useContext(StoreContext);
  const [currentState, setCurrentState] = useState("Login");
  const [loading, setLoading] = useState(false);
  const [showOTPVerification, setShowOTPVerification] = useState(false);
  const [registrationEmail, setRegistrationEmail] = useState("");
  const [data, setData] = useState({
    name: "",
    email: "",
    password: "",
  });

  const onChangeHandler = (event) => {
    const name = event.target.name;
    const value = event.target.value;
    setData((data) => ({ ...data, [name]: value }));
  };

  const onLogin = async (event) => {
    event.preventDefault();
    let newUrl = url;
    if (currentState === "Login") {
      newUrl += "/api/user/login";
    } else {
      newUrl += "/api/user/register";
    }

    setLoading(true);
    try {
      const response = await axios.post(newUrl, data);

      if (response.data.success) {
        if (
          currentState === "Sign Up" &&
          response.data.requiresOTPVerification
        ) {
          // Show OTP verification screen
          setRegistrationEmail(data.email);
          setShowOTPVerification(true);
          toast.success("Account created! Please verify your email.");
        } else {
          // Direct login (for Login state or no OTP requirement)
          setToken(response.data.token);
          localStorage.setItem("token", response.data.token);
          const name =
            response.data.name ||
            (currentState === "Sign Up" ? data.name : "User");
          setUserName(name);
          setShowWelcome(true);
          setTimeout(() => {
            setShowLogin(false);
          }, 100);
        }
      } else {
        if (response.data.requiresVerification) {
          toast.error("Please verify your email before logging in");
        } else {
          toast.error(response.data.message);
        }
      }
    } catch (error) {
      console.error("Login/Register error:", error);
      toast.error("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      // Get the ID token from Firebase
      const idToken = await user.getIdToken();

      // Send the ID token to your backend
      const response = await axios.post(url + "/api/user/google-login", {
        idToken: idToken,
        name: user.displayName || user.email.split("@")[0],
        email: user.email,
        photoURL: user.photoURL,
      });

      if (response.data.success) {
        setToken(response.data.token);
        localStorage.setItem("token", response.data.token);
        const name = response.data.name || user.displayName || "User";
        setUserName(name);
        setShowWelcome(true);
        setTimeout(() => {
          setShowLogin(false);
        }, 100);
        toast.success("Logged in with Google successfully!");
      } else {
        toast.error(response.data.message || "Failed to login with Google");
      }
    } catch (error) {
      console.error("Google login error:", error);
      if (error.code === "auth/popup-closed-by-user") {
        toast.info("Sign in was cancelled. Please try again.");
      } else {
        toast.error("Failed to login with Google. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOTPVerificationSuccess = () => {
    setShowOTPVerification(false);
    setShowLogin(false);
  };

  const handleBackFromOTP = () => {
    setShowOTPVerification(false);
    // Reset form for re-registration
    setData({
      name: "",
      email: "",
      password: "",
    });
  };

  if (showOTPVerification) {
    return (
      <OTPVerification
        email={registrationEmail}
        onVerificationSuccess={handleOTPVerificationSuccess}
        onBackClick={handleBackFromOTP}
      />
    );
  }

  return (
    <div className="login-popup">
      <form onSubmit={onLogin} className="login-popup-container">
        <div className="login-popup-title">
          <h2>{currentState}</h2>
          <img
            onClick={() => setShowLogin(false)}
            src={assets.cross_icon}
            alt=""
          />
        </div>
        <div className="login-popup-inputs">
          {currentState === "Login" ? (
            <></>
          ) : (
            <input
              name="name"
              onChange={onChangeHandler}
              value={data.name}
              type="text"
              placeholder="Your name"
              required
            />
          )}
          <input
            name="email"
            onChange={onChangeHandler}
            value={data.email}
            type="email"
            placeholder="Your email"
            required
          />
          <input
            name="password"
            onChange={onChangeHandler}
            value={data.password}
            type="password"
            placeholder="Your password"
            required
          />
        </div>
        <button type="submit" disabled={loading}>
          {loading
            ? "Processing..."
            : currentState === "Sign Up"
              ? "Create Account"
              : "Login"}
        </button>
        {currentState === "Login" && (
          <button
            type="button"
            className="google-login-btn"
            onClick={handleGoogleLogin}
            disabled={loading}
          >
            {loading ? "Loading..." : "Continue with Google"}
          </button>
        )}
        <div className="login-popup-condition">
          <input type="checkbox" required />
          <p>By continuing, i agree to the terms of use & privacy policy.</p>
        </div>
        {currentState === "Login" ? (
          <p>
            Create a new account?{" "}
            <span onClick={() => setCurrentState("Sign Up")}>Click here</span>
          </p>
        ) : (
          <p>
            Already have an account?{" "}
            <span onClick={() => setCurrentState("Login")}>Login here</span>
          </p>
        )}
      </form>
    </div>
  );
};

export default LoginPopup;
