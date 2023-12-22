import multer from "multer";

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./public/temp");
  },
  filename: function (req, file, cb) {
    const uniqueFilename = Date.now() + "_" + file.originalname; // Date.now() makes each file unique
    cb(null, uniqueFilename);
  },
});

export const upload = multer({
  storage,
});
