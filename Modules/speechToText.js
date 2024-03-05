const speech = require('@google-cloud/speech');
const speechClient = new speech.SpeechClient();

// Assuming you're passing the GCS URI of the audio file
const transcribeAudio = async (gcsUri) => {
  const audio = {
    uri: gcsUri,
  };

  const config = {
    // For MP3, encoding is automatically detected; you might not need to specify it.
    // encoding: "ENCODING_UNSPECIFIED",
    sampleRateHertz: 16000, // This is optional; only set it if you know the sample rate.
    languageCode: "en-US",
    enableWordTimeOffsets: false,
  };

  const request = {
    audio: audio,
    config: config,
  };

  try {
    const [response] = await speechClient.recognize(request);
    return response.results
      .map(result => result.alternatives[0].transcript)
      .join('\n');
  } catch (error) {
    console.error(`Error during transcription: ${error.message}`);
    throw error;
  }
};

module.exports = transcribeAudio;