import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import { connectDB } from "./config/db.js";
import foodRouter from "./routes/foodRoute.js";
import userRouter from "./routes/userRoute.js";
import "dotenv/config";
import cartRouter from "./routes/cartRoute.js";
import orderRouter from "./routes/orderRoute.js";
import recommendationRoute from "./routes/recommendationRoute.js";
import groupOrderRoute from "./routes/groupOrderRoute.js";

// app config
const app = express();
const port = process.env.PORT || 4000;

// Create HTTP server and Socket.IO server
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Store io instance for use in controllers
app.set('io', io);

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Join a group room
  socket.on('join-group', (groupCode) => {
    socket.join(groupCode);
    console.log(`Socket ${socket.id} joined group: ${groupCode}`);
  });

  // Leave a group room
  socket.on('leave-group', (groupCode) => {
    socket.leave(groupCode);
    console.log(`Socket ${socket.id} left group: ${groupCode}`);
  });

  // Handle chat messages
  socket.on('chat-message', (data) => {
    const { groupCode, userId, userName, message, timestamp } = data;
    if (groupCode) {
      // Broadcast message to all members in the group room
      io.to(groupCode).emit('chat-message', {
        groupCode,
        userId,
        userName,
        message,
        timestamp: timestamp || new Date().toISOString()
      });
      console.log(`Chat message in group ${groupCode} from ${userName}: ${message}`);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

//middlewares
app.use(express.json());
app.use(cors());

// DB connection
connectDB();

// api endpoints
app.use("/api/food", foodRouter);
app.use("/images", express.static("uploads"));
app.use("/api/user", userRouter);
app.use("/api/cart", cartRouter);
app.use("/api/order", orderRouter);
app.use("/api/recommendation", recommendationRoute);
app.use("/api/group-order", groupOrderRoute);

app.get("/", (req, res) => {
  res.send("API Working");
});

// Use httpServer.listen instead of app.listen
httpServer.listen(port, () => {
  console.log(`Server Started on port: ${port}`);
});
console.log(process.env.MONGO_URL);

export { io };
