const { generateSpeechResponse } = require("../config/openai");

class AudioConfirmationService {
  async generateInventoryConfirmation(userId, operation, productName, quantity, unit, language = 'mixed') {
    try {
      const confirmationText = this.buildConfirmationText(operation, productName, quantity, unit, language);
      const audioResponse = await generateSpeechResponse(confirmationText, language === 'hindi' ? 'hi' : 'en');
      
      // Convert audio response to base64
      const buffer = Buffer.from(await audioResponse.arrayBuffer());
      const audioBase64 = buffer.toString('base64');
      
      return {
        audio: audioBase64,
        text: confirmationText,
        language
      };
    } catch (error) {
      console.error('Audio confirmation error:', error);
      return null;
    }
  }

  buildConfirmationText(operation, productName, quantity, unit, language) {
    const templates = {
      mixed: {
        stock_in: `${quantity} ${unit} ${productName} add kar diya gaya hai`,
        stock_out: `${quantity} ${unit} ${productName} remove kar diya gaya hai`,
        update: `${productName} ka stock update ho gaya hai`
      },
      english: {
        stock_in: `Added ${quantity} ${unit} of ${productName} to inventory`,
        stock_out: `Removed ${quantity} ${unit} of ${productName} from inventory`,
        update: `Updated ${productName} inventory`
      },
      hindi: {
        stock_in: `${quantity} ${unit} ${productName} स्टॉक में जोड़ दिया गया`,
        stock_out: `${quantity} ${unit} ${productName} स्टॉक से निकाल दिया गया`,
        update: `${productName} का स्टॉक अपडेट हो गया`
      }
    };

    return templates[language]?.[operation] || templates.mixed[operation];
  }
}

module.exports = { AudioConfirmationService };