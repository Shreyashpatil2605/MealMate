import mongoose from "mongoose";
import dotenv from "dotenv";
import menuModel from "./models/menuModel.js";

dotenv.config();

const seedMenuCategories = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL);
    console.log("MongoDB connected");

    // Check if menu categories already exist
    const existingMenus = await menuModel.find({});

    if (existingMenus.length > 0) {
      console.log("Menu categories already exist");
      process.exit(0);
    }

    // Default menu categories
    const defaultMenus = [
      {
        menu_name: "Salad",
        menu_image: "menu_placeholder_1.png",
        displayOrder: 0,
        isActive: true,
      },
      {
        menu_name: "Rolls",
        menu_image: "menu_placeholder_2.png",
        displayOrder: 1,
        isActive: true,
      },
      {
        menu_name: "Deserts",
        menu_image: "menu_placeholder_3.png",
        displayOrder: 2,
        isActive: true,
      },
      {
        menu_name: "Sandwich",
        menu_image: "menu_placeholder_4.png",
        displayOrder: 3,
        isActive: true,
      },
      {
        menu_name: "Cake",
        menu_image: "menu_placeholder_5.png",
        displayOrder: 4,
        isActive: true,
      },
      {
        menu_name: "Pure Veg",
        menu_image: "menu_placeholder_6.png",
        displayOrder: 5,
        isActive: true,
      },
      {
        menu_name: "Pasta",
        menu_image: "menu_placeholder_7.png",
        displayOrder: 6,
        isActive: true,
      },
      {
        menu_name: "Noodles",
        menu_image: "menu_placeholder_8.png",
        displayOrder: 7,
        isActive: true,
      },
    ];

    await menuModel.insertMany(defaultMenus);
    console.log("Menu categories seeded successfully");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding menu categories:", error);
    process.exit(1);
  }
};

seedMenuCategories();
