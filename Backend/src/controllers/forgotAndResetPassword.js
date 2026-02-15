import dotenv from "dotenv";
if (process.env.NODE_ENV !== "production") {
  dotenv.config();
}

import nodemailer from "nodemailer";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { User } from "../models/user.model.js";
import httpStatus from "http-status";
import client from "../enviornment.js";
//Node Mailer

// Create a transporter using SMTP
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.GMAIL_APP_USER,
    pass: process.env.GMAIL_APP_PASS,
  },
});

const send = async (user, resetLink) => {
  try {
    const info = await transporter.sendMail({
      from: `"BLinkR" <${process.env.GMAIL_APP_USER}>`,
      to: user.email,
      subject: "Password Reset",
      html: `
      <p>Click the link below to reset your password. 
      <strong>This link is valid for 10 minutes only.</strong></p>
      <a href="${resetLink}">Reset Password</a>
    `
        });
    console.log("Message sent:", info.messageId);
  } catch (err) {
    console.log(err);
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const user = req.user;
    const token = jwt.sign(
      { userId: user._id, name: user.name },
      process.env.JWT_SECRET_KEY2,
      { expiresIn: "10m" }
    );
    const resetLink = `${client}/reset-password?token=${token}`;
    await send(user, resetLink);
    res.status(httpStatus.OK).json({ message: "Reset link sent to email" });
  } catch (err) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: "Error sending reset email" });
  }
};

export const resetPassword = async (req, res) => {
  const { token, newPassword, confirmPassword } = req.body;

  if (newPassword !== confirmPassword) {
    return res
      .status(httpStatus.BAD_REQUEST)
      .json({ message: "New password & confirm password do not match" });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY2);
    const user = await User.findById(decoded.userId);

    if (!user) return res.status(400).json({ message: "User not found" });

    if (user.authProvider !== "local") {
      return res
        .status(httpStatus.BAD_REQUEST)
        .json({ message: "Password reset not allowed for Auth0 users" });
    }
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.status(httpStatus.OK).json({ message: "Password updated successfully" });
  } catch (err) {
    res.status(httpStatus.BAD_REQUEST).json({ message: "Invalid or expired token" });
  }
};
