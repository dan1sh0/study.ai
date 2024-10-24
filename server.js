// server.js
// At the top of server.js
import User from './models/User.js';
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
app.post('/upload', upload.single('video'), (req, res) => {
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
    pyProcess.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(output);
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

// Endpoint to handle AI requests
app.post('/ai-process', async (req, res) => {
  try {
    const { transcription, requestType, userQuestion } = req.body;

    // Call the AI processing function
    const response = await processAIRequest(transcription, requestType, userQuestion);

    res.json({ response });
  } catch (error) {
    console.error('Error processing AI request:', error);
    res.status(500).json({ message: 'An error occurred while processing your request.' });
  }
});

// Function to process AI requests
async function processAIRequest(transcription, requestType, userQuestion = '') {
  let messages = [];

  switch (requestType) {
    case 'summary':
      messages.push(
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: `Please provide a concise summary of the following text:\n\n${transcription}` }
      );
      break;
    case 'study_questions':
      messages.push(
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: `Based on the following text, generate a list of study questions for a student:\n\n${transcription}` }
      );
      break;
    case 'key_ideas':
      messages.push(
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: `Extract the most important key ideas from the following text:\n\n${transcription}` }
      );
      break;
    case 'custom_question':
      messages.push(
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: `Based on the following text, answer the user's question:\n\nText:\n${transcription}\n\nQuestion:\n${userQuestion}` }
      );
      break;
    default:
      throw new Error('Invalid request type.');
  }

  try {
    // Use the Chat Completion API
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo', // Or 'gpt-4' if you have access
      messages: messages,
      max_tokens: 500,
      temperature: 0.7,
    });

    // Log the response for debugging
    console.log('OpenAI API response:', response);

    if (response.choices && response.choices.length > 0) {
      return response.choices[0].message.content.trim();
    } else {
      throw new Error('No choices returned from OpenAI API.');
    }
  } catch (error) {
    console.error('Error in OpenAI API call:', error.message);
    throw error; // Re-throw the error to be caught in the outer try-catch
  }
}


// Start the Server
const PORT = process.env.PORT || 5002;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
