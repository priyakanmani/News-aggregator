const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const axios = require("axios");
const User = require("./models/User"); // Replace with your User model


const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

// Connect to MongoDB
mongoose.connect("mongodb://localhost:27017/auth-db", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Signup route
app.post("/signup", async (req, res) => {
  const { email, password } = req.body;
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(400).json({ message: "User already exists. Please log in." });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = new User({ email, password: hashedPassword });

  try {
    await user.save();
    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Login route
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(404).json({ message: "User not found. Please register." });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(401).json({ message: "Invalid credentials. Please try again." });
  }

  const token = jwt.sign({ userId: user._id }, "your_jwt_secret", {
    expiresIn: "1h",
  });

  res.json({ token, message: "Login successful" });
});

// Forgot password route
app.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(404).json({ message: "No account found with that email" });
  }

  const resetToken = jwt.sign({ userId: user._id }, "your_jwt_secret", { expiresIn: "1h" });
  const resetTokenExpiry = Date.now() + 3600000;

  user.resetToken = resetToken;
  user.resetTokenExpiry = resetTokenExpiry;
  await user.save();

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: "kanmanipriyas.22cse@kongu.edu",
      pass: "rncd cmmp ixyg plif",
    },
    tls: { rejectUnauthorized: false },
  });

  const mailOptions = {
    from: "kanmanipriyas.22cse@kongu.edu",
    to: email,
    subject: "Password Reset Link",
    text: `You requested a password reset. Click the link to reset your password: 
    http://localhost:5173/reset-password/${resetToken}`,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.json({ message: "Password reset link sent to your email" });
  } catch (error) {
    console.error("Error sending reset link:", error);
    res.status(500).json({ message: "Error sending reset link" });
  }
});

// Reset password route
app.post("/reset-password", async (req, res) => {
  const { resetToken, newPassword } = req.body;

  try {
    const decoded = jwt.verify(resetToken, "your_jwt_secret");
    const user = await User.findOne({ _id: decoded.userId, resetToken });

    if (!user || user.resetTokenExpiry < Date.now()) {
      return res.status(400).json({ message: "Invalid or expired reset token" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

    res.json({ message: "Password successfully reset" });
  } catch (error) {
    res.status(500).json({ message: "An error occurred while resetting the password" });
  }
});

// News fetching route
app.get("/api/news", async (req, res) => {
  const apiKey = "3ab53a4e5310424dbe67f46551b27c21";
  const url = `https://newsapi.org/v2/top-headlines?country=us&apiKey=${apiKey}`;

  try {
    const response = await axios.get(url);
    const articles = response.data.articles.map((article) => ({
      id: article.source.id || article.url,
      title: article.title,
      imageUrl: article.urlToImage || "https://via.placeholder.com/150",
      date: article.publishedAt,
      description: article.description,
    }));
    res.json(articles);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch news articles" });
  }
});

// Search History Routes
app.post("/api/search-history", async (req, res) => {
  const { query, userId } = req.body;
  const searchHistory = new SearchHistory({
    userId,
    query,
    date: new Date(),
  });

  try {
    await searchHistory.save();
    res.json({ message: "Search history saved successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error saving search history" });
  }
});

app.get("/api/search-history/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const history = await SearchHistory.find({ userId }).sort({ date: -1 });
    res.json(history);
  } catch (error) {
    res.status(500).json({ message: "Error fetching search history" });
  }
});

// Email sending route for subscription
app.post("/send-email", async (req, res) => {
  const { email } = req.body;

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "kanmanipriyas.22cse@kongu.edu",
      pass: "rncd cmmp ixyg plif",
    },
  });

  const mailOptions = {
    from: "kanmanipriyas.22cse@kongu.edu",
    to: email,
    subject: "Website Link",
    text: "Thank you for subscribing! Here’s the link to our website: http://localhost:5173/",
  };

  try {
    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: "Email sent successfully" });
  } catch (error) {
    console.error("Error sending email:", error);
    res.status(500).json({ message: "Failed to send email" });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
