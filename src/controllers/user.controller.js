import validator from "validator";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

// Register User
const registerUser = asyncHandler(async (req, res) => {
  // get user details from frontend
  // validation: check if not empty, email format
  // check if user already exists: thro username,email
  // check for images, check for avatar
  // upload to cloudinary, check upload for avatar
  // create user object: to create entry in db
  // check for user creation: if created return response removing password and refresh token field

  // get user details
  const { username, email, fullName, password } = req.body;
  // console.log(req.body);

  // validation for not empty
  if (
    [username, email, fullName, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  // valdiates email
  if (!validator.isEmail(email)) {
    throw new ApiError(400, "Invalid Email !");
  }

  // check for existing user
  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });
  // console.log(existedUser);

  if (existedUser) {
    throw new ApiError(409, "User with username or email already exists !");
  }

  /* image handling at our server
   const avatarLocalPath = req.files?.avatar[0]?.path;  
   if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required");
   }
  */
  let avatarLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.avatar) &&
    req.files.avatar.length > 0
  ) {
    avatarLocalPath = req.files.avatar[0].path;
  } else {
    throw new ApiError(400, "Avatar file is required");
  }
  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  // upload to cloudinary
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);
  if (!avatar) {
    throw new ApiError(400, "Avatar file is required");
  }

  // create user obj
  const user = await User.create({
    username: username.toLowerCase(), // stores username in lowercase
    email,
    fullName,
    password,
    avatar: avatar.url, // cloudinary url
    // Imp step: if no coverImage url then create empty field
    coverImage: coverImage?.url || "", // cloudinary url
  });

  // check user creation & response
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );
  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering");
  }

  return res
    .status(201)
    .json(new ApiResponse(201, createdUser, "Registration Successful"));
});

export { registerUser };
