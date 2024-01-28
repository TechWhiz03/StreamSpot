import mongoose, { isValidObjectId } from "mongoose";
import { Like } from "../models/like.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Toggle like on video
const toggleVideoLike = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "This video id is not valid");
  }

  // find video alredy liked or not
  const videoLike = await Like.findOne({
    video: videoId,
  });

  let like;
  let unlike;

  if (videoLike) {
    unlike = await Like.deleteOne({
      video: videoId,
    });

    if (!unlike) {
      throw new ApiError(500, "something went wrong while unlike video !!");
    }
  } else {
    like = await Like.create({
      video: videoId,
      likedBy: req.user._id,
    });

    if (!like) {
      throw new ApiError(500, "something went wrong while like video !!");
    }
  }

  return res
    .status(201)
    .json(
      new ApiResponse(
        201,
        {},
        `User ${like ? "like" : "Unlike"} video successfully !!`
      )
    );
});

// Toggle like on comment
const toggleCommentLike = asyncHandler(async (req, res) => {
  const { commentId } = req.params;

  if (!isValidObjectId(commentId)) {
    throw new ApiError(400, "This comment id is not valid");
  }

  // find comment alredy liked or not
  const commentLike = await Like.findOne({
    comment: commentId,
  });

  let like;
  let unlike;

  if (commentLike) {
    unlike = await Like.deleteOne({
      comment: commentId,
    });

    if (!unlike) {
      throw new ApiError(500, "something went wrong while unlike comment !!");
    }
  } else {
    like = await Like.create({
      comment: commentId,
      likedBy: req.user._id,
    });

    if (!like) {
      throw new ApiError(500, "something went wrong while like comment !!");
    }
  }

  return res
    .status(201)
    .json(
      new ApiResponse(
        201,
        {},
        `User ${like ? "like" : "Unlike"} comment successfully !!`
      )
    );
});

// Toggle like on tweet
const toggleTweetLike = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;

  if (!isValidObjectId(tweetId)) {
    throw new ApiError(400, "This tweet id is not valid");
  }

  // find tweet alredy liked or not
  const tweetLike = await Like.findOne({
    tweet: tweetId,
  });

  let like;
  let unlike;

  if (tweetLike) {
    unlike = await Like.deleteOne({
      tweet: tweetId,
    });

    if (!unlike) {
      throw new ApiError(500, "something went wrong while unlike tweet !!");
    }
  } else {
    like = await Like.create({
      tweet: tweetId,
      likedBy: req.user._id,
    });

    if (!like) {
      throw new ApiError(500, "something went wrong while like tweet !!");
    }
  }

  return res
    .status(201)
    .json(
      new ApiResponse(
        201,
        {},
        `User ${like ? "like" : "Unlike"} tweet successfully !!`
      )
    );
});

//Get all liked videos
const getLikedVideos = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  if (!isValidObjectId(userId)) {
    throw new ApiError(400, "This user id is not valid");
  }

  // find user in database
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const videos = await Like.aggregate([
    {
      $match: {
        likedBy: new mongoose.Types.ObjectId(req.user?._id),
        video: {
          $exists: true,
        },
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "video",
        foreignField: "_id",
        as: "likedVideo",
        pipeline: [
          {
            $project: {
              owner: 1,
              title: 1,
              videoFile: 1,
              thumbnail: 1,
              views: 1,
            },
          },
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "videoOwner",
              pipeline: [
                {
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
            $addFields: {
              videoOwner: {
                $first: "$videoOwner",
              },
            },
          },
        ],
      },
    },
  ]);
  // console.log("Liked Video:", likedVideos);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { videos, videosCount: videos.length },
        "Fetched Liked videos successfully !!"
      )
    );
});

export { toggleCommentLike, toggleTweetLike, toggleVideoLike, getLikedVideos };
