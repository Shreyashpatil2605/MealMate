import userModel from "../models/userModel.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import validator from "validator";

// login user

const loginUser = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await userModel.findOne({ email });
    if (!user) {
      return res.json({ success: false, message: "User Doesn't exist" });
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

// register user

const registerUser = async (req, res) => {
  const { name, email, password } = req.body;
  try {
    // checking user is already exist
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

    // hashing user password

    const salt = await bcrypt.genSalt(Number(process.env.SALT));
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new userModel({
      name: name,
      email: email,
      password: hashedPassword,
    });

    const user = await newUser.save();
    const role = user.role;
    const token = createToken(user._id);
    res.json({ success: true, token, role, name: user.name });
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

export { loginUser, registerUser, googleLogin };
