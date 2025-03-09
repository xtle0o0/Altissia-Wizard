// Altissia Wizard Content Script
(function() {
    console.log('Altissia Wizard Content Script Loaded');
    
    // State variables
    let exerciseData = null;
    let wizardDiv = null;
    let isDragging = false;
    let isMinimized = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;
    let currentPage = 'unknown';
    let isAutoClickerEnabled = false;
    
    // URL patterns for different pages
    const URL_PATTERNS = {
        LESSON: /https:\/\/app\.ofppt-langues\.ma\/platform\/learning-path\/mission\/.*\/lesson\/.*/,
        ACTIVITY: /https:\/\/app\.ofppt-langues\.ma\/platform\/learning-path\/mission\/.*\/lesson\/.*\/activity\/.*/
    };
    
    // Configuration
    const CONFIG = {
        maxHeight: '400px',
        defaultWidth: '350px'
    };
    
    // Initialization
    function init() {
        console.log('Altissia Wizard: Initializing...');
        
        // Determine which page we're on
        detectCurrentPage();
        
        // Load CSS first
        injectCSS();
        
        // Inject interceptor script
        injectInterceptorScript();

        // Inject auto-clicker script
        injectAutoClickerScript();
        
        // Inject pronunciation handler script
        injectPronunciationHandlerScript();
        
        // Create wizard UI
        createWizardUI();
        
        // Listen for messages from the interceptor
        setupMessageListener();
        
        // Request exercise data if any exists, with a longer delay to ensure all scripts are loaded
        setTimeout(() => {
            requestExerciseData();
            
            // Initialize auto-clicker if it was previously enabled
            const wasAutoClickerEnabled = localStorage.getItem('altissia_autoclicker_enabled') === 'true';
            if (wasAutoClickerEnabled) {
                console.log('Altissia Wizard: Restoring auto-clicker state to enabled');
                isAutoClickerEnabled = true;
                
                // Update UI
                const autoClickerBtn = document.querySelector('.auto-clicker-toggle');
                if (autoClickerBtn) {
                    autoClickerBtn.innerHTML = 'Auto: ON';
                    autoClickerBtn.classList.add('enabled');
                }
                
                // This will be called again when exercise data is received
                window.postMessage({
                    type: 'TOGGLE_AUTO_CLICKER',
                    enabled: true
                }, '*');
            }
        }, 2000);
        
        // Add URL change listener for SPAs
        setupURLChangeDetection();
        
        console.log('Altissia Wizard: Initialization complete');
    }
    
    // Detect the current page based on URL
    function detectCurrentPage() {
        const url = window.location.href;
        
        if (URL_PATTERNS.ACTIVITY.test(url)) {
            currentPage = 'activity';
            console.log('Altissia Wizard: On activity page (showing answers)');
        } else if (URL_PATTERNS.LESSON.test(url)) {
            currentPage = 'lesson';
            console.log('Altissia Wizard: On lesson page (showing waiting animation)');
        } else {
            currentPage = 'unknown';
            console.log('Altissia Wizard: On unknown page', url);
        }
    }
    
    // Setup detection for URL changes (for single page apps)
    function setupURLChangeDetection() {
        // Create an observer instance
        const observer = new MutationObserver(function(mutations) {
            const currentURL = window.location.href;
            
            // If URL has changed
            if (currentURL !== lastURL) {
                lastURL = currentURL;
                console.log('Altissia Wizard: URL changed to', currentURL);
                
                // Update current page detection
                detectCurrentPage();
                
                // Update UI based on new page
                updateWizardContent();
            }
        });
        
        // Remember the last URL
        let lastURL = window.location.href;
        
        // Start observing
        observer.observe(document, {
            subtree: true,
            childList: true
        });
        
        // Also listen for popstate and hashchange events
        window.addEventListener('popstate', function() {
            detectCurrentPage();
            updateWizardContent();
        });
        
        window.addEventListener('hashchange', function() {
            detectCurrentPage();
            updateWizardContent();
        });
    }
    
    // Inject CSS Styles
    function injectCSS() {
        const css = `
            .altissia-wizard {
                position: fixed;
                top: 20px;
                right: 20px;
                min-width: 280px;
                max-width: 400px;
                background: #ffffff;
                border-radius: 12px;
                padding: 20px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
                z-index: 999999 !important;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                overflow: auto;
                border: 1px solid #e0e0e0;
                transition: all 0.3s ease;
                max-height: 80vh;
            }
            
            .wizard-header {
                cursor: move;
                padding: 12px;
                background: #4CAF50;
                border-radius: 8px 8px 0 0;
                margin: -20px -20px 20px -20px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                color: white;
                user-select: none;
            }
            
            .wizard-title {
                font-weight: 600;
                font-size: 16px;
                text-shadow: 0 1px 2px rgba(0,0,0,0.1);
            }
            
            .wizard-controls {
                display: flex;
                gap: 6px;
            }
            
            .wizard-close, .minimize-button, .auto-clicker-toggle {
                background: rgba(255,255,255,0.1);
                border-radius: 4px;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s ease;
                cursor: pointer;
            }
            
            .wizard-close:hover, .minimize-button:hover, .auto-clicker-toggle:hover {
                background: rgba(255,255,255,0.2);
            }
            
            .auto-clicker-toggle {
                width: auto;
                padding: 0 8px;
                font-size: 12px;
            }
            
            .auto-clicker-toggle.enabled {
                background: rgba(255, 255, 0, 0.3);
            }
            
            .wizard-content {
                max-height: calc(80vh - 100px);
                overflow-y: auto;
                overflow-x: hidden;
                scrollbar-width: thin;
                scrollbar-color: #aaa #f1f1f1;
            }
            
            .question-box {
                background: #fff;
                border: 1px solid #e0e0e0;
                border-radius: 8px;
                padding: 15px;
                margin-bottom: 15px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.05);
            }
            
            .question {
                font-size: 14px;
                color: #2c3e50;
                margin-bottom: 12px;
                padding-bottom: 12px;
                border-bottom: 1px solid #eee;
                line-height: 1.4;
            }
            
            .answers {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            
            .answer-item {
                background: #e8f5e9;
                border-left: 4px solid #4CAF50;
                padding: 10px 12px;
                border-radius: 4px;
                display: flex;
                align-items: center;
                font-weight: 500;
                color: #1b5e20;
            }
            
            .or-text {
                color: #666;
                font-style: italic;
                margin: 6px 0;
                font-size: 0.85em;
                text-align: center;
            }
            
            .answer-item::before {
                content: "✓";
                color: #4CAF50;
                font-weight: bold;
                margin-right: 10px;
                font-size: 14px;
            }
            
            .altissia-wizard.minimized {
                height: auto;
                padding: 0;
            }
            
            .altissia-wizard.minimized .wizard-header {
                margin: 0;
                border-radius: 8px;
            }
            
            .altissia-wizard.minimized .wizard-content {
                display: none;
            }
            
            /* Waiting Animation */
            .waiting-container {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 20px 0;
            }
            
            .waiting-text {
                font-size: 16px;
                font-weight: 500;
                color: #333;
                margin-bottom: 20px;
                text-align: center;
            }
            
            .eye {
                position: relative;
                width: 80px;
                height: 80px;
                background: #fff;
                border-radius: 50%;
                border: 2px solid #4CAF50;
                box-shadow: 0 0 10px rgba(0,0,0,0.1);
                display: flex;
                justify-content: center;
                align-items: center;
                overflow: hidden;
            }
            
            .pupil {
                width: 30px;
                height: 30px;
                background: #2c3e50;
                border-radius: 50%;
                position: absolute;
                animation: look-around 5s infinite;
            }
            
            .eyelid {
                width: 100%;
                height: 50%;
                background: #4CAF50;
                position: absolute;
                animation: blink 4s infinite;
            }
            
            .eyelid.top {
                top: -40px;
                border-radius: 0 0 50% 50%;
            }
            
            .eyelid.bottom {
                bottom: -40px;
                border-radius: 50% 50% 0 0;
            }
            
            @keyframes look-around {
                0%, 100% { transform: translate(0, 0); }
                20% { transform: translate(10px, -5px); }
                40% { transform: translate(-10px, 5px); }
                60% { transform: translate(5px, 10px); }
                80% { transform: translate(-5px, -10px); }
            }
            
            @keyframes blink {
                0%, 95%, 100% { transform: translateY(0px); }
                97% { transform: translateY(20px); }
            }
            
            .waiting-message {
                margin-top: 20px;
                font-size: 14px;
                color: #666;
                text-align: center;
                line-height: 1.5;
            }
            
            /* Drag and Drop styling */
            .answer-ordered {
                background: #e8f5e9;
                border-left: 4px solid #4CAF50;
                padding: 12px 15px;
                border-radius: 4px;
                font-weight: 500;
                color: #1b5e20;
                line-height: 1.4;
                margin-bottom: 5px;
            }
            
            .answer-ordered::before {
                content: "✓";
                color: #4CAF50;
                font-weight: bold;
                margin-right: 10px;
                font-size: 14px;
            }
            
            .drag-elements {
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
                margin-top: 12px;
                padding-top: 12px;
                border-top: 1px dashed #ddd;
            }
            
            .drag-element {
                background: #f5f5f5;
                border: 1px solid #ddd;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 12px;
                color: #555;
            }
            
            /* Feature toggles area */
            .feature-toggles {
                margin-top: 15px;
                padding-top: 15px;
                border-top: 1px solid #eee;
                display: flex;
                flex-direction: column;
                gap: 10px;
            }
            
            .toggle-item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                font-size: 14px;
                color: #333;
            }
            
            /* Toggle switch styling */
            .switch {
                position: relative;
                display: inline-block;
                width: 40px;
                height: 22px;
            }
            
            .switch input {
                opacity: 0;
                width: 0;
                height: 0;
            }
            
            .slider {
                position: absolute;
                cursor: pointer;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-color: #ccc;
                transition: .3s;
                border-radius: 22px;
            }
            
            .slider:before {
                position: absolute;
                content: "";
                height: 16px;
                width: 16px;
                left: 3px;
                bottom: 3px;
                background-color: white;
                transition: .3s;
                border-radius: 50%;
            }
            
            input:checked + .slider {
                background-color: #4CAF50;
            }
            
            input:focus + .slider {
                box-shadow: 0 0 1px #4CAF50;
            }
            
            input:checked + .slider:before {
                transform: translateX(18px);
            }
        `;
        
        const style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);
    }
    
    // Inject the interceptor script
    function injectInterceptorScript() {
        try {
            const script = document.createElement('script');
            script.src = chrome.runtime.getURL('interceptor.js');
            script.onload = function() {
                this.remove();
                console.log('Altissia Wizard: Interceptor script injected and loaded');
            };
            (document.head || document.documentElement).appendChild(script);
        } catch (error) {
            console.error('Altissia Wizard: Error injecting interceptor script:', error);
        }
    }
    
    // Inject Auto-Clicker Script
    function injectAutoClickerScript() {
        try {
            const script = document.createElement('script');
            script.src = chrome.runtime.getURL('autoClicker.js');
            script.onload = function() {
                this.remove();
                console.log('Altissia Wizard: Auto Clicker script injected and loaded');
            };
            (document.head || document.documentElement).appendChild(script);
        } catch (error) {
            console.error('Altissia Wizard: Error injecting auto clicker script:', error);
        }
    }
    
    // Inject Pronunciation Handler Script
    function injectPronunciationHandlerScript() {
        try {
            const script = document.createElement('script');
            script.src = chrome.runtime.getURL('pronunciationHandler.js');
            script.onload = function() {
                this.remove();
                console.log('Altissia Wizard: Pronunciation Handler script injected and loaded');
            };
            (document.head || document.documentElement).appendChild(script);
        } catch (error) {
            console.error('Altissia Wizard: Error injecting pronunciation handler script:', error);
        }
    }
    
    // Create the wizard UI
    function createWizardUI() {
        // Create main container
        wizardDiv = document.createElement('div');
        wizardDiv.className = 'altissia-wizard';
        
        // Create header with drag functionality and controls
        const header = document.createElement('div');
        header.className = 'wizard-header';
        
        const title = document.createElement('div');
        title.className = 'wizard-title';
        title.textContent = 'Altissia Wizard';
        
        const controls = document.createElement('div');
        controls.className = 'wizard-controls';
        
        // Auto-clicker toggle button
        const autoClickerBtn = document.createElement('div');
        autoClickerBtn.className = 'auto-clicker-toggle';
        autoClickerBtn.innerHTML = 'Auto: OFF';
        autoClickerBtn.title = 'Toggle Auto Answer';
        autoClickerBtn.addEventListener('click', toggleAutoClicker);
        
        const minimizeBtn = document.createElement('div');
        minimizeBtn.className = 'minimize-button';
        minimizeBtn.innerHTML = '−';
        minimizeBtn.title = 'Minimize';
        minimizeBtn.addEventListener('click', toggleMinimize);
        
        const closeBtn = document.createElement('div');
        closeBtn.className = 'wizard-close';
        closeBtn.innerHTML = '×';
        closeBtn.title = 'Close';
        closeBtn.addEventListener('click', hideWizard);
        
        controls.appendChild(autoClickerBtn);
        controls.appendChild(minimizeBtn);
        controls.appendChild(closeBtn);
        
        header.appendChild(title);
        header.appendChild(controls);
        
        // Add drag functionality to header
        header.addEventListener('mousedown', startDrag);
        
        // Create content container
        const content = document.createElement('div');
        content.className = 'wizard-content';
        
        // Create feature toggles area
        const featureToggles = document.createElement('div');
        featureToggles.className = 'feature-toggles';
        
        // Pronunciation handler toggle
        const pronunciationToggle = document.createElement('div');
        pronunciationToggle.className = 'toggle-item';
        pronunciationToggle.innerHTML = `
            <span>Pronunciation auto:</span>
            <label class="switch">
                <input type="checkbox" id="pronunciation-toggle">
                <span class="slider"></span>
            </label>
        `;
        
        featureToggles.appendChild(pronunciationToggle);
        content.appendChild(featureToggles);
        
        // Add pronunciation toggle event listener
        setTimeout(() => {
            const pronunciationToggleInput = document.getElementById('pronunciation-toggle');
            if (pronunciationToggleInput) {
                pronunciationToggleInput.addEventListener('change', togglePronunciationHandler);
            }
        }, 100);
        
        // Assemble wizard
        wizardDiv.appendChild(header);
        wizardDiv.appendChild(content);
        
        // Add wizard to page
        document.body.appendChild(wizardDiv);
        console.log('Altissia Wizard: UI created and added to page');
        
        // Setup global event listeners
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', stopDrag);
        
        // Update content based on current page
        updateWizardContent();
    }
    
    // Toggle auto-clicker
    function toggleAutoClicker() {
        isAutoClickerEnabled = !isAutoClickerEnabled;
        
        // Save state to localStorage
        localStorage.setItem('altissia_autoclicker_enabled', isAutoClickerEnabled);
        
        // Update button appearance
        const autoClickerBtn = document.querySelector('.auto-clicker-toggle');
        if (autoClickerBtn) {
            autoClickerBtn.innerHTML = isAutoClickerEnabled ? 'Auto: ON' : 'Auto: OFF';
            
            if (isAutoClickerEnabled) {
                autoClickerBtn.classList.add('enabled');
            } else {
                autoClickerBtn.classList.remove('enabled');
            }
        }
        
        console.log('Altissia Wizard: Auto-clicker ' + (isAutoClickerEnabled ? 'enabled' : 'disabled'));
        
        // Notify auto-clicker script
        window.postMessage({
            type: 'TOGGLE_AUTO_CLICKER',
            enabled: isAutoClickerEnabled
        }, '*');
        
        // Send exercise data if auto-clicker is enabled
        if (isAutoClickerEnabled && exerciseData) {
            window.postMessage({
                type: 'AUTO_CLICKER_DATA',
                data: exerciseData
            }, '*');
        }
    }
    
    // Toggle pronunciation handler on/off
    function togglePronunciationHandler() {
        const toggle = document.getElementById('pronunciation-toggle');
        const isPronunciationEnabled = toggle.checked;
        
        // Send message to the pronunciation handler script
        window.postMessage({
            type: 'ALTISSIA_TOGGLE_PRONUNCIATION',
            enabled: isPronunciationEnabled
        }, '*');
        
        console.log('Altissia Wizard: Pronunciation handler ' + (isPronunciationEnabled ? 'enabled' : 'disabled'));
    }
    
    // Show the wizard
    function showWizard() {
        if (wizardDiv) {
            wizardDiv.style.display = 'block';
            console.log('Altissia Wizard: Showing wizard');
        }
    }
    
    // Hide the wizard
    function hideWizard() {
        if (wizardDiv) {
            wizardDiv.style.display = 'none';
            console.log('Altissia Wizard: Hiding wizard');
        }
    }
    
    // Toggle minimize state
    function toggleMinimize() {
        isMinimized = !isMinimized;
        
        if (wizardDiv) {
            if (isMinimized) {
                wizardDiv.classList.add('minimized');
                wizardDiv.querySelector('.minimize-button').innerHTML = '+';
            } else {
                wizardDiv.classList.remove('minimized');
                wizardDiv.querySelector('.minimize-button').innerHTML = '−';
            }
            console.log('Altissia Wizard: Toggled minimize state -', isMinimized ? 'minimized' : 'expanded');
        }
    }
    
    // Start dragging
    function startDrag(e) {
        // Only enable drag on header, not controls
        if (e.target.classList.contains('wizard-close') || 
            e.target.classList.contains('minimize-button') ||
            e.target.classList.contains('auto-clicker-toggle')) {
            return;
        }
        
        isDragging = true;
        
        const rect = wizardDiv.getBoundingClientRect();
        dragOffsetX = e.clientX - rect.left;
        dragOffsetY = e.clientY - rect.top;
        
        e.preventDefault();
    }
    
    // During drag
    function drag(e) {
        if (!isDragging) return;
        
        const x = e.clientX - dragOffsetX;
        const y = e.clientY - dragOffsetY;
        
        // Keep within window boundaries
        const maxX = window.innerWidth - wizardDiv.offsetWidth;
        const maxY = window.innerHeight - wizardDiv.offsetHeight;
        
        wizardDiv.style.left = Math.max(0, Math.min(maxX, x)) + 'px';
        wizardDiv.style.top = Math.max(0, Math.min(maxY, y)) + 'px';
    }
    
    // Stop dragging
    function stopDrag() {
        isDragging = false;
    }
    
    // Setup event listener for messages from interceptor script
    function setupMessageListener() {
        window.addEventListener('message', function(event) {
            // Only accept messages from the current window
            if (event.source !== window) return;
            
            // Handle exercise data
            if (event.data.type === 'ALTISSIA_EXERCISE_DATA') {
                exerciseData = event.data.data;
                console.log('Altissia Wizard: Received exercise data', exerciseData.title || 'Untitled');
                
                // Update UI content
                updateWizardContent();
                
                // Send data to auto-clicker if it's enabled
                if (isAutoClickerEnabled) {
                    window.postMessage({
                        type: 'TOGGLE_AUTO_CLICKER',
                        enabled: true
                    }, '*');
                    
                    window.postMessage({
                        type: 'AUTO_CLICKER_DATA',
                        data: exerciseData
                    }, '*');
                }
                
                // Auto-enable pronunciation handler for pronunciation exercises
                if (exerciseData.activityType === 'PRONUNCIATION') {
                    // Update the UI toggle
                    const toggle = document.getElementById('pronunciation-toggle');
                    if (toggle) {
                        toggle.checked = true;
                    }
                    
                    // Enable the pronunciation handler
                    window.postMessage({
                        type: 'ALTISSIA_TOGGLE_PRONUNCIATION',
                        enabled: true
                    }, '*');
                    
                    console.log('Altissia Wizard: Auto-enabled pronunciation handler for pronunciation exercise');
                }
            }
        });
    }
    
    // Request exercise data from interceptor
    function requestExerciseData() {
        console.log('Altissia Wizard: Requesting exercise data from interceptor');
        window.postMessage({ type: 'GET_ALTISSIA_EXERCISE_DATA' }, '*');
    }
    
    // Update wizard content with exercise data or waiting animation
    function updateWizardContent() {
        if (!wizardDiv) {
            console.log('Altissia Wizard: No wizard div available');
            return;
        }
        
        const contentArea = wizardDiv.querySelector('.wizard-content');
        if (!contentArea) {
            console.log('Altissia Wizard: No content area found');
            return;
        }
        
        // Clear existing content
        while (contentArea.firstChild && !contentArea.firstChild.classList?.contains('feature-toggles')) {
            contentArea.removeChild(contentArea.firstChild);
        }
        
        if (exerciseData && exerciseData.content && exerciseData.content.items) {
            showExerciseContent(contentArea);
            
            // Make sure to send data to auto-clicker if it's enabled
            if (isAutoClickerEnabled) {
                setTimeout(() => {
                    window.postMessage({
                        type: 'TOGGLE_AUTO_CLICKER',
                        enabled: true
                    }, '*');
                    
                    window.postMessage({
                        type: 'AUTO_CLICKER_DATA',
                        data: exerciseData
                    }, '*');
                    
                    console.log('Altissia Wizard: Sent exercise data to auto-clicker');
                }, 500);
            }
        } else if (currentPage === 'activity') {
            showWaitingAnimation(contentArea);
        } else {
            showSearchingContent(contentArea);
        }
        
        console.log('Altissia Wizard: Content updated successfully');
    }
    
    // Show the waiting animation
    function showWaitingAnimation(container) {
        const waitingContainer = document.createElement('div');
        waitingContainer.className = 'waiting-container';
        
        const waitingText = document.createElement('div');
        waitingText.className = 'waiting-text';
        waitingText.textContent = 'Waiting for exercise...';
        
        const eye = document.createElement('div');
        eye.className = 'eye';
        
        const pupil = document.createElement('div');
        pupil.className = 'pupil';
        
        const eyelidTop = document.createElement('div');
        eyelidTop.className = 'eyelid top';
        
        const eyelidBottom = document.createElement('div');
        eyelidBottom.className = 'eyelid bottom';
        
        eye.appendChild(pupil);
        eye.appendChild(eyelidTop);
        eye.appendChild(eyelidBottom);
        
        const waitingMessage = document.createElement('div');
        waitingMessage.className = 'waiting-message';
        waitingMessage.innerHTML = 'Start an exercise to see answers.<br>I\'ll be watching and ready to help!';
        
        waitingContainer.appendChild(waitingText);
        waitingContainer.appendChild(eye);
        waitingContainer.appendChild(waitingMessage);
        
        container.appendChild(waitingContainer);
    }
    
    // Show searching for exercise content
    function showSearchingContent(container) {
        const searchingContainer = document.createElement('div');
        searchingContainer.className = 'waiting-container';
        
        const searchingText = document.createElement('div');
        searchingText.className = 'waiting-text';
        searchingText.textContent = 'Searching for exercise data...';
        
        const waitingMessage = document.createElement('div');
        waitingMessage.className = 'waiting-message';
        waitingMessage.innerHTML = 'Please answer at least one question<br>to activate Altissia Wizard';
        
        searchingContainer.appendChild(searchingText);
        searchingContainer.appendChild(waitingMessage);
        
        container.appendChild(searchingContainer);
    }
    
    // Show exercise content
    function showExerciseContent(container) {
        if (!exerciseData) {
            console.log('Altissia Wizard: No exercise data available');
            return;
        }
        
        console.log('Altissia Wizard: Processing exercise data', exerciseData);
        
        // Extract items/questions
        const items = exerciseData.content?.items;
        if (!items || items.length === 0) {
            container.innerHTML = '<p style="color: #666; padding: 15px; text-align: center;">No questions found</p>';
            console.log('Altissia Wizard: No items/questions found in exercise data');
            return;
        }
        
        console.log('Altissia Wizard: Found', items.length, 'questions');
        
        // Create questions and answers
        items.forEach((item, index) => {
            const questionBox = document.createElement('div');
            questionBox.className = 'question-box';
            
            // Question number and exercise type
            const questionElement = document.createElement('div');
            questionElement.className = 'question';
            
            // Add question text based on type
            const questionText = document.createElement('div');
            questionText.style.marginBottom = '10px';
            questionText.innerHTML = `<strong>Question ${index + 1}</strong>`;
            
            questionElement.appendChild(questionText);
            questionBox.appendChild(questionElement);
            
            // Create answers container
            const answersContainer = document.createElement('div');
            answersContainer.className = 'answers';
            
            // Process correct answers based on question type
            if (item.type === 'DRAG_AND_DROP') {
                if (item.correctAnswers && item.correctAnswers.length > 0 && item.correctAnswers[0].length > 0) {
                    // Show the correct order
                    const answerText = item.correctAnswers[0][0]; // First correct answer
                    
                    const answerOrderedDiv = document.createElement('div');
                    answerOrderedDiv.className = 'answer-ordered';
                    answerOrderedDiv.textContent = answerText;
                    
                    answersContainer.appendChild(answerOrderedDiv);
                    
                    // If the question has items to arrange, show them too
                    if (item.answers && item.answers[0] && item.answers[0].length > 0) {
                        const elementsDiv = document.createElement('div');
                        elementsDiv.className = 'drag-elements';
                        
                        item.answers[0].forEach(element => {
                            const elementDiv = document.createElement('span');
                            elementDiv.className = 'drag-element';
                            elementDiv.textContent = element;
                            elementsDiv.appendChild(elementDiv);
                        });
                        
                        answersContainer.appendChild(elementsDiv);
                    }
                } else {
                    // No correct answer found
                    const noAnswer = document.createElement('div');
                    noAnswer.style.color = '#666';
                    noAnswer.style.fontStyle = 'italic';
                    noAnswer.textContent = 'No correct order found';
                    answersContainer.appendChild(noAnswer);
                }
            } else {
                // Handle gap-filling or other question types
                if (item.correctAnswers && item.correctAnswers.length > 0) {
                    console.log('Altissia Wizard: Processing answers for question', index + 1, item.correctAnswers);
                    
                    // Handle multiple gaps (usually arrays of arrays)
                    item.correctAnswers.forEach((answerGroup, groupIndex) => {
                        if (answerGroup && answerGroup.length > 0) {
                            if (groupIndex > 0) {
                                // Add gap number for multiple gaps
                                const gapLabel = document.createElement('div');
                                gapLabel.style.marginTop = '8px';
                                gapLabel.style.fontWeight = 'bold';
                                gapLabel.style.fontSize = '13px';
                                gapLabel.textContent = `Gap ${groupIndex + 1}:`;
                                answersContainer.appendChild(gapLabel);
                            }
                            
                            // Add all possible answers for this gap
                            answerGroup.forEach((answer, ansIndex) => {
                                const answerItem = document.createElement('div');
                                answerItem.className = 'answer-item';
                                answerItem.textContent = answer;
                                
                                // Add OR text between answers
                                if (ansIndex > 0) {
                                    const orText = document.createElement('div');
                                    orText.className = 'or-text';
                                    orText.textContent = 'OR';
                                    answersContainer.appendChild(orText);
                                }
                                
                                answersContainer.appendChild(answerItem);
                            });
                        }
                    });
                } else {
                    // No correct answers found
                    const noAnswer = document.createElement('div');
                    noAnswer.style.color = '#666';
                    noAnswer.style.fontStyle = 'italic';
                    noAnswer.textContent = 'No correct answer found';
                    answersContainer.appendChild(noAnswer);
                    console.log('Altissia Wizard: No correct answers found for question', index + 1);
                }
            }
            
            questionBox.appendChild(answersContainer);
            container.appendChild(questionBox);
        });
        
        console.log('Altissia Wizard: Content updated successfully');
    }
    
    // Format drag and drop question
    function formatDragAndDropQuestion(item) {
        if (!item.question) return 'Order the elements correctly';
        
        // For drag and drop, we simply show a placeholder since
        // the question is usually just [GAP][GAP]...
        return 'Put the elements in the correct order';
    }
    
    // Format question text by replacing [GAP] placeholders
    function formatQuestion(questionText) {
        if (!questionText) return '';
        
        // Replace [GAP] with a styled gap placeholder
        return questionText.replace(/\[GAP\]/g, 
            '<span style="display: inline-block; background: #f0f0f0; border: 1px dashed #aaa; border-radius: 3px; padding: 0 5px; margin: 0 3px; color: #999;">___</span>');
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
