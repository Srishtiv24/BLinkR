import dotenv from "dotenv";
if (process.env.NODE_ENV !== "production") {
  dotenv.config();
}

import express from "express"; //default export - can be renamed
import { createServer } from "node:http"; //builtin in node , node-fetch can be a better option
import mongoose from "mongoose";
import cors from "cors";
import { connectToSocket } from "./src/controllers/socketManager.js";
import userRoutes from "./src/routes/user.routes.js";
import resumeRoutes from "./src/routes/resume.routes.js";

const app = express();
const server = createServer(app); //Express app handles HTTP requests,but now server is the actual HTTP server that can listen on a port because  WebSockets (Socket.IO) need the raw HTTP server object
const io = connectToSocket(server); //Socket.IO Server attached to HTTP server // result- one server that can handle both

app.set("port", process.env.PORT || 8000); //act as local storage allows using set get with data , dbs can also be used like these

app.use(cors());
app.use(express.json({ limit: "40kb" })); //json data parse when front to back data sending
app.use(express.urlencoded({ limit: "40kb", extended: true })); //for data parse when front to back datasending

app.use("/api/v1/users", userRoutes);
app.use("/api/v1/resume", resumeRoutes);

app.get("/", (req, res) => {
  return res.send("works");
});

const start = async () => {
  const connectionDB = await mongoose.connect(process.env.ATLAS_DB_URL);
  console.log(`Mongo connect db host :${connectionDB.connection.host}`);

  server.listen(app.get("port"), () => {
    console.log("Server is listening on port 8000");
  });
};

start();
