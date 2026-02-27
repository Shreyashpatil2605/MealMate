import express from "express";
import {
  loginUser,
  registerUser,
  googleLogin,
  sendOTP,
  verifyEmailOTP,
  resendOTP,
} from "../controllers/userController.js";

const userRouter = express.Router();

userRouter.post("/register", registerUser);
userRouter.post("/login", loginUser);
userRouter.post("/google-login", googleLogin);
userRouter.post("/send-otp", sendOTP);
userRouter.post("/verify-otp", verifyEmailOTP);
userRouter.post("/resend-otp", resendOTP);

export default userRouter;
