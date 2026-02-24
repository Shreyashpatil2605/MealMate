import express from "express";
import {
  addFood,
  listFood,
  removeFood,
  updateDescription,
  updateCategory,
  updatePrice,
  updateImage,
} from "../controllers/foodController.js";
import multer from "multer";
import authMiddleware from "../middleware/auth.js";
const foodRouter = express.Router();
// Image Storage Engine
const storage = multer.diskStorage({
  destination: "uploads",
  filename: (req, file, cb) => {
    return cb(null, `${Date.now()}${file.originalname}`);
  },
});

const upload = multer({ storage: storage });

foodRouter.post("/add", upload.single("image"), authMiddleware, addFood);
foodRouter.get("/list", listFood);
foodRouter.post("/remove", authMiddleware, removeFood);
// new endpoints for editing
foodRouter.post("/updateDescription", authMiddleware, updateDescription);
foodRouter.post("/updateCategory", authMiddleware, updateCategory);
foodRouter.post("/updatePrice", authMiddleware, updatePrice);
foodRouter.post(
  "/updateImage",
  upload.single("image"),
  authMiddleware,
  updateImage,
);

export default foodRouter;
