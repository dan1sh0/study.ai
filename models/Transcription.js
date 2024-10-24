// models/Transcription.js

import mongoose from 'mongoose';

const transcriptionSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    ref: 'User',
  },
  videoPath: {
    type: String,
    required: true,
  },
  transcription: {
    type: String,
    required: true,
  },
}, { timestamps: true });

const Transcription = mongoose.model('Transcription', transcriptionSchema);
export default Transcription;
