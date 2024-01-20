import validator from "validator";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary, deleteOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

// Method to generate Access & Refresh tokens
const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = await user.generateAccessToken();
    const refreshToken = await user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false }); // 'validateBeforeSave:false'  skips validation on the data before saving

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(500, "Error generating access and refresh tokens");
  }
};

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
    avatar: { publicId: avatar?.public_id, url: avatar?.url }, // cloudinary url
    coverImage: { publicId: coverImage?.public_id, url: coverImage?.url },
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

// Login User
const loginUser = asyncHandler(async (req, res) => {
  // get data from req.body
  // check for username or email in req
  // find user
  // check for password
  // generate access and refresh token
  // send tokens thro cookies

  // data
  const { username, email, password } = req.body;

  //check username and email
  if (!(username || email)) {
    throw new ApiError(400, "username or email is required");
  }

  // find user thro username or email
  const user = await User.findOne({
    $or: [{ username }, { email }],
  });
  if (!user) {
    throw new ApiError(404, "User does not exist");
  }

  // check password
  const isPasswordValid = await user.isPasswordCorrect(password);
  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid user credentials");
  }

  // generate access and refresh token
  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id
  );

  // either update 'user' instance or again make a call to DB since the older instance doesn't contain refresh token
  const loggedInUser = await User.findOne(user._id).select(
    "-password -refreshToken"
  );

  // adding cookies
  // {httpOnly: true, secure: true,} allows only server & not frontend to modify cookies
  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken, // access and refresh token sent again seperately if the user wants to store them locally
          refreshToken,
        },
        "User logged in successfully"
      )
    );
});

// Logout User
const logoutUser = asyncHandler(async (req, res) => {
  // remove refresh token from DB
  await User.findByIdAndUpdate(
    req.user._id,
    {
      // removes the field from document
      $unset: {
        refreshToken: 1, // or only refreshToken
      },
      // $set: {
      //   refreshToken: "", // or refreshToken: null
      // },
    },
    {
      new: true, // returns updated info
    }
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  // remove cookies
  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User Logged Out"));
});

// Refreshing Access Token
const refreshAccessToken = asyncHandler(async (req, res) => {
  // get refreshToken from cookies or req.body
  // verify incoming refreshToken to decode
  // get user instance
  // again verify incoming refreshToken with the refreshToken saved in DB
  // generate new access & refresh tokens
  // send tokens to user thro cookies or response

  // get refreshToken
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized request");
  }

  try {
    // decode
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    // get user
    const user = await User.findById(decodedToken?._id);

    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }

    // verify with user's token
    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh token is expired or invalid");
    }

    // generate new tokens
    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
      user._id
    );

    const options = {
      httpOnly: true,
      secure: true,
    };

    // send thro cookies
    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(
        new ApiResponse(
          200,
          {
            accessToken,
            refreshToken,
          },
          "Access token refreshed"
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh token");
  }
});

// Change Password
const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  const user = await User.findById(req.user?._id);
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

  if (!isPasswordCorrect) {
    throw new ApiError(400, "Invalid old password");
  }

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password updated successfully"));
});

// Get Current User
const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "Current User fetched successfully"));
});

// Update Account Details
const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullName, email } = req.body; // fields user can update

  if (!(fullName && email)) {
    throw new ApiError(400, "All fields are required");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullName,
        email,
      },
    },
    {
      new: true,
    }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"));
});

// Update Avatar
const updateAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path;

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file missing");
  }

  // Get user's avatar information before updation
  const currentUser = await User.findById(req.user?._id).select(
    "-password -refreshToken"
  );
  const previousAvatarId = currentUser.avatar.publicId;

  const avatar = await uploadOnCloudinary(avatarLocalPath);

  if (!avatar.url) {
    throw new ApiError(400, "Error while uploading avatar on cloudinary");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: { publicId: avatar?.public_id, url: avatar?.url },
      },
    },
    { new: true }
  ).select("-password");

  // Delete previous avatar on Cloudinary if it exists
  if (previousAvatarId) {
    await deleteOnCloudinary(previousAvatarId);
  }

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar updated successfully"));
});

