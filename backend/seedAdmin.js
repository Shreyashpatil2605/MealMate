import mongoose from "mongoose";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import userModel from "./models/userModel.js";

dotenv.config();

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL);
    console.log("MongoDB connected");

    // Check if admin already exists
    const existingAdmin = await userModel.findOne({ email: "admin@food.com" });

    if (existingAdmin) {
      console.log("Admin account already exists");
      process.exit(0);
    }

    // Create admin account with password "admin123"
    const salt = await bcrypt.genSalt(Number(process.env.SALT));
    const hashedPassword = await bcrypt.hash("admin123", salt);

    const adminUser = new userModel({
      name: "Admin",
      email: "admin@food.com",
      password: hashedPassword,
      role: "admin",
      isEmailVerified: true, // Admin account is pre-verified
      cartData: {},
    });

    await adminUser.save();
    console.log("Admin account created successfully");
    console.log("Email: admin@food.com");
    console.log("Password: admin123");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding admin:", error);
    process.exit(1);
  }
};

seedAdmin();
