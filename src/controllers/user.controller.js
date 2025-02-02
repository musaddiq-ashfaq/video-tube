import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { upload_file_on_cloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from 'jsonwebtoken';

const generateAccessAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });

        return { accessToken, refreshToken };
  } catch (error) {
        throw new ApiError(500, "Unable to create tokens");
  }
};

const registerUser = asyncHandler(async (req, res) => {
  const { email, password, fullName, username } = req.body;

  if (
    [email, password, fullName, username].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    throw new ApiError(409, "User already exist");
  }

  const avatarLocalPath = req.files?.avatar[0]?.path;

  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar missing");
  }

  const avatar = await upload_file_on_cloudinary(avatarLocalPath);
  const coverImage = await upload_file_on_cloudinary(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(400, "Avatar missing");
  }

  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase(),
  });

  const createUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createUser) {
    throw new ApiError(
      500,
      "Something went wrong while registration of the user"
    );
  }

  return res.status(201).json(new ApiResponse(200, createUser, "User created"));
});

const loginUser = asyncHandler(async (req, res) => {
  const { email, username, password } = req.body;

  if (!(email || username)) {
    throw new ApiError(404, "Email or username is required");
  }

  const user = await User.findOne({ $or: [{ username }, { email }] });
  if (!user) {
    throw new ApiError(404, "User does not exist");
  }


  const isValidPassword = await user.isPasswordCorrect(password);
  if (!isValidPassword) {
    throw new ApiError(401, "Password is incorrect. Try Again");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id);

  const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "user logged in successfully"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id,
    {
      $set: { refreshToken: undefined },
    },
    {
      new: true,
    }
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  res.status(200).clearCookie("accessToken",options).clearCookie("refreshToken",options).json(
    new ApiResponse(200,{},"user logged out")
  )
});


const refreshAccessToken = asyncHandler(async (req,res)=>{
  const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

  if(!incomingRefreshToken){
    throw new ApiError(401,"Unauthorized request");
  }

  try {
    const decodedToken = jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET);
    
    const user = await User.findById(decodedToken?._id);
    if (!user) {
      throw new ApiError(401, "Invalid refresh token")
    }

    if(decodedToken !== user.refreshToken){
      throw new ApiError(401,"Invalid refresh token");
    }

    const options={
      httpOnly:true,
      secure:true
    }

    const {accessToken, newrefreshToken} = generateAccessAndRefreshToken(user._id);
    res.status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(
      200, {accessToken,refreshToken:newrefreshToken},
      "Acccess token got refreshed"
    )


  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh token");
  }
});

const changePassword = asyncHandler(async (req,res)=>{
  const {oldPassword, newPassword} = req.body;
  const user = await User.findById(req.user?._id);
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
  if(!isPasswordCorrect){
    throw new ApiError(400,"Wrong old password");
  }
  user.password = newPassword;
  await user.save({validateBeforeSave:false});
  
  return res.status(200).json(new ApiResponse(200,{},"Password changed successfully"))
})

const getCurrentUser = asyncHandler(async(req,res)=>{
  const user = req.user;
  return res.status(200).json(200,{user},"User fetched");
})

const updateAccountDetails = asyncHandler(async(req,res)=>{
  const {fullName, email} = req.body;
  if(!email || !fullName){
    throw ApiError(400, "Enter all fields");
  }

  const user = await User.findByIdAndDelete(req.user._id, {
    $set:{
      fullName,
      email:email
    }
  },
  { new:true }).select("-password");
  return res.status(200).json(new ApiResponse(200,{user},"Updated details"));
})

const updateAvatar = asyncHandler(async (req,res)=>{
  const localNewAvatarPath = req.file?.path; 
  if(!localNewAvatarPath){
    throw ApiError(400,"Unable to find avatar image");
  }

  const avatar = await upload_file_on_cloudinary(localNewAvatarPath);
  if(!avatar.url){
    throw new ApiError(400, "Error while uploading on avatar")
  }

  const user = await User.findByIdAndUpdate(req.user?._id,
    {
      $set:{
        avatar:avatar.url
      }
    },
    {new:true}
  ).select("-password");

  return res.status(200).json(new ApiResponse(200,user,"Avatar Updated"))
});

const updateCoverImage = asyncHandler(async(req,res)=>{
  const localNewImage = req.file?.path;
  if(!localNewImage){
    throw new ApiError(400,"Unable to find cover image");
  }

  const coverImage = await upload_file_on_cloudinary(localNewImage);
  if(!coverImage.url){
    throw new ApiError(400,"Unable to upload cover image on cloudinary");
  }

  const user = await User.findByIdAndUpdate(req.user?._id,
    {
      $set:{
        coverImage:coverImage.url
      }
    },
    {
      new:true
    }
  ).select("-password");

  return res.status(200).json(new ApiResponse(200,user,"Cover image updated"))
})

export { registerUser, loginUser, logoutUser, refreshAccessToken, 
  changePassword, getCurrentUser, updateAccountDetails, updateAvatar, updateCoverImage};