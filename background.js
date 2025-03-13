// Background script for Altissia Wizard extension

// Gemini API configuration
const GEMINI_API_KEY = 'AIzaSyBbxakAsJChm4H3BKaeVMDdZqjPWjqPzR8';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// Debug flag - set to true for detailed logging
const DEBUG = true;

// Debug logging function
function debugLog(...args) {
    if (DEBUG) {
        console.log('[DEBUG]', ...args);
    }
}

// Listen for messages from content script via geminiAI.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'ANALYZE_WITH_GEMINI_BACKGROUND') {
        console.log('Background: Received request to analyze question with Gemini AI', message.data);
        debugLog('Full question data:', JSON.stringify(message.data, null, 2));
        
        // Process the question data and call Gemini API
        analyzeQuestionWithGemini(message.data)
            .then(result => {
                console.log('Background: Gemini analysis complete', result);
                sendResponse(result);
            })
            .catch(error => {
                console.error('Background: Error analyzing with Gemini', error);
                sendResponse({ 
                    error: error.message, 
                    answer: 'Error analyzing question',
                    explanation: `An error occurred: ${error.message}`,
                    confidence: 0
                });
            });
        
        // Return true to indicate that sendResponse will be called asynchronously
        return true;
    }
});

async function analyzeQuestionWithGemini(questionData) {
    try {
        if (!questionData || !questionData.question) {
            throw new Error('Invalid question data format');
        }
        
        const formattedPrompt = formatQuestionForGemini(questionData.question);
        console.log('Background: Sending prompt to Gemini AI:', formattedPrompt);
        debugLog('Formatted prompt:', formattedPrompt);
        
        // Log API request details for debugging
        console.log('Background: Making API request to:', GEMINI_API_URL);
        console.log('Background: Using API key:', GEMINI_API_KEY.substring(0, 8) + '...');
        
        const requestBody = {
            contents: [
                {
                    parts: [
                        {
                            text: formattedPrompt
                        }
                    ]
                }
            ]
        };
        
        debugLog('Request body:', JSON.stringify(requestBody, null, 2));
        
        const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });
        
        console.log('Background: Received response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Background: Error response from Gemini API:', errorText);
            throw new Error(`Gemini API request failed: ${response.status} ${response.statusText} - ${errorText}`);
        }
        
        const responseData = await response.json();
        debugLog('Full Gemini API response:', JSON.stringify(responseData, null, 2));
        
        // Process the response to extract the answer
        return processGeminiResponse(responseData, questionData.question);
        
    } catch (error) {
        console.error('Background: Error in analyzeQuestionWithGemini', error);
        throw error;
    }
}

function formatQuestionForGemini(question) {
    const questionText = question.question || '';
    const options = question.answers || [];
    const questionType = question.type || 'MULTIPLE_CHOICE';
    const instruction = question.instruction || '';
    const specificInstruction = question.specificInstruction || '';
    const specificInstructionGap = question.specificInstructionGap || '';
    const uuid = question.uuid || '';
    const uuidSound = question.uuidSound || '';
    const isListeningComprehension = (uuidSound && uuidSound.length > 0) || 
                                     (question.partStatus && question.partStatus.skill === 'LISTENING_COMPREHENSION');
    
    console.log('Background: Formatting question of type:', questionType);
    debugLog('Question has audio?', !!uuidSound);
    debugLog('Question details:', {
        type: questionType,
        instruction,
        specificInstruction,
        specificInstructionGap,
        uuid,
        uuidSound,
        isListeningComprehension
    });
    
    // For listening comprehension questions
    if (isListeningComprehension) {
        debugLog('Handling as listening comprehension question');
        
        // For multiple choice listening comprehension
        if (options && options.length > 0) {
            return `
You are a language learning assistant helping with a language assessment exam.
This is a LISTENING COMPREHENSION question where the user listened to an audio file.

QUESTION:
${questionText}

ANSWER OPTIONS:
${options.map((option, index) => `${index + 1}. ${option}`).join('\n')}

Please respond in the following JSON format:
{
  "answer": "the exact text of the correct answer option",
  "explanation": "a brief explanation of why this is the most likely correct answer based on typical listening comprehension scenarios",
  "confidence": a number between 0 and 1 representing your confidence level
}

Choose the most appropriate answer based on the question context and what would typically be discussed in an audio about this topic. The answer MUST be exactly one of the provided options.
`;
        } else {
            // Open-ended listening comprehension
            return `
You are a language learning assistant helping with a language assessment exam.
This is a LISTENING COMPREHENSION question where the user listened to an audio file.

QUESTION:
${questionText}

${specificInstruction ? 'SPECIFIC INSTRUCTION: ' + specificInstruction : ''}
${specificInstructionGap ? 'INSTRUCTION GAP: ' + specificInstructionGap : ''}

Please respond in the following JSON format:
{
  "answer": "the word or phrase that best answers the question",
  "explanation": "a brief explanation of your answer based on typical listening comprehension scenarios",
  "confidence": a number between 0 and 1 representing your confidence level
}

Provide what would most likely be the correct answer based on the question context and what would typically be discussed in an audio about this topic.
`;
        }
    }
    
    // For open-ended questions with no options
    if (questionType === 'OPEN' || options.length === 0) {
        debugLog('Handling as open-ended question');
        // Create a prompt for open-ended questions
        return `
You are a language learning assistant helping with a language assessment exam.
Analyze this question and provide the correct answer to fill in the [GAP].

QUESTION:
${questionText}

${specificInstruction ? 'SPECIFIC INSTRUCTION: ' + specificInstruction : ''}
${specificInstructionGap ? 'INSTRUCTION GAP: ' + specificInstructionGap : ''}

Please respond in the following JSON format:
{
  "answer": "the word that should fill the gap",
  "explanation": "a brief explanation of why this is correct",
  "confidence": a number between 0 and 1 representing your confidence level
}

Provide a single word or short phrase that correctly fills the gap based on grammar rules, vocabulary knowledge, and context. Be precise and accurate.
`;
    }
    
    // For multiple choice questions
    debugLog('Handling as standard multiple choice question');
    return `
You are a language learning assistant helping with a language assessment exam.
Analyze this question and provide the correct answer.

QUESTION:
${questionText}

ANSWER OPTIONS:
${options.map((option, index) => `${index + 1}. ${option}`).join('\n')}

Please respond in the following JSON format:
{
  "answer": "the exact text of the correct answer option",
  "explanation": "a brief explanation of why this is correct",
  "confidence": a number between 0 and 1 representing your confidence level
}

The answer MUST be exactly one of the provided options. Select the most grammatically correct option that fits the context.
`;
}

