const express = require('express');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const app = express();
const PORT = process.env.PORT || 3000;
const cors = require('cors');
const transcribeAudio = require('./Modules/speechToText');
const translateText = require('./Modules/translateText');
const convertTextToSpeech = require('./Modules/textToSpeech')
const { Storage } = require('@google-cloud/storage');
const vision = require('@google-cloud/vision');
const storage = new Storage();
const bucketName = 'marcosargiottitask';
const path = require('path');
const client = new vision.ImageAnnotatorClient();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

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
  const videoUrl = req.query.url;
  const audioFileName = `audio-buffer.mp3`;

  ffmpeg(videoUrl)
    .audioCodec('libmp3lame')
    .noVideo()
    .setStartTime('00:00:30')
    .setDuration(15)
    .saveToFile(audioFileName)
    .on('end', async () => {
      try {
        await uploadFileToGCS(audioFileName, audioFileName);
        res.send({ message: 'Audio processed and uploaded to GCS', url: `https://storage.googleapis.com/marcosargiottitask/${audioFileName}` });
      } catch (uploadError) {
        console.error('Error uploading to GCS:', uploadError.message);
        res.status(500).send('Error uploading audio to GCS');
      }
    })
    .on('error', (err) => {
      console.error('Error processing video:', err.message);
      res.status(500).send('Error processing video');
    });
});

async function uploadFileToGCS(filePath, destFileName) {
  const { Storage } = require('@google-cloud/storage');
  const storage = new Storage();
  const bucketName = 'marcosargiottitask';

  await storage.bucket(bucketName).upload(filePath, {
    destination: destFileName,
  });

  console.log(`${filePath} uploaded to ${bucketName}`);
}

app.post('/processAudio', async (req, res) => {
  try {
    const transcription = await transcribeAudio("gs://marcosargiottitask/audio-buffer.mp3");
    
    const translation = await translateText(transcription, 'es');
    res.json({ transcription, translation });
  } catch (error) {
    console.error(`Error processing audio: ${error.message}`);
    res.status(500).send(`Error processing audio: ${error.message}`);
  }
});

app.post('/convertTextToSpeech', async (req, res) => {
  const { text } = req.body;

  try {
    const audioContent = await convertTextToSpeech(text, 'es-ES');
    res.send(Buffer.from(audioContent, 'base64'));
  } catch (error) {
    console.error(`Error during text-to-speech conversion: ${error.message}`);
    res.status(500).send(`Error during text-to-speech conversion: ${error.message}`);
  }
});

app.get('/video/first-frame', async (req, res) => {
  const videoUrl = req.query.url;
  const frameFileName = 'first-frame.jpg';
  const frameOutputPath = path.join(__dirname, frameFileName);

  ffmpeg(videoUrl)
    .frames(1)
    .output(frameOutputPath)
    .on('end', async () => {
      console.log('First frame extracted');
      try {
        await fs.promises.access(frameOutputPath, fs.constants.F_OK);
        await uploadFileToGCS(frameOutputPath, frameFileName);
        const publicUrl = `https://storage.googleapis.com/${bucketName}/${frameFileName}`;
        res.json({ imageUrl: publicUrl });
      } catch (error) {
        console.error("Error with file operation or GCS upload:", error);
        res.status(500).send("Error processing the image file");
      }
    })
    .on('error', (err) => {
      console.error('Error extracting first frame:', err);
      res.status(500).send('Error extracting first frame');
    })
    .run();
});

app.get('/performOCR', async (req, res) => {
  // Assuming the image file name is known and stored in your bucket
  const frameFileName = 'first-frame.jpg';

  try {
    // Specify the GCS URI of the image
    const gcsUri = `gs://${bucketName}/${frameFileName}`;

    // Performs text detection on the image file
    const [result] = await client.textDetection(gcsUri);
    const detections = result.textAnnotations;
    console.log('Text:', detections[0]?.description);

    // Send the first annotation (full image annotation) back to the frontend
    res.json({ text: detections[0]?.description || '' });
  } catch (error) {
    console.error('Failed to perform OCR:', error);
    res.status(500).send(`Failed to perform OCR: ${error.message}`);
  }
});

function fetchMetadata(videoUrl, res) {
  ffmpeg.ffprobe(videoUrl, (err, metadata) => {
    if (err) {
      console.error('Error extracting video metadata:', err);
      return res.status(500).send('Error extracting video metadata');
    }

    const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
    const durationSeconds = parseFloat(metadata.format.duration).toFixed(2);
    const videoHeight = videoStream ? videoStream.height : 'Unknown';
    res.json({
      duration: durationSeconds,
      videoHeight: videoHeight,
    });
  });
}

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});