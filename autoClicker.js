// Altissia Auto Clicker
(function() {
    console.log('Altissia Auto Clicker Loaded');

    // State
    let isAutoClickerEnabled = false;
    let autoClickerInterval = null;
    let exerciseData = null;
    let isProcessing = false;
    
    // Configuration
    const CONFIG = {
        // Delays in milliseconds
        initialDelay: 1500,        // Initial delay before starting auto-clicking
        betweenQuestionDelay: 2000, // Delay between questions
        clickDelay: 800,           // Delay between clicks within a question
        continueDelay: 1500,       // Delay before clicking continue button
        
        // Selectors
        validateButtonSelector: '.c-lfgsZH-ecAMBT-variant-primary',
        continueButtonSelector: '.c-lfgsZH-kzaroK-variant-success',
        dragAndDropElementSelector: '.c-hHNqvo',
        multipleChoiceOptionSelector: '.c-fvyLRe',
        dropZoneSelector: '.c-RVkgL',
        correctIndicatorSelector: '.c-ddeRrD-dLCtaN-isCorrect-true',
        textInputSelector: '.c-iJOJc',  // Selector for text input fields
    };
    
    // Initialize the auto clicker
    function init() {
        // Listen for messages from content script
        setupMessageListener();
        
        // Monitor for page changes
        setupMutationObserver();
    }
    
    // Setup listener for messages from content script
    function setupMessageListener() {
        window.addEventListener('message', function(event) {
            // Handle toggle message
            if (event.data && event.data.type === 'TOGGLE_AUTO_CLICKER') {
                toggleAutoClicker(event.data.enabled);
            }
            
            // Handle exercise data
            if (event.data && event.data.type === 'AUTO_CLICKER_DATA') {
                exerciseData = event.data.data;
                console.log('Auto Clicker: Received exercise data');
                
                if (isAutoClickerEnabled && !isProcessing) {
                    setTimeout(processCurrentQuestion, CONFIG.initialDelay);
                }
            }
        });
    }
    
    // Toggle auto clicker
    function toggleAutoClicker(enabled) {
        isAutoClickerEnabled = enabled;
        console.log('Auto Clicker: ' + (isAutoClickerEnabled ? 'Enabled' : 'Disabled'));
        
        if (isAutoClickerEnabled && exerciseData && !isProcessing) {
            setTimeout(processCurrentQuestion, CONFIG.initialDelay);
        }
    }
    
    // Setup mutation observer to detect DOM changes
    function setupMutationObserver() {
        const observer = new MutationObserver(function(mutations) {
            if (!isAutoClickerEnabled) return;
            
            // Check if we need to continue to next question
            if (!isProcessing) {
                const continueButton = document.querySelector(CONFIG.continueButtonSelector);
                if (continueButton) {
                    isProcessing = true;
                    console.log('Auto Clicker: Continue button detected');
                    setTimeout(() => {
                        continueButton.click();
                        console.log('Auto Clicker: Clicked continue button');
                        isProcessing = false;
                        
                        // Process next question after a delay
                        setTimeout(processCurrentQuestion, CONFIG.betweenQuestionDelay);
                    }, CONFIG.continueDelay);
                }
            }
        });
        
        // Start observing
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    
    // Process current question
    function processCurrentQuestion() {
        if (!isAutoClickerEnabled || isProcessing) return;
        
        isProcessing = true;
        console.log('Auto Clicker: Processing current question');
        
        // Detect exercise type and answer accordingly
        const questionType = detectQuestionType();
        
        setTimeout(() => {
            switch(questionType) {
                case 'drag-and-drop':
                    handleDragAndDrop();
                    break;
                case 'multiple-choice':
                    handleMultipleChoice();
                    break;
                case 'text-input':
                    handleTextInput();
                    break;
                default:
                    console.log('Auto Clicker: Unknown question type');
                    isProcessing = false;
                    break;
            }
        }, CONFIG.clickDelay);
    }
    
    // Detect the type of question currently displayed
    function detectQuestionType() {
        const dragElements = document.querySelectorAll(CONFIG.dragAndDropElementSelector);
        const multipleChoiceElements = document.querySelectorAll(CONFIG.multipleChoiceOptionSelector);
        const textInputElements = document.querySelectorAll(CONFIG.textInputSelector);
        
        if (dragElements.length > 0) {
            console.log('Auto Clicker: Detected drag-and-drop question');
            return 'drag-and-drop';
        } else if (multipleChoiceElements.length > 0) {
            console.log('Auto Clicker: Detected multiple-choice question');
            return 'multiple-choice';
        } else if (textInputElements.length > 0) {
            console.log('Auto Clicker: Detected text input question');
            return 'text-input';
        } else {
            console.log('Auto Clicker: Unknown question type');
            return 'unknown';
        }
    }
    
    // Handle drag and drop questions
    function handleDragAndDrop() {
        if (!exerciseData || !exerciseData.content || !exerciseData.content.items) {
            console.log('Auto Clicker: No exercise data available for drag-and-drop');
            isProcessing = false;
            return;
        }
        
        // Find current item
        const currentItem = getCurrentItem();
        if (!currentItem || !currentItem.correctAnswers || !currentItem.correctAnswers[0]) {
            console.log('Auto Clicker: Cannot find correct answer order for drag-and-drop');
            isProcessing = false;
            return;
        }
        
        const correctAnswer = currentItem.correctAnswers[0][0];
        console.log('Auto Clicker: Correct answer is', correctAnswer);
        
        // Get available answer options from backend data if available
        const availableOptions = currentItem.answers && currentItem.answers[0] ? 
                               currentItem.answers[0] : null;
        
        // Get the drag elements from the UI
        const dragElements = document.querySelectorAll(CONFIG.dragAndDropElementSelector);
        if (dragElements.length === 0) {
            console.log('Auto Clicker: No drag elements found');
            isProcessing = false;
            return;
        }
        
        // Map UI elements to their text content
        const elementMap = {};
        Array.from(dragElements).forEach(element => {
            elementMap[element.textContent.trim()] = element;
        });
        
        // Determine the correct order of elements to click
        let clickQueue = [];
        
        // If we have the answer options available from the backend
        if (availableOptions && availableOptions.length > 0) {
            console.log('Auto Clicker: Using backend answer options');
            
            // Find the correct order of the available options
            const correctWords = correctAnswer.split(' ');
            const correctWordsCopy = [...correctWords]; // Make a copy to manipulate
            
            // Try to match each available option to the correct answer
            const matchedOptions = [];
            
            // First, sort options from longest to shortest to handle multi-word options first
            const sortedOptions = [...availableOptions].sort((a, b) => {
                // Count how many words each option contains
                const aWords = a.split(' ').length;
                const bWords = b.split(' ').length;
                return bWords - aWords; // Sort from most words to least
            });
            
            // For each option, find where it appears in the correct answer
            sortedOptions.forEach(option => {
                // Look for this option in the correct answer
                const optionWords = option.split(' ');
                
                // Try to find this option as a continuous sequence in correctWordsCopy
                for (let i = 0; i <= correctWordsCopy.length - optionWords.length; i++) {
                    let match = true;
                    
                    // Check if the sequence matches
                    for (let j = 0; j < optionWords.length; j++) {
                        if (correctWordsCopy[i + j] !== optionWords[j]) {
                            match = false;
                            break;
                        }
                    }
                    
                    if (match) {
                        // Found a match! Add to matched options and remove from correctWordsCopy
                        matchedOptions.push({
                            option,
                            position: i
                        });
                        
                        // Remove these words from correctWordsCopy
                        for (let j = 0; j < optionWords.length; j++) {
                            correctWordsCopy[i + j] = null; // Mark as used
                        }
                        
                        break; // Move to next option
                    }
                }
            });
            
            // Sort the matched options by their position in the correct answer
            matchedOptions.sort((a, b) => a.position - b.position);
            
            // Now create the click queue based on the sorted matched options
            clickQueue = matchedOptions.map(match => {
                if (elementMap[match.option]) {
                    return elementMap[match.option];
                } else {
                    console.log(`Auto Clicker: Couldn't find element for "${match.option}"`);
                    // Try to find a partial match
                    for (const text in elementMap) {
                        if (match.option.includes(text) || text.includes(match.option)) {
                            return elementMap[text];
                        }
                    }
                    return null;
                }
            }).filter(element => element !== null);
        } 
        // Fallback: Use the previous algorithm if backend options aren't available
        else {
            console.log('Auto Clicker: Using UI-based element matching');
            // Split the correct answer into words, including punctuation
            const correctWords = correctAnswer.split(' ');
            const remainingElements = Array.from(dragElements);
            
            // Process words from the correct answer sequentially
            for (let i = 0; i < correctWords.length; i++) {
                const word = correctWords[i];
                
                // Try to find a direct match
                let found = false;
                for (let j = 0; j < remainingElements.length; j++) {
                    if (remainingElements[j].textContent.trim() === word) {
                        clickQueue.push(remainingElements[j]);
                        remainingElements.splice(j, 1);
                        found = true;
                        break;
                    }
                }
                
                // If no direct match, try to find multi-word elements
                if (!found && i < correctWords.length - 1) {
                    const twoWords = correctWords[i] + ' ' + correctWords[i+1];
                    for (let j = 0; j < remainingElements.length; j++) {
                        if (remainingElements[j].textContent.trim() === twoWords) {
                            clickQueue.push(remainingElements[j]);
                            remainingElements.splice(j, 1);
                            i++; // Skip the next word
                            found = true;
                            break;
                        }
                    }
                }
            }
            
            // Add any remaining elements that weren't matched
            remainingElements.forEach(element => {
                clickQueue.push(element);
            });
        }
        
        // Click elements with delays
        clickElementsInSequence(clickQueue, () => {
            // After all elements are clicked, click validate button
            setTimeout(() => {
                const validateButton = document.querySelector(CONFIG.validateButtonSelector);
                if (validateButton) {
                    validateButton.click();
                    console.log('Auto Clicker: Clicked validate button');
                }
                isProcessing = false;
            }, CONFIG.clickDelay);
        });
    }
    
    // Handle multiple choice questions
    function handleMultipleChoice() {
        const options = document.querySelectorAll(CONFIG.multipleChoiceOptionSelector);
        if (!options || options.length === 0) {
            console.log('Auto Clicker: No multiple choice options found');
            isProcessing = false;
            return;
        }
        
        // Try to find correct answer from exercise data
        let correctOption = null;
        
        if (exerciseData && exerciseData.content && exerciseData.content.items) {
            const currentItem = getCurrentItem();
            if (currentItem && currentItem.correctAnswers && currentItem.correctAnswers.length > 0) {
                // Try to match the correct answer to an option
                const correctAnswer = currentItem.correctAnswers[0][0];
                console.log('Auto Clicker: Correct answer is', correctAnswer);
                
                // Find option that contains the correct answer text
                correctOption = Array.from(options).find(option => 
                    option.textContent.includes(correctAnswer) ||
                    correctAnswer.includes(option.textContent)
                );
            }
        }
        
        // If we couldn't find the correct answer, just pick the first option
        if (!correctOption && options.length > 0) {
            correctOption = options[0];
            console.log('Auto Clicker: Using first option as fallback');
        }
        
        // Click the option
        if (correctOption) {
            setTimeout(() => {
                correctOption.click();
                console.log('Auto Clicker: Clicked option:', correctOption.textContent);
                
                // Click validate button after a delay
                setTimeout(() => {
                    const validateButton = document.querySelector(CONFIG.validateButtonSelector);
                    if (validateButton) {
                        validateButton.click();
                        console.log('Auto Clicker: Clicked validate button');
                    }
                    isProcessing = false;
                }, CONFIG.clickDelay);
            }, CONFIG.clickDelay);
        } else {
            console.log('Auto Clicker: No option to click');
            isProcessing = false;
        }
    }
    
    // Handle text input questions
    function handleTextInput() {
        if (!exerciseData || !exerciseData.content || !exerciseData.content.items) {
            console.log('Auto Clicker: No exercise data available for text input');
            isProcessing = false;
            return;
        }
        
        // Find current item
        const currentItem = getCurrentItem();
        if (!currentItem || !currentItem.correctAnswers || currentItem.correctAnswers.length === 0) {
            console.log('Auto Clicker: Cannot find correct answers for text input');
            isProcessing = false;
            return;
        }
        
        // Get all input elements
        const inputElements = document.querySelectorAll(CONFIG.textInputSelector);
        if (inputElements.length === 0) {
            console.log('Auto Clicker: No input elements found');
            isProcessing = false;
            return;
        }
        
        console.log(`Auto Clicker: Found ${inputElements.length} input fields and ${currentItem.correctAnswers.length} correct answers`);
        
        // Check if we're dealing with multiple inputs or a single input
        if (inputElements.length > 1 && currentItem.correctAnswers.length > 1) {
            // Multi-input case
            handleMultiInputText(inputElements, currentItem.correctAnswers);
        } else {
            // Single input case
            // Get the first correct answer 
            if (!currentItem.correctAnswers[0] || !currentItem.correctAnswers[0][0]) {
                console.log('Auto Clicker: Cannot find correct answer for text input');
                isProcessing = false;
                return;
            }
            
            const correctAnswer = currentItem.correctAnswers[0][0];
            console.log('Auto Clicker: Correct answer is', correctAnswer);
            
            // Set the value of the input element
            const inputElement = inputElements[0];
            inputElement.value = correctAnswer;
            
            // Trigger input event to simulate user typing
            const inputEvent = new Event('input', { bubbles: true });
            inputElement.dispatchEvent(inputEvent);
            
            // Also trigger change event
            const changeEvent = new Event('change', { bubbles: true });
            inputElement.dispatchEvent(changeEvent);
            
            console.log('Auto Clicker: Entered text:', correctAnswer);
            
            // Click validate button after a delay
            setTimeout(() => {
                const validateButton = document.querySelector(CONFIG.validateButtonSelector);
                if (validateButton) {
                    validateButton.click();
                    console.log('Auto Clicker: Clicked validate button');
                    
                    // Wait for feedback and then click continue
                    setTimeout(() => {
                        const continueButton = document.querySelector(CONFIG.continueButtonSelector);
                        if (continueButton) {
                            continueButton.click();
                            console.log('Auto Clicker: Clicked continue button');
                            
                            // Process next question after a delay
                            setTimeout(() => {
                                isProcessing = false;
                                processCurrentQuestion();
                            }, CONFIG.betweenQuestionDelay);
                        } else {
                            console.log('Auto Clicker: Continue button not found');
                            isProcessing = false;
                        }
                    }, CONFIG.continueDelay);
                } else {
                    console.log('Auto Clicker: Validate button not found');
                    isProcessing = false;
                }
            }, CONFIG.clickDelay);
        }
    }
    
    // Handle multiple text inputs
    function handleMultiInputText(inputElements, correctAnswers) {
        console.log('Auto Clicker: Handling multiple text inputs');
        
        // Process inputs one by one with delays
        let currentIndex = 0;
        
        function fillNextInput() {
            if (currentIndex >= inputElements.length || currentIndex >= correctAnswers.length) {
                // All inputs filled, click validate
                setTimeout(() => {
                    const validateButton = document.querySelector(CONFIG.validateButtonSelector);
                    if (validateButton) {
                        validateButton.click();
                        console.log('Auto Clicker: Clicked validate button');
                        
                        // Wait for feedback and then click continue
                        setTimeout(() => {
                            const continueButton = document.querySelector(CONFIG.continueButtonSelector);
                            if (continueButton) {
                                continueButton.click();
                                console.log('Auto Clicker: Clicked continue button');
                                
                                // Process next question after a delay
                                setTimeout(() => {
                                    isProcessing = false;
                                    processCurrentQuestion();
                                }, CONFIG.betweenQuestionDelay);
                            } else {
                                console.log('Auto Clicker: Continue button not found');
                                isProcessing = false;
                            }
                        }, CONFIG.continueDelay);
                    } else {
                        console.log('Auto Clicker: Validate button not found');
                        isProcessing = false;
                    }
                }, CONFIG.clickDelay);
                return;
            }
            
            // Get correct answer for this input
            const correctAnswer = correctAnswers[currentIndex][0];
            if (!correctAnswer) {
                console.log(`Auto Clicker: No correct answer for input ${currentIndex + 1}`);
                currentIndex++;
                setTimeout(fillNextInput, CONFIG.clickDelay / 2);
                return;
            }
            
            // Get the input element
            const inputElement = inputElements[currentIndex];
            
            // Set focus on the element first
            inputElement.focus();
            setTimeout(() => {
                // Set the value
                inputElement.value = correctAnswer;
                
                // Trigger events
                const inputEvent = new Event('input', { bubbles: true });
                inputElement.dispatchEvent(inputEvent);
                
                const changeEvent = new Event('change', { bubbles: true });
                inputElement.dispatchEvent(changeEvent);
                
                console.log(`Auto Clicker: Entered "${correctAnswer}" in input ${currentIndex + 1}`);
                
                // Move to next input after a delay
                currentIndex++;
                setTimeout(fillNextInput, CONFIG.clickDelay);
            }, 100);
        }
        
        // Start filling inputs
        fillNextInput();
    }
    
    // Click elements in sequence with delays
    function clickElementsInSequence(elements, callback) {
        let index = 0;
        
        function clickNext() {
            if (index < elements.length) {
                const element = elements[index];
                element.click();
                console.log('Auto Clicker: Clicked element:', element.textContent);
                index++;
                setTimeout(clickNext, CONFIG.clickDelay);
            } else {
                if (callback) callback();
            }
        }
        
        clickNext();
    }
    
    // Get current exercise item based on progress indicator
    function getCurrentItem() {
        if (!exerciseData || !exerciseData.content || !exerciseData.content.items) {
            return null;
        }
        
        // Try to find progress indicator
        const progressText = document.querySelector('.c-PJLV-fZAZlL-size-14');
        if (progressText) {
            const progressMatch = progressText.textContent.match(/(\d+)\s*\/\s*(\d+)/);
            if (progressMatch && progressMatch.length >= 3) {
                const currentIndex = parseInt(progressMatch[1]) - 1; // 0-based index
                if (currentIndex >= 0 && currentIndex < exerciseData.content.items.length) {
                    return exerciseData.content.items[currentIndex];
                }
            }
        }
        
        // Fallback to first item if progress can't be determined
        return exerciseData.content.items[0];
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    // Make functions available to content script
    window.AltissiaAutoClicker = {
        toggleAutoClicker: toggleAutoClicker
    };
})(); 