function processGeminiResponse(responseData, question) {
    try {
        // Check if there is a valid response
        if (!responseData.candidates || responseData.candidates.length === 0 || !responseData.candidates[0].content) {
            throw new Error('Invalid response from Gemini API');
        }
        
        const content = responseData.candidates[0].content;
        if (!content.parts || content.parts.length === 0) {
            throw new Error('No content in Gemini API response');
        }
        
        // Get the response text
        const responseText = content.parts[0].text || '';
        
        console.log('Background: Raw Gemini response text:', responseText);
        
        // Extract the JSON from the response
        // Look for JSON object in the response text
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.error('Background: Failed to extract JSON from response');
            console.log('Background: Full response text:', responseText);
            throw new Error('Could not extract JSON from Gemini response');
        }
        
        const jsonString = jsonMatch[0];
        console.log('Background: Extracted JSON string:', jsonString);
        
        let parsedResponse;
        try {
            parsedResponse = JSON.parse(jsonString);
            debugLog('Parsed JSON response:', parsedResponse);
        } catch (jsonError) {
            console.error('Background: Error parsing JSON:', jsonError);
            console.log('Background: JSON string that failed to parse:', jsonString);
            throw new Error(`Failed to parse JSON: ${jsonError.message}`);
        }
        
        // Get the original options for validation
        const options = question.answers || [];
        console.log('Background: Original answer options:', options);
        
        // Check if this is a listening comprehension question
        const isListeningComprehension = question.uuidSound && question.uuidSound.length > 0;
        
        // For open-ended questions or questions with no options
        if (question.type === 'OPEN' || options.length === 0) {
            console.log('Background: Processing open-ended question answer');
            return {
                answer: parsedResponse.answer || 'No answer provided',
                explanation: parsedResponse.explanation || 'No explanation provided',
                confidence: typeof parsedResponse.confidence === 'number' ? 
                            parsedResponse.confidence : 0.7,
                isListeningComprehension: isListeningComprehension,
                audioUrl: isListeningComprehension ? constructAudioUrl(question.uuidSound) : null
            };
        }
        
        // For multiple choice questions (including listening comprehension)
        // Validate that the answer is one of the provided options
        let answer = parsedResponse.answer;
        console.log('Background: Answer from Gemini:', answer);
        
        if (!options.includes(answer)) {
            console.log('Background: Answer not in options, looking for closest match');
            // Try to find the closest match
            const closestOption = options.find(option => 
                option.toLowerCase().includes(answer.toLowerCase()) || 
                answer.toLowerCase().includes(option.toLowerCase())
            );
            
            if (closestOption) {
                console.log('Background: Found closest match:', closestOption);
                answer = closestOption;
            } else {
                console.log('Background: No close match found, using first option as fallback');
                // Fallback to first option if no match found
                answer = options[0];
            }
        }
        
        return {
            answer: answer,
            explanation: parsedResponse.explanation || 'No explanation provided',
            confidence: typeof parsedResponse.confidence === 'number' ? 
                        parsedResponse.confidence : 0.5,
            isListeningComprehension: isListeningComprehension,
            audioUrl: isListeningComprehension ? constructAudioUrl(question.uuidSound) : null
        };
        
    } catch (error) {
        console.error('Error processing Gemini response:', error);
        
        // Provide a fallback response
        return {
            answer: 'Error processing response',
            explanation: `Failed to process Gemini response: ${error.message}`,
            confidence: 0
        };
    }
}

// Helper function to construct the audio URL
function constructAudioUrl(uuidSound) {
    if (!uuidSound) return null;
    
    // Extract language code from UUID if it has a format like "EN_GB_LISTENING_..."
    const parts = uuidSound.split('_');
    let langCode = 'en';
    
    if (parts.length >= 2) {
        langCode = parts[0].toLowerCase();
    }
    
    return `https://app.ofppt-langues.ma/dataLevelTest/data/${langCode}/sounds/${uuidSound}.blu`;
}

// Listen for extension install/update
chrome.runtime.onInstalled.addListener(() => {
    console.log('Altissia Wizard extension installed or updated');
    console.log('Using Gemini API URL:', GEMINI_API_URL);
});

console.log('Altissia Wizard Background Script Initialized'); 