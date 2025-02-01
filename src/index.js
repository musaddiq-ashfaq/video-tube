// require('dotenv').config({path:'./env'}); other and easier way to import if type:module not used
// import mongoose from "mongoose";
// import { DB_NAME } from "./constants";

import dotenv from 'dotenv';
import connect_db from "./db/index.js";
import app from './app.js'

dotenv.config({path:'./env'});

connect_db()
.then(()=>{
    app.listen(process.env.PORT || 8000, ()=>{
        console.log(`Server listening at port:${process.env.PORT}`)
    })
})
.catch((error)=>{
    console.log("Error on db connection: ",error);
})


// import express from "express";
// const app = express();

// ;(async ()=>{
//     try {
//         await mongoose.connect(`${process.env.DB_URI}/${DB_NAME}`);
//         app.on("error",(error)=>{
//             console.log("Error:",error);
//             throw error;
//         })
//         app.listen(process.env.PORT,()=>{
//             console.log(`App is listening on port ${process.env.PORT}`);
//         })
//     } catch (error) {
//         console.error("Error: ",error);
//         throw error;
//     }
// })()