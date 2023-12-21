import dotenv from "dotenv";
import connectDB from "./db/dbConnect.js";

dotenv.config({ path: "./env" }); // makes sure env variables are initialized as soon as app is loaded

connectDB()
  .then(() => {
    app.listen(process.env.PORT || 8000, () => {
      console.log(`Server running on port ${process.env.PORT}`);
    });
  })
  .catch((err) => {
    console.log(`MONGODB Connection Error: ${err}`);
  });
