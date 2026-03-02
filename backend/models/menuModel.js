import mongoose from "mongoose";

const menuSchema = new mongoose.Schema(
  {
    menu_name: { type: String, required: true, unique: true },
    menu_image: { type: String, required: true },
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const menuModel = mongoose.models.menu || mongoose.model("menu", menuSchema);

export default menuModel;
