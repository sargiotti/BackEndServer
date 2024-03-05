const textToSpeech = require('@google-cloud/text-to-speech');
const ttsClient = new textToSpeech.TextToSpeechClient();

const convertTextToSpeech = async (text, languageCode) => {
  const request = {
    input: { text },
    voice: { languageCode, ssmlGender: 'NEUTRAL' },
    audioConfig: { audioEncoding: 'MP3' },
  };

  try {
    const [response] = await ttsClient.synthesizeSpeech(request);
    return response.audioContent;
  } catch (error) {
    console.error(`Error during text-to-speech conversion: ${error}`);
    throw error;
  }
};

module.exports = convertTextToSpeech;