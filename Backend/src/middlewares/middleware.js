import dotenv from "dotenv";
if (process.env.NODE_ENV !== "production") {
  dotenv.config();
}

import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import axios from "axios";
import { User } from "../models/user.model.js";
import httpStatus from "http-status";

export const localAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader)
    return res.status(401).json({ message: "No token provided" });

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    req.user = decoded;
    return next();
  } catch (err) {
    console.log("Local Authentication failed");
    return next(); //delegate to next middleware
  }
};

const client = jwksClient({
  jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`,
});

function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    callback(null, key.getPublicKey());
  });
}

const syncAuth0User = async (profile) => {
  const user = await User.findOne({ email: profile.email });

  if (!user) {
    user = await User.create({
      name: profile.name,
      email: profile.email,
      authProvider: "auth0",
    });
  } else {
    user.authProvider = "auth0";
    await user.save();
  }
  return user;
};

export const auth0Auth = async (req, res, next) => {
  if (req.user) return next(); // already authenticated locally
  const authHeader = req.headers.authorization;
  if (!authHeader)
    return res.status(401).json({ message: "No token provided" });
  const token = authHeader.split(" ")[1];
  jwt.verify(
    token,
    getKey,
    {
      audience: "http://localhost:8000/api/v1",
      issuer: `https://${process.env.AUTH0_DOMAIN}/`,
      algorithms: ["RS256"],
    },
    async (err, decoded) => {
      if (err)
        return res.status(403).json({ message: "Invalid or expired token" });
      try {
        // fetch profile info from Auth0
        const profileResponse = await axios.get(
          `https://${process.env.AUTH0_DOMAIN}/userinfo`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const profile = profileResponse.data; // sync user into MongoDB
        const user = await syncAuth0User(profile);
        req.user = user;
        return next();
      } catch (e) {
        console.error("Failed to fetch or sync Auth0 user:", e);
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: "Auth0 user sync failed" });
      }
    }
  );
};

export const localRegistered = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email });

    if (!user) {
      return res.status(httpStatus.BAD_REQUEST).json({ message: "User not found" });
    }

    if (user.authProvider !== "local") {
      return res
        .status(httpStatus.BAD_REQUEST)
        .json({
          message:
            "Password reset not allowed for this account . Please continue with Google login.",
        });
    }

    req.user = user;
    next();
  } catch (err) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: "Server error" });
  }
};
