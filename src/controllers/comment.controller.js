import mongoose, { isValidObjectId } from "mongoose";
import { Comment } from "../models/comment.model.js";
import { Video } from "../models/video.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Add a comment to a video
const addComment = asyncHandler(async (req, res) => {
  const { comment } = req.body;
  const { videoId } = req.params;

  //   console.log("req body ", req.body);
  //   console.log("comment", comment);

  if (!comment || comment?.trim() === "") {
    throw new ApiError(400, "comment is required");
  }

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "This video id is not valid");
  }

  const videoComment = await Comment.create({
    comment: comment,
    video: videoId,
    owner: req.user._id,
  });

  if (!videoComment) {
    throw new ApiError(
      500,
      "Something went wrong while creating video comment"
    );
  }

  return res
    .status(201)
    .json(
      new ApiResponse(201, videoComment, "Video comment created successfully!!")
    );
});

// Get all comments for a video
const getVideoComments = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { page = 1, limit = 5 } = req.query;

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "This video id is not valid");
  }

  // find video in database
  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "video not found");
  }

  // match and finds all the comments for videoId
  const aggregateComments = await Comment.aggregate([
    {
      $match: {
        video: new mongoose.Types.ObjectId(videoId),
      },
    },
  ]);

  Comment.aggregatePaginate(aggregateComments, {
    page,
    limit,
  })
    .then((result) => {
      return res
        .status(200)
        .json(
          new ApiResponse(200, result, "Video Comments fetched  successfully!!")
        );
    })
    .catch((error) => {
      throw new ApiError(
        500,
        "Something went wrong while fetching video Comments",
        error
      );
    });
});

// Update a comment
const updateComment = asyncHandler(async (req, res) => {
  const { newComment } = req.body;
  const { commentId } = req.params;

  if (!newComment || newComment?.trim() === "") {
    throw new ApiError(400, "comment is required");
  }

  if (!isValidObjectId(commentId)) {
    throw new ApiError(400, "This video id is not valid");
  }

  const comment = await Comment.findById(commentId);

  if (!comment) {
    throw new ApiError(404, "comment not found!");
  }

  if (comment.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(
      403,
      "You don't have permission to update this comment!"
    );
  }

  const updateComment = await Comment.findByIdAndUpdate(
    commentId,
    {
      $set: {
        comment: newComment,
      },
    },
    {
      new: true,
    }
  );

  if (!updateComment) {
    throw new ApiError(500, "something went wrong while updating comment");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, updateComment, "comment updated successfully!!")
    );
});

// Delete a comment
const deleteComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;

  if (!isValidObjectId(commentId)) {
    throw new ApiError(400, "This video id is not valid");
  }

  const comment = await Comment.findById(commentId);

  if (!comment) {
    throw new ApiError(404, "comment not found!");
  }

  if (comment.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(
      403,
      "You don't have permission to delete this comment!"
    );
  }

  const deleteComment = await Comment.findByIdAndDelete(commentId);

  if (!deleteComment) {
    throw new ApiError(500, "something went wrong while deleting comment");
  }

  return res
    .status(201)
    .json(
      new ApiResponse(200, deleteComment, "Comment deleted successfully!!")
    );
});

export { getVideoComments, addComment, updateComment, deleteComment };
