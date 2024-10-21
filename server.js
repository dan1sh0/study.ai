// server.js
// At the top of server.js
const { spawn } = require('child_process');
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const dotenv = require('dotenv');
const app = express();
const path = require('path');


app.use(cors());
app.use(express.json());

// Set up storage for uploaded videos
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  },
});
const upload = multer({ storage });


// Video Upload and Transcription Route
app.post('/upload', upload.single('video'), (req, res) => {
  if (req.file) {
    const videoPath = path.resolve(req.file.path);

    // Call the Python script
    const pythonExecutable = path.resolve(__dirname, 'venv/bin/python');
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

// Start the Server
const PORT = process.env.PORT || 5002;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

