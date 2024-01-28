import mongoose, { isValidObjectId } from "mongoose";
import { Playlist } from "../models/playlist.model.js";
import { User } from "../models/user.model.js";
import { Video } from "../models/video.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Create playlist
const createPlaylist = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  if (
    !name ||
    name?.trim() === "" ||
    !description ||
    description?.trim() === ""
  ) {
    throw new ApiError(400, "Name and Description both are required");
  }

  // creating playlist
  const playlist = await Playlist.create({
    name: name.trim(),
    description: description.trim(),
    owner: req.user?._id,
  });

  if (!playlist) {
    throw new ApiError(500, "Something went wrong while creating playlist");
  }

  return res
    .status(201)
    .json(new ApiResponse(201, playlist, "Playlist created successfully!!"));
});

// Get user playlists
const getUserPlaylists = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  if (!isValidObjectId(userId)) {
    throw new ApiError(400, "This user id is not valid");
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // match and find all playlists
  const playlists = await Playlist.aggregate([
    {
      $match: {
        owner: new mongoose.Types.ObjectId(userId),
      },
    },
    {
      $sort: {
        createdAt: -1,
      },
    },
  ]);

  res
    .status(200)
    .json(new ApiResponse(200, playlists, "Playlists fetched  successfully!!"));
});

// Get playlist by id
const getPlaylistById = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  if (!isValidObjectId(playlistId)) {
    throw new ApiError(400, "This playlist id is not valid");
  }

  let playlist = await Playlist.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(playlistId),
      },
    },
    // join playlist videos' details and their owners' details
    {
      $lookup: {
        from: "videos",
        localField: "videos",
        foreignField: "_id",
        as: "videos",
        pipeline: [
          {
            $project: {
              videoFile: 1,
              thumbnail: 1,
              title: 1,
              description: 1,
              duration: 1,
              views: 1,
              owner: 1,
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
                    fullname: 1,
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
    // details of playlist's owner
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
        pipeline: [
          {
            $project: {
              fullname: 1,
              username: 1,
              avatar: 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        owner: {
          $first: "$owner",
        },
      },
    },
  ]);

  if (playlist.length > 0) {
    playlist = playlist[0];
  } else {
    throw new ApiError(404, "Playlist not found");
  }

  res.status(200).json(new ApiResponse(200, playlist, "Playlist fetched"));
});

// Add video to playlist
const addVideoToPlaylist = asyncHandler(async (req, res) => {
  const { videoId, playlistId } = req.params;
  if (!isValidObjectId(playlistId)) {
    throw new ApiError(400, "This playlist id is not valid");
  }

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "This video id is not valid");
  }

  // find playlist in db
  const playlist = await Playlist.findById(playlistId);
  if (!playlist) {
    throw new ApiError(404, "no playlist found!");
  }

  if (playlist.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(
      403,
      "You don not have permission to add video in this playlist!"
    );
  }

  // find video in db
  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "No video found!");
  }

  // if video already exists in playlist
  if (playlist.videos.includes(videoId)) {
    throw new ApiError(400, "Video already exists in this playlist!!");
  }

  // push video to playlist
  //   const addedToPlaylist = await Playlist.findByIdAndUpdate(
  //     playlistId,
  //     {
  //       $push: {
  //         video: videoId,
  //       },
  //     },
  //     {
  //       new: true,
  //     }
  //   );

  //   if (!addedToPlaylist) {
  //     throw new ApiError(
  //       500,
  //       "something went wrong while added video to playlist !!"
  //     );
  //   }

  playlist.videos.push(video._id);
  await playlist.save();

  return res
    .status(201)
    .json(
      new ApiResponse(201, playlist, " Added video in playlist successfully!!")
    );
});

// Update playlist
const updatePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  const { name, description } = req.body;
  if (!isValidObjectId(playlistId)) {
    throw new ApiError(400, "This playlist id is not valid");
  }

  if (
    !name ||
    name?.trim() === "" ||
    !description ||
    description?.trim() === ""
  ) {
    throw new ApiError(400, "Both name and description is required");
  }

  const playlist = await Playlist.findById(playlistId);

  if (playlist.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(
      403,
      "You don't have permission to update this playlist!"
    );
  }

  const updatePlaylist = await Playlist.findByIdAndUpdate(
    playlistId,
    {
      $set: {
        name: name,
        description: description,
      },
    },
    {
      new: true,
    }
  );

  if (!updatePlaylist) {
    throw new ApiError(500, "something went wrong while updating playlist!!");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, updatePlaylist, "Playlist updated successfully!!")
    );
});

// Remove video from playlist
const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
  const { videoId, playlistId } = req.params;
  if (!isValidObjectId(playlistId)) {
    throw new ApiError(400, "This playlist id is not valid");
  }
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "This video id is not valid");
  }

  const playlist = await Playlist.findById(playlistId);

  if (!playlist) {
    throw new ApiError(404, "no playlist found!");
  }

  if (playlist.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(
      403,
      "You don't have permission to remove video in this playlist!"
    );
  }

  // find video in db
  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "no video found!");
  }

  // if video not in playlist
  if (!playlist.videos.includes(videoId)) {
    throw new ApiError(400, "Video does not exists in this playlist!!");
  }

  // remove video in the playlist
  //   const removeVideoToPlaylist = await Playlist.findByIdAndUpdate(
  //     playlistId,
  //     {
  //       $pull: {
  //         video: videoId,
  //       },
  //     },
  //     {
  //       new: true,
  //     }
  //   );

  //   if (!removeVideoToPlaylist) {
  //     throw new ApiError(
  //       500,
  //       "something went wrong while removed video to playlist !!"
  //     );
  //   }

  playlist.videos.pull(video._id);
  await playlist.save();

  return res
    .status(201)
    .json(
      new ApiResponse(200, {}, "Removed video from playlist successfully!!")
    );
});

// Delete playlist
const deletePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  if (!isValidObjectId(playlistId)) {
    throw new ApiError(400, "This playlist id is not valid");
  }

  const playlist = await Playlist.findById(playlistId);
  if (!playlist) {
    throw new ApiError(404, "No playlist found!");
  }

  if (playlist.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(
      403,
      "You don't have permission to delete this playlist!"
    );
  }

  const deletePlaylist = await Playlist.findByIdAndDelete(playlistId);

  if (!deletePlaylist) {
    throw new ApiError(500, "Something went wrong while deleting playlist");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, deletePlaylist, "Playlist deleted successfully!!")
    );
});

export {
  createPlaylist,
  getUserPlaylists,
  getPlaylistById,
  addVideoToPlaylist,
  removeVideoFromPlaylist,
  deletePlaylist,
  updatePlaylist,
};
