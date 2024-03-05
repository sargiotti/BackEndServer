const {Translate} = require('@google-cloud/translate').v2;
const translate = new Translate();

const translateText = async (text, targetLanguage = 'es') => {
  try {
    let [translations] = await translate.translate(text, targetLanguage);
    translations = Array.isArray(translations) ? translations : [translations];
    return translations[0];
  } catch (error) {
    console.error(`Error during translation: ${error.message}`);
    throw error;
  }
};

module.exports = translateText;