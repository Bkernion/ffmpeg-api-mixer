// server.js

const express = require('express');
const fs = require('fs');
const axios = require('axios');
const { exec, execSync } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());


// ✅ Serve the public folder
app.use('/public', express.static(path.join(__dirname, 'public')));

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
    const videoPath = path.join(__dirname, 'public', `${videoId}_avatar.mp4`);
    const musicPath = path.join(__dirname, 'public', `${videoId}_music.mp3`);
    const outputPath = path.join(__dirname, 'public', `${videoId}_final.mp4`);

    await downloadFile(avatar_video_url, videoPath);
    await downloadFile(background_music_url, musicPath);

    // Get the exact video duration
    const probeCmd = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`;
    const duration = parseFloat(execSync(probeCmd).toString().trim());

    const ffmpegCommand = `
      ffmpeg -y -i "${videoPath}" -stream_loop -1 -i "${musicPath}" -filter_complex "[1:a]volume=0.20[a1];[0:a][a1]amix=inputs=2:duration=first[aout]" -map 0:v -map "[aout]" -c:v copy -c:a aac -t ${duration} "${outputPath}"
    `;

    exec(ffmpegCommand, (error, stdout, stderr) => {
      if (error) {
        console.error('FFmpeg error:', error);
        console.error('FFmpeg stderr:', stderr); // <- helpful error log!
        return res.status(500).json({ error: 'FFmpeg processing failed' });
      }

      const fileUrl = `${req.protocol}://${req.get('host')}/public/${videoId}_final.mp4`;
      res.json({ url: fileUrl });
    });

  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


app.listen(PORT, () => {
  console.log(`FFmpeg server running on port ${PORT}`);
});
