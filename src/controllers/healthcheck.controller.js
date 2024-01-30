import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Healthcheck response that simply returns the OK status as json with a message
const healthcheck = asyncHandler(async (req, res) => {
  const healthCheck = {
    uptime: process.uptime(),
    message: "ok",
    responsetime: process.hrtime(),
    timestamp: Date.now(),
  };
  try {
    return res
      .status(200)
      .json(new ApiResponse(200, healthCheck, "health is good"));
  } catch (error) {
    console.error("Error in health check", error);
    healthCheck.message = error;
    throw new ApiError(503, " getting Error in health check time");
  }
});

export { healthcheck };

/*
 "process.uptime()": returns the number of seconds the Node.js process has been running,
  giving an idea of how long the server has been up since it was last started or restarted.

 "process.hrtime()": returns the high-resolution real time, gives precise timing info about when the health check response was generated.
*/
