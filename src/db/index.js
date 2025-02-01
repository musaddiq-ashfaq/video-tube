import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

const connect_db = async () => {
    try {
        const connection_instance = await mongoose.connect(`${process.env.MONGO_URI}/${DB_NAME}`);
        console.log(`\n MONGODB connected DB HOST: ${connection_instance.connection.host}`);
    } catch (error) {
        console.log("MONGO DB CONNECTION ERROR:", error);
        process.exit(1);
    }
}

export default connect_db;