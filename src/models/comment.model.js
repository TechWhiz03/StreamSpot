import mongoose, { Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const commentSchema = new Schema(
  {
    comment: {
      type: String,
      required: true,
    },
    video: {
      type: Schema.Types.OjectId,
      ref: "Video",
    },
    owner: {
      type: Schema.Types.OjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

commentSchema.plugin(mongooseAggregatePaginate); // enabling pagination capabilities for any aggregation queries

export const Comment = mongoose.model("Comment", commentSchema);
