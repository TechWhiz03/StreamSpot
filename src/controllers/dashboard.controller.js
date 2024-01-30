import mongoose from "mongoose";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Get the channel stats like total video views, total subscribers, total videos, total likes etc.
const getChannelStats = asyncHandler(async (req, res) => {
  const data = await Video.aggregate([
    {
      $match: {
        owner: new mongoose.Types.ObjectId(req.user?._id),
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
        VideoLikes: {
          $size: "$likes",
        },
      },
    },
    // In "$group" stage, the "_id" field specifies the criteria for grouping documents.
    // When _id is set to null, it means all documents will be grouped together as a single group.
    // allowing you to perform aggregate operations on the entire collection without considering individual field values for grouping.
    {
      $group: {
        _id: null,
        totalViews: {
          $sum: "$views",
        },
        totalVideos: {
          // "$sum: 1" calculates the total count of documents that satisfy the grouping condition
          $sum: 1,
        },
        totaLikes: {
          $sum: "$likes",
        },
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "owner",
        foreignField: "channel",
        as: "totalSubscribers",
      },
    },
    {
      $addFields: {
        totalSubscribers: {
          $size: "$totalSubscribers",
        },
      },
    },
    {
      $project: {
        _id: 0,
      },
    },
  ]);

  res.status(200).json(new ApiResponse(200, data, "Get channel stats success"));
});

// Get all the videos uploaded by the channel
const getChannelVideos = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 5,
    sortBy = "createdAt",
    sortType = 1,
    channelId = req.user?._id,
  } = req.query;

  // find channel in db
  const channel = await User.findById(channelId);

  if (!channel) {
    throw new ApiError(404, "Channel not found");
  }

  // applying aggregatiion pipeline to display results in specified category
  const getAllChannelVideosAggregate = await Video.aggregate([
    {
      $match: {
        owner: new mongoose.Types.ObjectId(channelId),
      },
    },
    {
      $sort: {
        [sortBy]: parseInt(sortType),
      },
    },
    {
      $skip: (page - 1) * limit,
    },
    {
      $limit: parseInt(limit),
    },
  ]);

  // paginating the results of a MongoDB aggregation(getAllChannelVideosAggregate)
  Video.aggregatePaginate(getAllChannelVideosAggregate, { page, limit })
    .then((result) => {
      return res
        .status(200)
        .json(
          new ApiResponse(
            200,
            result,
            "Fetched all channel videos successfully !!"
          )
        );
    })
    .catch((error) => {
      throw new ApiError(400, "Cannot get videos");
      // console.log(error.message);
    });
});

export { getChannelStats, getChannelVideos };
