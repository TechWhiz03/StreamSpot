import mongoose, { isValidObjectId } from "mongoose";
import { User } from "../models/user.model.js";
import { Subscription } from "../models/subscription.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Toggle Subscription
const toggleSubscription = asyncHandler(async (req, res) => {
  const { channelId } = req.params;

  if (!isValidObjectId(channelId)) {
    throw new ApiError(400, "This channel id is not valid");
  }

  // if its a chhannel so its already a user
  const channel = await User.findById(channelId);

  if (!channel) {
    throw new ApiError(400, "This channel does not Exists");
  }

  let unsubscribe;
  let subscribe;

  const itHasSubscription = await Subscription.findOne({
    subscriber: req.user._id,
    channel: channelId,
  });

  if (itHasSubscription) {
    // unsubscribe
    unsubscribe = await Subscription.findOneAndDelete({
      subscriber: req.user._id,
      channel: channelId,
    });

    if (!unsubscribe) {
      throw new ApiError(
        500,
        "something went wrong while unsubscribe the channel"
      );
    }

    return res
      .status(200)
      .json(
        new ApiResponse(200, unsubscribe, "Channel unsubscribed successfully!!")
      );
  } else {
    // subscribe
    subscribe = await Subscription.create({
      subscriber: req.user._id,
      channel: channelId,
    });

    if (!subscribe) {
      throw new ApiError(
        500,
        "something went wrong while subscribe the channel"
      );
    }

    return res
      .status(200)
      .json(
        new ApiResponse(200, subscribe, "Channel subscribed successfully!!")
      );
  }
});

// Get Subscribers List of a Channel
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
  // id of user(channel) whose subscribers list is to be found
  const { channelId } = req.params;
  if (!isValidObjectId(channelId)) {
    throw new ApiError(400, "This channel id is not valid");
  }

  const subscribersList = await Subscription.aggregate([
    {
      $match: {
        channel: new mongoose.Types.ObjectId(channelId),
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "subscriber",
        foreignField: "_id",
        as: "subscribersList",
        pipeline: [
          {
            $project: {
              username: 1,
              fullName: 1,
              avatar: 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        subscribersList: {
          $first: "$subscribersList",
        },
      },
    },
    {
      $project: {
        subscribersList: 1,
        _id: 0,
      },
    },
    // '$replaceRoot' is used to replace the current document (or root) with a new document.
    // This new document can be either an 'existing field' within the document or a newly created one.
    {
      $replaceRoot: {
        newRoot: "$subscribersList",
      },
    },
  ]);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        subscribersList,
        "All user channel Subscribes fetched Successfull!!"
      )
    );
});

// Get Channels List to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
  // id of user whose subscribed channel list is to be found
  const { subscriberId } = req.params;
  if (!isValidObjectId(subscriberId)) {
    throw new ApiError(400, "This subscriber id is not valid");
  }

  const channels = await Subscription.aggregate([
    {
      $match: {
        subscriber: new mongoose.Types.ObjectId(subscriberId),
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "channel",
        foreignField: "_id",
        as: "channel",
        pipeline: [
          {
            $project: {
              username: 1,
              fullName: 1,
              avatar: 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        channel: {
          $first: "$channel",
        },
      },
    },
    {
      $project: {
        channel: 1,
        _id: 0,
      },
    },
    {
      $replaceRoot: {
        newRoot: "$channel",
      },
    },
  ]);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        channels,
        "All Subscribed channels fetched Successfull!!"
      )
    );
});

export { toggleSubscription, getUserChannelSubscribers, getSubscribedChannels };
