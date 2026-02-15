import httpStatus from "http-status";
import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { Meeting } from "../models/meeting.model.js";
import { User } from "../models/user.model.js";

//database-stores token method of auth
const login = async (req, res) => {
  const { password, email } = req.body;

  if (!email || !password) {
    return res
      .status(400)
      .json({ message: "Please provide both email and password" });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(httpStatus.NOT_FOUND)
        .json({ message: "User NOT FOUND!" });
    }
    if (user.authProvider === "local") {
      const isMatch = await bcrypt.compare(password, user.password);

      if (isMatch) {
        // let token = crypto.randomBytes(20).toString("hex"); //20 bytes binary data into hex string pf 40 chars

        //jwt auth
        const token = jwt.sign(
          { id: user._id, name: user.name, email: user.email }, //payload
          process.env.JWT_SECRET_KEY, // secret key
          { expiresIn: "1h" } // expiry
        );

        // user.token = token;  //random token stored in db auth
        // await user.save(); //add token with storwd info of user

        return res
          .status(httpStatus.OK)
          .json({
            token: token,
            user: { name: user.name, email: user.email, id: user._id },
          });
      } else {
        //password not matched
        return res
          .status(httpStatus.UNAUTHORIZED) //error part - of AuthContext
          .json({ message: "Invalid email or password" });
      }
    } else {
      return res
        .status(400)
        .json({ message: "Use Google login for this account" });
    }
  } catch (err) {
    return res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .json({ message: `Something went wrong ${err}` });
  }
};

const register = async (req, res) => {
  const { name, password, email } = req.body;
  if (!name || !email || !password) {
    return res
      .status(400)
      .json({ message: "Please provide name, email, and password" });
  }

  try {
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res
        .status(httpStatus.CONFLICT)
        .json({ message: "User already exists!" });
    }
    if (password.length < 6) {
      //min 6 chars
      return res.status(400).json({
        errors: { password: "Password must be at least 6 characters long." },
      });
    }
    if (
      !/[A-Z]/.test(password) ||
      !/[0-9]/.test(password) ||
      !/[!@#$%^&*(),.?":{}|<>]/.test(password)
    ) {
      return res.status(400).json({
        errors: {
          password:
            "Password must include at least one uppercase letter, one number, and one special character.",
        },
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10); //length is 10
    const newUser = new User({
      name: name,
      email: email,
      password: hashedPassword,
      authProvider: "local",
    });

    await newUser.save();
    res.status(httpStatus.CREATED).json({ message: "User registered" });
  } catch (e) {
    res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .json({ message: `Something went wrong ${e}` });
  }
};

const getUserHistory = async (req, res) => {
  //const { token } = req.query;
  try {
    //const user = await User.findOne({ token: token });
    const meetings = await Meeting.find({ user_id: req.user.id }); //arr
    res.json(meetings);
  } catch (e) {
    res.json({ message: `Something went wrong ${e}` });
  }
};

const addToHistory = async (req, res) => {
  const { meetingCode } = req.body;
  try {
    // const user = await User.findOne({ token: token });
    const newMeeting = new Meeting({
      user_id: req.user.id,
      meeting_code: meetingCode,
    });
    await newMeeting.save();

    res
      .status(httpStatus.CREATED)
      .json({ message: "Added meeting details to history" });
  } catch (e) {
    res.json({ message: `Something went wrong ${e}` });
  }
};

const clearUserHistory = async (req, res) => {
  //const { token } = req.query;
  try {
    // const user = await User.findOne({ token: token });
    const meetings = await Meeting.deleteMany({ user_id: req.user.id }); //arr
    res.json(meetings);
  } catch (e) {
    res.json({ message: `Something went wrong ${e}` });
  }
};

export { login, register, getUserHistory, addToHistory, clearUserHistory };
