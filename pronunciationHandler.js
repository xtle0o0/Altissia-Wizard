// Altissia Pronunciation Handler
(function() {
    console.log('Altissia Pronunciation Handler Loaded');

    // State
    let isPronunciationHandlerEnabled = false;
    let autoSkipInterval = null;
    let exerciseData = null;
    let isProcessing = false;
    
    // Configuration
    const CONFIG = {
        // Delays in milliseconds
        initialDelay: 1500,        // Initial delay before starting auto-skipping
        betweenWordsDelay: 2000,   // Delay between words
        continueDelay: 1500,       // Delay before clicking continue button
        
        // Selectors
        continueButtonSelector: '.c-lfgsZH-ecAMBT-variant-primary',
        recordButtonSelector: '.c-lfgsZH-ecAMBT-variant-primary.c-IPDul',
        playButtonSelector: '.plyr__control[data-plyr="play"]',
        wordTextSelector: '.c-PJLV-aZMMW-size-28',
        audioPlayerSelector: '.plyr',
    };
    
    // Initialize the pronunciation handler
    function init() {
        console.log('Pronunciation Handler: Initializing');
        
        // Set up message listener for commands
        setupMessageListener();
        
        // Set up DOM change observer
        setupMutationObserver();
    }
    
    // Listen for messages from extension popup
    function setupMessageListener() {
        window.addEventListener('message', function(event) {
            if (event.data.type === 'ALTISSIA_TOGGLE_PRONUNCIATION') {
                togglePronunciationHandler(event.data.enabled);
            } else if (event.data.type === 'ALTISSIA_EXERCISE_DATA') {
                exerciseData = event.data.data;
                console.log('Pronunciation Handler: Received exercise data');
                
                // If the activity type is PRONUNCIATION, enable the handler
                if (exerciseData && exerciseData.activityType === 'PRONUNCIATION') {
                    console.log('Pronunciation Handler: Detected pronunciation exercise');
                    togglePronunciationHandler(true);
                } else {
                    togglePronunciationHandler(false);
                }
            }
        });
    }
    
    // Toggle pronunciation handler on/off
    function togglePronunciationHandler(enabled) {
        isPronunciationHandlerEnabled = enabled;
        
        if (enabled) {
            console.log('Pronunciation Handler: Enabled');
            // Process current word after a delay
            setTimeout(() => {
                processCurrentWord();
            }, CONFIG.initialDelay);
        } else {
            console.log('Pronunciation Handler: Disabled');
            clearInterval(autoSkipInterval);
        }
    }
    
    // Setup observer to watch for DOM changes
    function setupMutationObserver() {
        const observer = new MutationObserver(function(mutations) {
            if (!isPronunciationHandlerEnabled) return;
            
            // Check if we're on a pronunciation page (word displayed)
            const wordElement = document.querySelector(CONFIG.wordTextSelector);
            if (wordElement && !isProcessing) {
                processCurrentWord();
            }
        });
        
        // Start observing the document
        observer.observe(document.body, { 
            childList: true, 
            subtree: true 
        });
        
        console.log('Pronunciation Handler: Mutation observer setup');
    }
    
    // Process current word
    function processCurrentWord() {
        if (!isPronunciationHandlerEnabled || isProcessing) return;
        
        isProcessing = true;
        
        // Get the current word from the page
        const wordElement = document.querySelector(CONFIG.wordTextSelector);
        if (!wordElement) {
            console.log('Pronunciation Handler: No word found, skipping');
            isProcessing = false;
            return;
        }
        
        const word = wordElement.textContent.trim();
        console.log('Pronunciation Handler: Processing word', word);
        
        // First, try to play the audio
        const playButton = document.querySelector(CONFIG.playButtonSelector);
        if (playButton) {
            playButton.click();
            console.log('Pronunciation Handler: Played audio');
        }
        
        // Wait a bit and then simulate recording
        setTimeout(() => {
            simulateRecording();
        }, 2000);
    }
    
    // Simulate recording and continue
    function simulateRecording() {
        // Find the record button
        const recordButton = document.querySelector(CONFIG.recordButtonSelector);
        
        if (recordButton) {
            // Click record button to start recording
            recordButton.click();
            console.log('Pronunciation Handler: Started recording');
            
            // Wait a bit and simulate stopping the recording
            setTimeout(() => {
                // On real recordings, the button text changes to "Stop recording"
                // We don't need to click it again as it might not be there in our simulation
                
                // After simulated recording, click continue
                setTimeout(() => {
                    clickContinueButton();
                }, 1500);
            }, 2000); // Simulate 2 seconds of recording
        } else {
            // If no record button found, just try to continue
            clickContinueButton();
        }
    }
    
    // Click the continue button
    function clickContinueButton() {
        const continueButton = document.querySelector(CONFIG.continueButtonSelector);
        
        if (continueButton) {
            continueButton.click();
            console.log('Pronunciation Handler: Clicked continue');
            
            // Reset processing state after delay
            setTimeout(() => {
                isProcessing = false;
                // Process next word
                processCurrentWord();
            }, CONFIG.betweenWordsDelay);
        } else {
            console.log('Pronunciation Handler: No continue button found');
            isProcessing = false;
        }
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(); 