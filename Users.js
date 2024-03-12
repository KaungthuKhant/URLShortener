//const mongoose = require("mongoose")
import mongoose from 'mongoose';


const linkSchema = new mongoose.Schema({
    longLink: String,
    shortLink: String,
    count: Number
})


/**
 * email: {
        type: String,
        required: true,
        lowercase: true,
    },
 */

const userSchema = new mongoose.Schema({
    schemaType: { type: String, require: true},

    name: String,
    email: String,
    password: String,
    isConfirmed: { type: Boolean, default: false },
    resetToken: String,
    resetTokenExpires: Date,

    fullUrl: String,
    shortUrl: String,
    clicks: Number
})


// export the Mongoose model named "User" based on the userSchema that you've defined.
export default mongoose.model("User", userSchema)