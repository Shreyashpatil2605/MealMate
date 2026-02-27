import mongoose from "mongoose";

const foodSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true },
  image: { type: String, required: true },
  category: { type: String, required: true },
  // New fields for recommendation system
  rating: { type: Number, default: 0, min: 0, max: 5 },
  orderCount: { type: Number, default: 0 },
  dietaryTags: [{ type: String }], // vegetarian, vegan, gluten-free, etc.
  mealType: [{ type: String }], // breakfast, lunch, dinner, snack
  weatherSuitability: [{ type: String }], // hot, cold, rainy, etc.
}, { timestamps: true });

const foodModel = mongoose.models.food || mongoose.model("food", foodSchema);

export default foodModel;
