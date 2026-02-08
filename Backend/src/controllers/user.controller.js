import httpStatus from "http-status";
import { User } from "../models/user.model.js";
import bcrypt from "bcrypt";
import crypto from "crypto";
import {Meeting} from "../models/meeting.model.js"

//database-stores token method of auth
const login = async (req, res) => {
  const { password, username } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .json({ message: "Please provide both username and password" });
  }

  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res
        .status(httpStatus.NOT_FOUND)
        .json({ message: "User NOT FOUND!" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (isMatch) {
      let token = crypto.randomBytes(20).toString("hex"); //20 bytes binary data into hex string pf 40 chars
      user.token = token;
      await user.save(); //add token with storwd info of user
      return res.status(httpStatus.OK).json({ token: token,user:user.name });
    } else {//password not matched 
      return res
        .status(httpStatus.UNAUTHORIZED)//error part - of AuthContext
        .json({ message: "Invalid username or password" });
    }
  } catch (err) {
    return res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .json({ message: `Something went wrong ${err}` });
  }
};

const register = async (req, res) => {
  const { name, password, username } = req.body;
  if (!name || !username || !password) {
    return res
      .status(400)
      .json({ message: "Please provide name, username, and password" });
  }

  try {
    const existingUser = await User.findOne({ username });

    if (existingUser) {
      return res
        .status(httpStatus.CONFLICT)
        .json({ message: "User already exists!" });
    }

    const hashedPassword = await bcrypt.hash(password, 10); //length is 10
    const newUser = new User({
      name: name,
      username: username,
      password: hashedPassword,
    });

    await newUser.save();
    res.status(httpStatus.CREATED).json({ message: "User registered" });
  } catch (e) {
    res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .json({ message: `Something went wrong ${e}` });
  }
}
  const getUserHistory=async (req,res)=>{
    const {token}=req.query;
    try{
      const user=await User.findOne({token:token});
      const meetings=await Meeting.find({user_id:user._id});//arr
      res.json(meetings);
    }catch(e)
    {  res.json({message:`Something went wrong ${e}`});
    }
  }

  const addToHistory=async (req,res)=>{
    const {token,meetingCode}=req.body;
    try {
      const user=await User.findOne({token:token});
      const newMeeting =new Meeting(
        {
          user_id:user._id,
          meeting_code:meetingCode
        })
        await newMeeting.save();

        res.status(httpStatus.CREATED).json({message:"Added meeting details to history"});
      }
    catch(e)
    {  res.json({message:`Something went wrong ${e}`});  
    }
}


export { login, register ,getUserHistory,addToHistory};

