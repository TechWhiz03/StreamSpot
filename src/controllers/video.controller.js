import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { Like } from "../models/like.model.js";
import { Comment } from "../models/comment.model.js";
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
const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "This video id is not valid");
  }

  // const video = await Video.findById(videoId);

  let video = await Video.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(videoId),
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
        pipeline: [
          {
            $project: {
              username: 1,
              fullname: 1,
              avatar: 1,
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "video",
        as: "likes",
      },
    },
    {
      $addFields: {
        owner: {
          $first: "$owner",
        },
        likes: {
          $size: "$likes",
        },
        views: {
          $add: [1, "$views"],
        },
      },
    },
  ]);

  // console.log("video:", video);

  if (video.length > 0) {
    video = video[0];
  }

  await Video.findByIdAndUpdate(videoId, {
    $set: {
      views: video.views,
    },
  });

  if (!video || video.length === 0) {
    throw new ApiError(404, "Video not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, video, "Video fetched successfully!!"));
});

//Update Video Details
const updateVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { title, description } = req.body;
  const thumbnailLocalPath = req.file?.path;

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "This video id is not valid");
  }

  if (!(title && description)) {
    throw new ApiError(400, "Title & Description fields are required");
  }

  let updateFields = {
    $set: {
      title,
      description,
    },
  };

  // to update thumbnail
  const video = await Video.findById(videoId);

  // if thumbnail provided delete the previous one and upload new
  let thumbnail;
  if (thumbnailLocalPath) {
    await deleteOnCloudinary(video.thumbnail?.public_id);

    // upload new one
    thumbnail = await uploadOnCloudinary(thumbnailLocalPath);

    if (!thumbnail) {
      throw new ApiError(
        500,
        "Something went wrong while updating thumbnail on cloudinary !!"
      );
    }

    // thumbnail fields are merged to the existing $set object using the spread operator (...)
    updateFields.$set = {
      ...updateFields.$set,
      thumbnail: {
        publicId: thumbnail.public_id,
        url: thumbnail.url,
      },
    };
  }

  let updateVideoDetails;
  if (req.user._id.toString() === video.owner.toString()) {
    updateVideoDetails = await Video.findByIdAndUpdate(videoId, updateFields, {
      new: true,
    });
  } else {
    throw new ApiError(400, "Allowed to update only your video ");
  }

  if (!updateVideoDetails) {
    throw new ApiError(
      500,
      "Something went wrong while updating video details"
    );
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        updateVideoDetails,
        "Video details updated successfully!"
      )
    );
});

//Delete Video
const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "This video id is not valid");
  }

  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  if (video.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You are not allowed to delete this video!");
  }

  const { _id, videoFile, thumbnail } = video;

  // find comments associated with videoId
  const comments = await Comment.find({ video: _id });

  // extracts an array of comment ids from the fetched comments.
  const commentIds = comments.map((comment) => comment._id);

  const delResponse = await Video.findByIdAndDelete(_id);
  if (delResponse) {
    // Promise.all() handle multiple asynchronous operations concurrently and
    // ensures that either all deletion operations succeed or none of them do.
    await Promise.all([
      // delete the instances of video from like collections
      Like.deleteMany({ video: _id }),

      // deletes all comment likes where the comment field matches any of the comment ids in the commentIds array
      Like.deleteMany({ comment: { $in: commentIds } }),

      // delete the instances of video from comment collections
      Comment.deleteMany({ video: _id }),

      // delete video and thumbnail in cloudinary
      deleteOnCloudinary(videoFile.publicId),
      deleteOnCloudinary(thumbnail.publicId),
    ]);
  } else {
    throw new ApiError(500, "Something went wrong while deleting video");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Video deleted successfully!!"));
});

//Toggle Publish Status
const togglePublishStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "This video id is not valid");
  }

  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError(404, "video not found");
  }

  if (video.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You don't have permission to toggle this video!");
  }

  // toggle video status
  video.isPublished = !video.isPublished;

  await video.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, video, "Video toggle successfull!!"));
});

export {
  publishAVideo,
  getAllVideos,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
};
