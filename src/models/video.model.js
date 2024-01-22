import mongoose, { Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const videoSchema = new Schema(
  {
    videoFile: {
      publicId: {
        type: String, // cloudinary url
        required: true,
      },
      url: {
        type: String,
        required: true,
      },
    },
    thumbnail: {
      publicId: {
        type: String, // cloudinary url
        // required: true,
      },
      url: {
        type: String,
        // required: true,
      },
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    duration: {
      type: Number, // from cloudinary
      required: true,
    },
    views: {
      type: Number,
      default: 0,
    },
    isPublished: {
      type: Boolean,
      default: true,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

videoSchema.plugin(mongooseAggregatePaginate); // enabling pagination capabilities for any aggregation queries performed on the "Video" collection

export const Video = mongoose.model("Video", videoSchema);
