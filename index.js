const express = require('express');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const app = express();
const PORT = process.env.PORT || 3001;
const cors = require('cors');
const speech = require('@google-cloud/speech');
const speechClient = new speech.SpeechClient();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Server is running');
});

const videoDataPath = './videoData.json';

app.post('/video', (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).send('URL is required');
  }

  const data = { url };
  fs.writeFile(videoDataPath, JSON.stringify(data), 'utf8', (err) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Error saving the video URL');
    }
    res.status(200).send('Video URL saved successfully');
  });
});

app.get('/video', (req, res) => {
  fs.readFile(videoDataPath, 'utf8', (err, data) => {
    if (err) {
      console.error(err);
      return res.status(500).send({ url: '' });
    }
    res.status(200).json(JSON.parse(data));
  });
});

app.get('/video/metadata', (req, res) => {
  const videoUrl = req.query.url || '';

  if (!videoUrl) {
    fs.readFile(videoDataPath, 'utf8', (err, data) => {
      if (err || !data) {
        console.error(err || 'No video URL found');
        return res.status(500).send('No video URL available');
      }

      const { url } = JSON.parse(data);
      if (url) {
        fetchMetadata(url, res);
      } else {
        res.status(404).send('No video URL found');
      }
    });
  } else {
    fetchMetadata(videoUrl, res);
  }
});

app.get('/video/audio', (req, res) => {
  const videoUrl = req.query.url;  // Assume the front end sends the video URL as a query parameter
  const audioPath = `audio-${Date.now()}.mp3`; // Unique filename for the audio clip

  ffmpeg(videoUrl)
    .audioCodec('libmp3lame') // Use MP3 codec
    .noVideo() // No video stream in the output
    .setStartTime('00:00:30') // Start at 30 seconds
    .setDuration(15) // Duration of 15 seconds
    .saveToFile(audioPath) // Save the file temporarily
    .on('end', () => {
      // Once file is saved, send it in response
      res.download(audioPath, () => {
        // Optional: Delete the file after sending it to the client
        fs.unlinkSync(audioPath);
      });
    })
    .on('error', (err) => {
      console.error('Error processing video:', err.message);
      res.status(500).send('Error processing video');
    });
});

function fetchMetadata(videoUrl, res) {
  ffmpeg.ffprobe(videoUrl, (err, metadata) => {
    if (err) {
      console.error('Error extracting video metadata:', err);
      return res.status(500).send('Error extracting video metadata');
    }

    const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
    const durationSeconds = Math.round(metadata.format.duration);
    const videoHeight = videoStream ? videoStream.height : 'Unknown';
    console.log('The metadata from the video is',metadata)
    res.json({
      duration: durationSeconds,
      videoHeight: videoHeight,
    });
  });
}

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});