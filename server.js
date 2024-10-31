// server.js
// At the top of server.js
import User from './models/Users.js';
import Transcription from './models/Transcription.js';
import Conversation from './models/Conversation.js';
import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { spawn } from 'child_process';
import mongoose from 'mongoose'; 

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Configure MongoDB connection 
const mongoURI = process.env.MONGODB_URI; // Set this in your .env file
mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ Connected to MongoDB'))
.catch((err) => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1); // Exit process with failure
});


// Configure OpenAI API
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
// Recreate __dirname and __filename
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);



// Set up storage for uploaded videos
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});
const upload = multer({ storage });


// Function to get or create a user
async function getOrCreateUser(userId) {
  let user = await User.findOne({ userId });
  if (!user) {
    user = new User({ userId });
    await user.save();
  }
  return user;
}



// Video Upload and Transcription Route
app.post('/upload', upload.single('video'), async (req, res) => {
  if (req.file) {
    const videoPath = path.resolve(req.file.path);

    // Call the Python script
    const pythonExecutable = path.resolve(__dirname, 'venv/bin/python3');
    const pyProcess = spawn(pythonExecutable, ['process_video.py']);

    // Send the video path to the Python script
    pyProcess.stdin.write(JSON.stringify({ video_path: videoPath }));
    pyProcess.stdin.end();

    let output = '';
    let errorOutput = '';

    // Collect data from stdout
    pyProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    // Collect error messages from stderr
    pyProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    // Handle process exit
    pyProcess.on('close', async (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(output);
          const userId = req.body.userId
          if(!userId){
            return res.status(400).json({ message: 'User ID is required.' });
          }
          // Get or create the user
          await getOrCreateUser(userId);

          // Save the transcription
          const transcription = new Transcription({
            userId,
            videoPath,
            transcription: result.transcription,
          });
          await transcription.save();

          // Initialize conversation history
          const conversation = new Conversation({
            userId,
            messages: [
              { role: 'system', content: 'You are a helpful assistant.' },
              { role: 'user', content: `Here is the transcription of the video:\n\n${result.transcription}` },
            ],
          });
          await conversation.save();

          res.status(200).json({
            message: 'Video processed successfully',
            transcription: result.transcription,
          });
        } catch (err) {
          console.error('Error parsing JSON:', err);
          res.status(500).json({ message: 'Processing failed', error: err.toString() });
        }
      } else {
        console.error('Python script error:', errorOutput);
        res.status(500).json({ message: 'Processing failed', error: errorOutput });
      }
    });
  } else {
    res.status(400).json({ message: 'Video upload failed' });
  }
});

/// Endpoint to handle AI requests
app.post('/ai-process', async (req, res) => {
  try {
    const { userId, userQuestion } = req.body;

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required.' });
    }

    if (!userQuestion) {
      return res.status(400).json({ message: 'User question is required.' });
    }

    // Retrieve the latest transcription for the user
    const transcriptionRecord = await Transcription.findOne({ userId }).sort({ createdAt: -1 });
    if (!transcriptionRecord) {
      return res.status(400).json({ message: 'No transcription found for the user. Please upload a video first.' });
    }
    const transcription = transcriptionRecord.transcription;

    // Retrieve conversation history
    let conversation = await Conversation.findOne({ userId });
    if (!conversation) {
      // Initialize conversation history if not found
      conversation = new Conversation({
        userId,
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: `Here is the transcription of the video:\n\n${transcription}` },
        ],
      });
      await conversation.save();
    }

    // Add the user's question to the conversation
    conversation.messages.push({ role: 'user', content: userQuestion });
    await conversation.save();

    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo', // Or 'gpt-4' if you have access
      messages: conversation.messages,
      max_tokens: 500,
      temperature: 0.7,
    });

    console.log('OpenAI API response:', response);

    if (response.choices && response.choices.length > 0) {
      const assistantMessage = response.choices[0].message.content.trim();
      // Add the assistant's response to the conversation
      conversation.messages.push({ role: 'assistant', content: assistantMessage });
      await conversation.save();

      res.json({ response: assistantMessage });
    } else {
      throw new Error('No choices returned from OpenAI API.');
    }
  } catch (error) {
    console.error('Error processing AI request:', error.message);

    if (error.message.includes('No transcription found')) {
      res.status(400).json({ message: error.message });
    } else if (error.code === 'insufficient_quota') {
      res.status(429).json({ message: 'You have exceeded your API quota. Please check your OpenAI billing details.' });
    } else {
      res.status(500).json({ message: 'An error occurred while processing your request.' });
    }
  }
});

// Start the Server
const PORT = process.env.PORT || 5002;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
