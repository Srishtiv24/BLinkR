import { Router } from "express";
import {addToHistory, getUserHistory, login,register ,clearUserHistory} from "../controllers/user.controller.js";
import {localAuth,auth0Auth,localRegistered} from "../middlewares/middleware.js";
import {forgotPassword,resetPassword} from "../controllers/forgotAndResetPassword.js";

const router=Router();

router.route("/login").post(login);
router.route("/register").post(register);
router.route("/activities").post(localAuth,auth0Auth,addToHistory);
router.route("/activities").get(localAuth,auth0Auth,getUserHistory);
router.route("/activities").delete(localAuth,auth0Auth,clearUserHistory);
router.route("/forgot-password").post(localRegistered,forgotPassword);
router.route("/reset-password").post(resetPassword);


export default router;



