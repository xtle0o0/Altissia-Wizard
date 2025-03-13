(function() {
    console.log('Altissia Gemini AI Helper Initialized');
    
    // Keep track of the current question to avoid duplicate requests
    let currentQuestionId = null;
    
    // Listen for messages from content script
    window.addEventListener('message', function(event) {
        // Only accept messages from our extension
        if (event.source !== window) return;
        
        if (event.data && event.data.type === 'ANALYZE_WITH_GEMINI') {
            const questionData = event.data.data;
            
            // Avoid processing the same question multiple times
            if (questionData.question && questionData.question.uuid === currentQuestionId) {
                console.log('Gemini AI Helper: Skipping duplicate question analysis');
                return;
            }
            
            // Set current question ID
            if (questionData.question && questionData.question.uuid) {
                currentQuestionId = questionData.question.uuid;
            }
            
            console.log('Gemini AI Helper: Requesting analysis from content script', questionData);
            
            // Instead of using chrome.runtime directly, send message back to content script
            // The content script will then communicate with the background script
            window.postMessage({
                type: 'REQUEST_GEMINI_ANALYSIS',
                data: questionData
            }, '*');
        }
        
        // Listen for response from content script with Gemini analysis results
        if (event.data && event.data.type === 'GEMINI_ANALYSIS_RESULT') {
            const response = event.data.data;
            const questionData = event.data.questionData;
            
            if (response.error) {
                console.error('Gemini AI Helper: Error from analysis:', response.error);
                showErrorResult(questionData, response.error);
                return;
            }
            
            console.log('Gemini AI Helper: Received analysis result', response);
            
            // Send the result back to the content script to display
            window.postMessage({
                type: 'GEMINI_AI_ANSWER',
                data: {
                    questionData: questionData,
                    answer: response.answer,
                    explanation: response.explanation,
                    confidence: response.confidence
                }
            }, '*');
        }
    });
    
    // Function to show error result
    function showErrorResult(questionData, errorMessage) {
        // Send error result back to content script
        window.postMessage({
            type: 'GEMINI_AI_ANSWER',
            data: {
                questionData: questionData,
                answer: 'Error analyzing question',
                explanation: `An error occurred: ${errorMessage}`,
                confidence: 0
            }
        }, '*');
    }
    
    console.log('Altissia Gemini AI Helper Ready');
})(); 