import jwt from "jsonwebtoken";

const authMiddleware = async (req, res, next) => {
  const { token } = req.headers;
  console.log("Auth Middleware - Received headers:", Object.keys(req.headers));
  console.log(
    "Auth Middleware - Token value:",
    token ? "✓ Present" : "✗ Missing",
  );

  if (!token) {
    console.error("Auth Middleware - Token missing from headers");
    return res.json({ success: false, message: "Not Authorized Login Again" });
  }
  try {
    const token_decode = jwt.verify(token, process.env.JWT_SECRET);
    console.log("Auth Middleware - Token verified, userId:", token_decode.id);
    req.body.userId = token_decode.id;
    req.userId = token_decode.id; // Also set on req for flexibility
    next();
  } catch (error) {
    console.error(
      "Auth Middleware - Token verification failed:",
      error.message,
    );
    res.json({ success: false, message: "Invalid Token" });
  }
};
export default authMiddleware;
