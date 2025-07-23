// server.js

const express = require('express');
const fs = require('fs');
const axios = require('axios');
const { exec } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Helper to download a file
async function downloadFile(url, filepath) {
  const writer = fs.createWriteStream(filepath);
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream'
  });
  response.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

app.post('/mix', async (req, res) => {
  const { avatar_video_url, background_music_url } = req.body;

  if (!avatar_video_url || !background_music_url) {
    return res.status(400).json({ error: 'Missing avatar_video_url or background_music_url' });
  }

  try {
    const videoId = uuidv4();
    const videoPath = `/tmp/${videoId}_avatar.mp4`;
    const musicPath = `/tmp/${videoId}_music.mp3`;
    const outputPath = `/tmp/${videoId}_final.mp4`;

    await downloadFile(avatar_video_url, videoPath);
    await downloadFile(background_music_url, musicPath);

    const ffmpegCommand = `
      ffmpeg -y -i "${videoPath}" -i "${musicPath}" -filter_complex "[1:a]volume=0.25[a1];[0:a][a1]amix=inputs=2:duration=first[aout]" -map 0:v -map "[aout]" -c:v copy -shortest "${outputPath}"
    `;

    exec(ffmpegCommand, (error, stdout, stderr) => {
      if (error) {
        console.error('FFmpeg error:', error);
        return res.status(500).json({ error: 'FFmpeg processing failed' });
      }

      // Serve the video directly
      res.sendFile(outputPath);
    });
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`FFmpeg server running on port ${PORT}`);
});