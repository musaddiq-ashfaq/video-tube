import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { upload_file_on_cloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const registerUser = asyncHandler( async (req,res)=>{
    const {email, password, fullName, username} = req.body;

    if([email, password, fullName, username].some((field)=>field?.trim()==="")){
        throw new ApiError(400,"All fields are required")
    }

    const existedUser = await User.findOne({
        $or:[ {username},{email} ]
    })

    if(existedUser){
        throw new ApiError(409,"User already exist");
    }

    const avatarLocalPath = req.files?.avatar[0]?.path;

    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImageLocalPath = req.files.coverImage[0].path;
    }

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar missing");
    }

    const avatar = await upload_file_on_cloudinary(avatarLocalPath);
    const coverImage = await upload_file_on_cloudinary(coverImageLocalPath);

    if(!avatar){
        throw new ApiError(400, "Avatar missing");
    }

    const user = await User.create({
        fullName,
        avatar:avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })

    const createUser = await User.findById(user._id).select("-password -refreshToken");

    if(!createUser){
        throw new ApiError(500,"Something went wrong while registration of the user")
    }

    return res.status(201).json(new ApiResponse(200,createUser,"User created"));
})

export {registerUser};