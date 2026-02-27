import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: "user" },
    cartData: { type: Object, default: {} },
    photoURL: { type: String, default: "" },
    isGoogleUser: { type: Boolean, default: false },
    // Email verification fields
    isEmailVerified: { type: Boolean, default: false },
    otp: { type: String, default: null },
    otpExpiry: { type: Date, default: null },
    otpAttempts: { type: Number, default: 0 },
    // New fields for recommendation system
    dietaryPreferences: [{ type: String }], // e.g., vegetarian, vegan, gluten-free
    recentlyViewed: [{ type: mongoose.Schema.Types.ObjectId, ref: 'food' }], // Array of food IDs
  },
  { minimize: false, timestamps: true },
);

const userModel = mongoose.model.user || mongoose.model("user", userSchema);
export default userModel;