// Update Cover Image
const updateCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.file?.path;

  if (!coverImageLocalPath) {
    throw new ApiError(400, "Cover Image file missing");
  }

  // Get user's cover image information before updation
  const currentUser = await User.findById(req.user?._id).select(
    "-password -refreshToken"
  );
  const previouscoverImageId = currentUser.coverImage.publicId;

  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!coverImage.url) {
    throw new ApiError(400, "Error while uploading cover image on cloudinary");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: { publicId: coverImage?.public_id, url: coverImage?.url },
      },
    },
    { new: true }
  ).select("-password");

  // Delete previous avatar on Cloudinary if it exists
  if (previouscoverImageId) {
    await deleteOnCloudinary(previouscoverImageId);
  }

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Cover Image updated successfully"));
});

// Get Channel Profile
const getChannelProfile = asyncHandler(async (req, res) => {
  // extract username of channel's owner from url
  const { username } = req.params;

  if (!username?.trim()) {
    throw new ApiError(400, "Username not found");
  }

  // Perform Aggregation Pipelines/Operations
  const channel = await User.aggregate([
    {
      // filters doc based on the matching criteria (here username)
      $match: {
        username: username?.toLowerCase(), // or only username
      },
    },
    {
      //lookup performs Left Join between docs of two collections (here subscriptions and users)

      // this lookup finds no of "subscribers" of a particular channel since, foreignField: "channel"
      $lookup: {
        from: "subscriptions", // specify foriegn collection you want to join with "users"(current) collection
        localField: "_id", // specify field from current collection to match with foriegn collection's field
        foreignField: "channel", // specify field from foriegn collection to match with localField
        as: "subscribers", // specify name of the output "array" field
      },
    },
    {
      // this lookup finds no of "channels subscribed to" since, foreignField: "subscriber"
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo",
      },
    },
    {
      // adds additional fields (here subcribersCount, channelsSubscribedToCount & isSubscribed) into user document
      $addFields: {
        // field name
        subcribersCount: {
          // $size: returns the size of an array, i.e number of elements in an array field(array field here is subscribers) within a document(doc here is users)
          // since subscribers is a field hence the "$" sign
          $size: "$subscribers",
        },
        channelsSubscribedToCount: {
          $size: "$subscribedTo",
        },
        isSubscribed: {
          // $cond: implements conditional logic, similar to an "if-else" statement.
          $cond: {
            if: {
              $in: [req.user?._id, "$subscribers.subscriber"], // checks if a specified value exists in an object/array (here subscribers object).
            },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      // Controls which fields are present & how they appear in the final result.
      // Reshapes documents by including, excluding, or adding fields, projecting the data in a different structure.
      $project: {
        subcribersCount: 1,
        channelsSubscribedToCount: 1,
        isSubscribed: 1,
        fullName: 1,
        username: 1,
        email: 1,
        avatar: 1,
        coverImage: 1,
      },
    },
  ]);

  if (!channel?.length) {
    throw new ApiError(404, "Channel not found");
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      channel[0], // sending only the 1st element (viz an object) of the array channel
      "Channel fetched successfully"
    )
  );
});

// Get Watch History
const getWatchHistory = asyncHandler(async (req, res) => {
  // Perform Aggregation + Sub Aggregation Pipelines/Operations to get the watch history
  const user = await User.aggregate([
    {
      // get user document
      $match: {
        // explicitly converts ID string (here req.user._id) to a MongoDB ObjectId (viz in BSON format)
        _id: new mongoose.Types.ObjectId(req.user._id),
      },
    },
    {
      // join videos collection to users(current) collection
      $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        // sub pipeline to include owner's info in watchHistory
        pipeline: [
          {
            // join users collection to videos(current) collection
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              // sub pipeline to project only specified owner info
              pipeline: [
                {
                  // trims down the output to retain only selected fields from the "users" collection
                  $project: {
                    fullName: 1,
                    username: 1,
                    avatar: 1,
                  },
                },
              ],
            },
          },
          {
            // overwrites the owner field with the first object in the owner array
            // this simplifies to retreive data on the frontend.
            $addFields: {
              owner: {
                $first: "$owner",
              },
            },
          },
        ],
      },
    },
  ]);

  return res.status(200).json(
    new ApiResponse(
      200,
      user[0].watchHistory, // get first object of user array and give only watchHistory as response
      "Watch History fetched successfully"
    )
  );
});

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateAvatar,
  updateCoverImage,
  getChannelProfile,
  getWatchHistory,
};
