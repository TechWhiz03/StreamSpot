import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { uploadOnCloudinary, deleteOnCloudinary } from "../utils/cloudinary.js";

//Publish Video
const publishAVideo = asyncHandler(async (req, res) => {
  // get video, upload to cloudinary, create video
  const { title, description, isPublished = "true" } = req.body;

  if ([title, description].some((field) => field?.trim() === "")) {
    throw new ApiError(400, "Title & Description required");
  }

  console.log(req.files);
  // video file and thumbnail handling
  const videoFileLocalPath = req.files?.videoFile?.[0].path;
  const thumbnailFileLocalPath = req.files?.thumbnail?.[0].path;

  if (!videoFileLocalPath) {
    throw new ApiError(400, "Video file is missing");
  }

  // upload on cloudinary
  const videoFile = await uploadOnCloudinary(videoFileLocalPath);
  const thumbnail = await uploadOnCloudinary(thumbnailFileLocalPath);
  if (!videoFile) {
    throw new ApiError(400, "Error uploading on Cloudinary");
  }

  // create video obj
  const video = await Video.create({
    videoFile: {
      publicId: videoFile?.public_id,
      url: videoFile?.url,
    },
    thumbnail: {
      publicId: thumbnail?.public_id,
      url: thumbnail?.url,
    },
    title,
    description,
    isPublished,
    duration: videoFile?.duration,
    owner: req.user._id,
  });

  if (!video) {
    throw new ApiError(
      500,
      "Something went wrong while storing the video in database"
    );
  }

  return res
    .status(201)
    .json(new ApiResponse(201, video, "Video Uploaded Successfully!!"));
});

//Get All Videos
const getAllVideos = asyncHandler(async (req, res) => {});

//Get Video By Id
const getVideoById = asyncHandler(async (req, res) => {});

//Update Video
const updateVideo = asyncHandler(async (req, res) => {});

//Delete Video
const deleteVideo = asyncHandler(async (req, res) => {});

//Toggle Publish Status
const togglePublishStatus = asyncHandler(async (req, res) => {});

export {
  publishAVideo,
  getAllVideos,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
};
