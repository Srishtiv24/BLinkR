import multer from "multer";
import { Router } from "express";
import {
  uploadResume,
  generalizedQuestions,
  skillQuestions,
  regenerateQuestions,
} from "../controllers/resumeController.js";
import { localAuth, auth0Auth } from "../middlewares/middleware.js";

const router = Router();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./uploads");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage: storage });
//const upload = multer({ dest: 'uploads/' })

router
  .route("/")
  .post(upload.single("resume"), localAuth, auth0Auth, uploadResume);
router.route("/:id/question").get(localAuth, auth0Auth, generalizedQuestions);
router.route("/:id/question/skill").get(localAuth, auth0Auth, skillQuestions);
router
  .route("/:id/question/new")
  .get(localAuth, auth0Auth, regenerateQuestions);

export default router;
