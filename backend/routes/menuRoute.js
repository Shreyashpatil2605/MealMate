import express from "express";
import {
  addMenu,
  listMenu,
  updateMenu,
  deleteMenu,
} from "../controllers/menuController.js";
import multer from "multer";
import authMiddleware from "../middleware/auth.js";

const menuRouter = express.Router();

// Image Storage Engine
const storage = multer.diskStorage({
  destination: "uploads",
  filename: (req, file, cb) => {
    return cb(null, `${Date.now()}${file.originalname}`);
  },
});

const upload = multer({ storage: storage });

menuRouter.post("/add", upload.single("image"), authMiddleware, addMenu);
menuRouter.get("/list", listMenu);
menuRouter.post("/update", upload.single("image"), authMiddleware, updateMenu);
menuRouter.post("/delete", authMiddleware, deleteMenu);

export default menuRouter;
