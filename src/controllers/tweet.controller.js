import { isValidObjectId } from "mongoose";
import { Tweet } from "../models/tweet.model.js";
import { User } from "../models/user.model.js";
import { Like } from "../models/like.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Create Tweet
const createTweet = asyncHandler(async (req, res) => {
  const { content } = req.body;

  if (!content || content?.trim() === "") {
    throw new ApiError(400, "Content is required");
  }

  // creating tweet
  const tweet = await Tweet.create({
    content,
    owner: req.user._id,
  });

  if (!tweet) {
    throw new ApiError(500, "Something went wrong while creating tweet");
  }

  return res
    .status(201)
    .json(new ApiResponse(201, tweet, "Tweet created successfully!!"));
});

// Get User Tweets
const getUserTweets = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  if (!isValidObjectId(userId)) {
    throw new ApiError(400, "This user id is not valid");
  }

  // find user in database
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // match and find all tweets
  const tweets = await Tweet.aggregate([
    {
      $match: {
        owner: user._id,
      },
    },
  ]);

  if (!tweets) {
    throw new ApiError(500, "Something went wrong while fetching tweets");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, tweets, "Tweets fetched  successfully!!"));
});

// Update Tweet
const updateTweet = asyncHandler(async (req, res) => {
  const { newContent } = req.body;
  const { tweetId } = req.params;

  if (!newContent || newContent?.trim() === "") {
    throw new ApiError(400, "Content is required");
  }

  if (!isValidObjectId(tweetId)) {
    throw new ApiError(400, "This tweet id is not valid");
  }

  const tweet = await Tweet.findById(tweetId);

  if (!tweet) {
    throw new ApiError(404, "Tweet not found!");
  }

  if (tweet.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You don't have permission to update this tweet!");
  }

  const updateTweet = await Tweet.findByIdAndUpdate(
    tweetId,
    {
      $set: {
        content: newContent,
      },
    },
    {
      new: true,
    }
  );

  if (!updateTweet) {
    throw new ApiError(500, "Something went wrong while updating tweet");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, updateTweet, "Tweet updated successfully!!"));
});

// Delete Tweet
const deleteTweet = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;

  if (!isValidObjectId(tweetId)) {
    throw new ApiError(400, "This tweet id is not valid");
  }

  const tweet = await Tweet.findById(tweetId);

  if (!tweet) {
    throw new ApiError(404, "No tweet found!");
  }

  if (tweet.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You don't have permission to delete this tweet!");
  }

  const deleteTweet = await Tweet.findByIdAndDelete(tweetId);
  if (deleteTweet) {
    // delete tweet instance from like collection
    await Like.deleteMany({ tweet: tweetId });
  }

  // console.log("Delete successfully", deleteTweet)

  if (!deleteTweet) {
    throw new ApiError(500, "Something went wrong while deleting tweet");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, deleteTweet, "Tweet deleted successfully!!"));
});

export { createTweet, getUserTweets, updateTweet, deleteTweet };
