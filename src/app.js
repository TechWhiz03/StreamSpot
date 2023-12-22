import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

// security feature controlling how server responds to requests from different origins (diff websites)
app.use(
  cors({
    origin: process.env.CORS_ORIGIN, // holds allowed origins to access server resources
    credentials: true, // allows requests to include credentials(like cookies, authentication tokens etc)
  })
);

app.use(
  express.json({
    limit: "16kb", // parses incoming requests with JSON & sets limit
  })
);

app.use(
  express.urlencoded({
    // parses incoming requests with URL encoded payload
    extended: true, // allows parsing of nested objects within URL encoded data
    limit: "16kb",
  })
);

app.use(express.static("public")); // serves static files(HTML, CSS, imgs, videos, etc) located in 'public' folder.
app.use(cookieParser()); // parses cookies from incoming req

// routes import
import userRouter from "./routes/user.routes.js";

// routes declaration
app.use("/api/v1/users", userRouter);

export { app };
