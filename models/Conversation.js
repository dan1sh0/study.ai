// models/Conversation.js

import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['system', 'user', 'assistant'],
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
}, { _id: false });

const conversationSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    ref: 'User',
  },
  messages: [messageSchema],
}, { timestamps: true });

const Conversation = mongoose.model('Conversation', conversationSchema);
export default Conversation;
