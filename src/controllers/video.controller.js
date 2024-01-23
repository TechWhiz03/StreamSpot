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

  // console.log(req.files);
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
const getAllVideos = asyncHandler(async (req, res) => {
  // get all videos based on query, sort, pagination
  const {
    page = 1, // page number for pagination.
    limit = 5, // number of items per page.
    // query parameter allows users to search for videos based on a specific term or pattern in the title or description of the videos.
    // query = `/^video/`, default value suggesting a "starting point (^)" for a search query related to video.
    query = "",
    sortBy = "createdAt",
    sortType = 1, // ascending order is represented by 1 and descending -1.
    userId = req.user._id,
  } = req.query;

  // find user in db
  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // applying aggregatiion pipeline to display results in specified category
  const getAllVideosAggregate = await Video.aggregate([
    {
      $match: {
        owner: new mongoose.Types.ObjectId(userId),
        $or: [
          { title: { $regex: query, $options: "i" } },
          { description: { $regex: query, $options: "i" } },
          // '$regex': used for regular expression matching based on query params
          // '$options: "i"' makes the matching case-insensitive.
        ],
      },
    },
    {
      $sort: {
        [sortBy]: parseInt(sortType),
        // square brackets ([sortBy]) are used for (dynamic property access) accessing object properties using variables as property names
        // If sortBy is, for example, "createdAt" and sortType is 1, it dynamically creates an object like { createdAt: 1 }
      },
    },
    {
      $skip: (page - 1) * limit,
      // calculation to determine how many documents to skip based on the current page and the limit of documents per page.
      // if you are on page 2, it skips the first 10 documents (since (2 - 1) * 10 equals 10), showing the next set of 10 documents.
    },
    {
      $limit: parseInt(limit),
      // limits the number of documents retrieved for current page.
    },
  ]);

  // paginating the results of a MongoDB aggregation(getAllVideosAggregate)
  Video.aggregatePaginate(getAllVideosAggregate, { page, limit })
    .then((result) => {
      return res
        .status(200)
        .json(
          new ApiResponse(200, result, "Fetched all videos successfully !!")
        );
    })
    .catch((error) => {
      throw new ApiError(400, "Cannot get videos");
      // console.log(error.message);
    });
});

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
