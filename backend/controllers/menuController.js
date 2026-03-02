import menuModel from "../models/menuModel.js";
import userModel from "../models/userModel.js";
import fs from "fs";

// Add menu category
const addMenu = async (req, res) => {
  let image_filename = `${req.file.filename}`;
  const menu = new menuModel({
    menu_name: req.body.menu_name,
    menu_image: image_filename,
    displayOrder: req.body.displayOrder || 0,
    isActive: true,
  });

  try {
    let userData = await userModel.findById(req.body.userId);
    if (userData && userData.role === "admin") {
      await menu.save();
      res.json({ success: true, message: "Menu category added" });
    } else {
      res.json({ success: false, message: "You are not admin" });
    }
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Error adding menu category" });
  }
};

// Get all menu categories
const listMenu = async (req, res) => {
  try {
    const menus = await menuModel.find({}).sort({ displayOrder: 1 });
    res.json({ success: true, data: menus });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Error retrieving menu categories" });
  }
};

// Update menu category
const updateMenu = async (req, res) => {
  try {
    let userData = await userModel.findById(req.body.userId);
    if (userData && userData.role === "admin") {
      const updateData = {
        menu_name: req.body.menu_name,
        displayOrder: req.body.displayOrder,
        isActive: req.body.isActive,
      };

      // If new image is provided
      if (req.file) {
        const menu = await menuModel.findById(req.body.id);
        // Delete old image
        if (menu && menu.menu_image) {
          fs.unlink(`uploads/${menu.menu_image}`, () => {});
        }
        updateData.menu_image = req.file.filename;
      }

      await menuModel.findByIdAndUpdate(req.body.id, updateData);
      res.json({ success: true, message: "Menu category updated" });
    } else {
      res.json({ success: false, message: "You are not admin" });
    }
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Error updating menu category" });
  }
};

// Delete menu category
const deleteMenu = async (req, res) => {
  try {
    let userData = await userModel.findById(req.body.userId);
    if (userData && userData.role === "admin") {
      const menu = await menuModel.findById(req.body.id);
      if (menu && menu.menu_image) {
        fs.unlink(`uploads/${menu.menu_image}`, () => {});
      }
      await menuModel.findByIdAndDelete(req.body.id);
      res.json({ success: true, message: "Menu category deleted" });
    } else {
      res.json({ success: false, message: "You are not admin" });
    }
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Error deleting menu category" });
  }
};

export { addMenu, listMenu, updateMenu, deleteMenu };
