// models/User.js

import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
  },
  // Add additional user fields as needed (e.g., name, email)
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
export default User;
