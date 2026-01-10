const { generateFinancialAdvice, generateSpeechResponse } = require("../config/openai");
const { getAuthenticatedClient } = require("../config/supabase");
const { asyncHandler } = require("../middleware/errorHandler");
const { v4: uuidv4 } = require("uuid");
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const os = require('os');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Process voice command
const processVoiceCommand = asyncHandler(async (req, res) => {
  try {
    const { command } = req.body;
    
    if (!command) {
      return res.status(400).json({
        success: false,
        error: "Voice command is required"
      });
    }

    const supabase = getAuthenticatedClient(req.accessToken);
    
    // Get user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", req.user.id)
      .single();

    // Generate AI response
    const aiResponse = await generateFinancialAdvice(command, profile || {});
    
    // Use OpenAI to process voice command intelligently
    const commandAnalysis = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{
        role: "system",
        content: `You are a financial assistant. Analyze voice commands and extract financial actions.
        
        Return JSON with:
        {
          "action": "add_expense|add_income|query|unknown",
          "amount": number or null,
          "description": "brief description",
          "confidence": 0.1-1.0
        }
        
        Examples:
        - "add 500 expense" → {"action": "add_expense", "amount": 500, "description": "expense", "confidence": 0.9}
        - "maine 1000 kharcha kiya" → {"action": "add_expense", "amount": 1000, "description": "expense", "confidence": 0.9}
        - "show profit" → {"action": "query", "amount": null, "description": "profit query", "confidence": 0.8}`
      }, {
        role: "user",
        content: `Voice command: "${command}"`
      }],
      max_tokens: 200,
      temperature: 0.1
    });

    let parsedCommand;
    try {
      parsedCommand = JSON.parse(commandAnalysis.choices[0].message.content);
    } catch {
      parsedCommand = { action: "unknown", amount: null, description: "unclear command", confidence: 0.1 };
    }

    let action = null;
    let executionResult = null;
    let amount = parsedCommand.amount;
    
    if (parsedCommand.action === 'add_expense' && amount && amount > 0) {
      // Add expense to database
      const { data: savedEntry } = await supabase
        .from('earnings')
        .insert({
          user_id: req.user.id,
          amount: 0,
          inventory_cost: amount,
          earning_date: new Date().toISOString().split('T')[0],
          processed_text: `Voice: ${command}`,
          doc_type: 'voice_expense'
        })
        .select()
        .single();
      
      action = 'add_expense';
      executionResult = savedEntry;
    } else if (parsedCommand.action === 'add_income' && amount && amount > 0) {
      // Add income to database
      const { data: savedEntry } = await supabase
        .from('earnings')
        .insert({
          user_id: req.user.id,
          amount: amount,
          inventory_cost: 0,
          earning_date: new Date().toISOString().split('T')[0],
          processed_text: `Voice: ${command}`,
          doc_type: 'voice_income'
        })
        .select()
        .single();
      
      action = 'add_income';
      executionResult = savedEntry;
    }

    // Generate appropriate response message
    let responseMessage;
    if (action === 'add_expense') {
      responseMessage = `Successfully added ₹${amount} expense to your records.`;
    } else if (action === 'add_income') {
      responseMessage = `Successfully added ₹${amount} income to your records.`;
    } else if (parsedCommand.action === 'query') {
      responseMessage = await generateFinancialAdvice(command, profile || {});
    } else {
      responseMessage = "I didn't understand that command. Please try saying 'add expense of 500 rupees' or 'maine 1000 kamaya'.";
    }

    res.json({
      success: true,
      data: {
        message: responseMessage,
        action,
        execution_result: executionResult,
        confidence: parsedCommand.confidence,
        timestamp: new Date().toISOString(),
        detected_amount: amount,
        original_command: command,
        ai_analysis: parsedCommand
      }
    });

  } catch (error) {
    console.error("Voice command processing error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to process voice command"
    });
  }
});

// Generate speech response
const generateSpeech = asyncHandler(async (req, res) => {
  try {
    const { text, language = 'en' } = req.body;
    
    if (!text) {
      return res.status(400).json({
        success: false,
        error: "Text is required"
      });
    }

    // Generate speech using OpenAI TTS
    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
      voice: "alloy",
      input: text,
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());
    
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', 'attachment; filename="response.mp3"');
    res.send(buffer);

  } catch (error) {
    console.error("Speech generation error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate speech"
    });
  }
});

// Process audio file (Whisper)
const processAudio = asyncHandler(async (req, res) => {
  try {
    const audioFile = req.file;
    
    if (!audioFile) {
      return res.status(400).json({
        success: false,
        error: "Audio file is required"
      });
    }

    // Create temporary file for OpenAI
    const tempFilePath = path.join(os.tmpdir(), `audio_${uuidv4()}.webm`);
    fs.writeFileSync(tempFilePath, audioFile.buffer);

    try {
      // Convert audio to text using Whisper
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(tempFilePath),
        model: "whisper-1",
        language: "hi"
      });

      res.json({
        success: true,
        data: {
          transcription: transcription.text,
          timestamp: new Date().toISOString()
        }
      });
    } finally {
      // Clean up temp file
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    }

  } catch (error) {
    console.error("Audio processing error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to process audio"
    });
  }
});

module.exports = {
  processVoiceCommand,
  generateSpeech,
  processAudio
};