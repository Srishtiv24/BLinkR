import { Router } from "express";
import {addToHistory, getUserHistory, login,register ,clearUserHistory} from "../controllers/user.controller.js"
import {localAuth,auth0Auth,localRegistered} from "../middlewares/middleware.js";
import {forgotPassword,resetPassword} from "../controllers/forgotAndResetPassword.js"
const router=Router();

router.route("/login").post(login);
router.route("/register").post(register);
router.route("/add_to_activity").post(localAuth,auth0Auth,addToHistory);
router.route("/get_all_activity").get(localAuth,auth0Auth,getUserHistory);
router.route("/clear_all_activity").get(localAuth,auth0Auth,clearUserHistory);
router.route("/forgot_password").post(localRegistered,forgotPassword);
router.route("/reset_password").post(resetPassword);


export default router;



