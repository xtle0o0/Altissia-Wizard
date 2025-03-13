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
        LESSON: /https:\/\/app\.ofppt-langues\.ma\/platform\/learning-path\/mission\/.*\/lesson\/[^\/]*$/,
        ACTIVITY: /https:\/\/app\.ofppt-langues\.ma\/platform\/learning-path\/mission\/.*\/lesson\/.*\/activity\/.*/,
        ASSESSMENT: /https:\/\/app\.ofppt-langues\.ma\/platform\/retake\/language-assessment.*/
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
        
        // Inject Gemini AI script for assessment pages
        injectGeminiAIScript();
        
        // Create wizard UI
        createWizardUI();
        
        // Listen for messages from the interceptor
        setupMessageListener();
        
        // If on activity page, aggressively try to get exercise data
        if (currentPage === 'activity') {
            console.log('Altissia Wizard: On activity page, setting up multiple data fetching attempts');
            
            // Request exercise data immediately and then at intervals
            requestExerciseData();
            
            // Set up multiple attempts to fetch data
            const fetchIntervals = [500, 1000, 2000, 4000];
            fetchIntervals.forEach(interval => {
                setTimeout(() => {
                    if (!exerciseData) {
                        console.log(`Altissia Wizard: Re-attempting data fetch after ${interval}ms`);
                        requestExerciseData();
                    }
                }, interval);
            });
        } else if (currentPage === 'assessment') {
            // For assessment pages, we need to set up additional listeners
            console.log('Altissia Wizard: On assessment page, setting up for exam assistance');
            requestAssessmentData();
        } else {
            // For other pages, just request once with a delay
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
        }
        
        // Add URL change listener for SPAs
        setupURLChangeDetection();
        
        console.log('Altissia Wizard: Initialization complete');
    }
    
    // Detect the current page based on URL
    function detectCurrentPage() {
        const url = window.location.href;
        
        const prevPage = currentPage;
        
        if (URL_PATTERNS.ACTIVITY.test(url)) {
            currentPage = 'activity';
        } else if (URL_PATTERNS.LESSON.test(url)) {
            currentPage = 'lesson';
        } else if (URL_PATTERNS.ASSESSMENT.test(url)) {
            currentPage = 'assessment';
        } else {
            currentPage = 'unknown';
        }
        
        // Log page change if page type changed
        if (prevPage !== currentPage) {
            console.log(`Altissia Wizard: Page type changed from "${prevPage}" to "${currentPage}"`);
        }
        
        // Log the current page to ensure it's being detected correctly
        console.log('Current page type detected as:', currentPage, 'URL:', url);
    }
    
    // Setup detection for URL changes (for single page apps)
    function setupURLChangeDetection() {
        // Create an observer instance
        const observer = new MutationObserver(function(mutations) {
            const currentURL = window.location.href;
            
            // If URL has changed
            if (currentURL !== lastURL) {
                const oldURL = lastURL;
                lastURL = currentURL;
                console.log('Altissia Wizard: URL changed from', oldURL, 'to', currentURL);
                
                // Update current page detection
                const oldPage = currentPage;
                detectCurrentPage();
                
                // Clear exercise data if we're moving from activity to non-activity page
                if (oldPage === 'activity' && currentPage !== 'activity') {
                    console.log('Altissia Wizard: Moving away from activity page, clearing exercise data');
                    exerciseData = null;
                }
                
                // If we just navigated to an activity page, aggressively try to get data
                if (currentPage === 'activity' && oldPage !== 'activity') {
                    console.log('Altissia Wizard: Navigated to activity page, setting up multiple data fetching attempts');
                    
                    // Request exercise data immediately and then at intervals
                    requestExerciseData();
                    
                    // Set up multiple attempts to fetch data
                    const fetchIntervals = [500, 1000, 2000, 4000];
                    fetchIntervals.forEach(interval => {
                        setTimeout(() => {
                            if (!exerciseData) {
                                console.log(`Altissia Wizard: Re-attempting data fetch after ${interval}ms`);
                                requestExerciseData();
                            }
                        }, interval);
                    });
                }
                
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
            const oldPage = currentPage;
            detectCurrentPage();
            
            // Clear exercise data if page type changed
            if (oldPage !== currentPage) {
                exerciseData = null;
            }
            
            updateWizardContent();
            
            // If on activity page, try to get data
            if (currentPage === 'activity') {
                requestExerciseData();
            }
        });
        
        window.addEventListener('hashchange', function() {
            const oldPage = currentPage;
            detectCurrentPage();
            
            // Clear exercise data if page type changed
            if (oldPage !== currentPage) {
                exerciseData = null;
            }
            
            updateWizardContent();
            
            // If on activity page, try to get data
            if (currentPage === 'activity') {
                requestExerciseData();
            }
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
    
    // Inject Gemini AI Script
    function injectGeminiAIScript() {
        try {
            const script = document.createElement('script');
            script.src = chrome.runtime.getURL('geminiAI.js');
            script.onload = function() {
                this.remove();
                console.log('Altissia Wizard: Gemini AI script injected and loaded');
            };
            (document.head || document.documentElement).appendChild(script);
        } catch (error) {
            console.error('Altissia Wizard: Error injecting Gemini AI script:', error);
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
                
                // Ensure current page is correctly detected
                detectCurrentPage();
                
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
            } else if (event.data.type === 'ALTISSIA_EXERCISE_DATA_CLEARED') {
                // Clear exercise data when navigating away from activity pages
                exerciseData = null;
                console.log('Altissia Wizard: Exercise data cleared');
                
                // Ensure current page is correctly detected
                detectCurrentPage();
                
                updateWizardContent();
            } else if (event.data.type === 'ALTISSIA_ASSESSMENT_DATA') {
                // Handle assessment question data
                console.log('Altissia Wizard: Received assessment question data');
                
                const assessmentData = event.data.data;
                showAssessmentAnswer(assessmentData);
            } else if (event.data.type === 'GEMINI_AI_ANSWER') {
                // Handle answers from Gemini AI
                console.log('Altissia Wizard: Received Gemini AI answer');
                
                const answerData = event.data.data;
                updateAssessmentAnswer(answerData);
            } else if (event.data.type === 'REQUEST_GEMINI_ANALYSIS') {
                // Handle request from geminiAI.js to analyze with the background script
                console.log('Altissia Wizard: Received request for Gemini analysis');
                
                const questionData = event.data.data;
                
                // Send request to background script
                chrome.runtime.sendMessage({
                    type: 'ANALYZE_WITH_GEMINI_BACKGROUND',
                    data: questionData
                }, function(response) {
                    if (chrome.runtime.lastError) {
                        console.error('Altissia Wizard: Error sending message to background script:', chrome.runtime.lastError);
                        sendGeminiAnalysisError(questionData, chrome.runtime.lastError.message);
                        return;
                    }
                    
                    if (response && response.error) {
                        console.error('Altissia Wizard: Error from background script:', response.error);
                        sendGeminiAnalysisError(questionData, response.error);
                        return;
                    }
                    
                    console.log('Altissia Wizard: Received answer from background script', response);
                    
                    // Send the result back to geminiAI.js script
                    window.postMessage({
                        type: 'GEMINI_ANALYSIS_RESULT',
                        questionData: questionData,
                        data: response
                    }, '*');
                });
            }
        });
    }
    
    // Helper function to send error back to geminiAI.js
    function sendGeminiAnalysisError(questionData, errorMessage) {
        window.postMessage({
            type: 'GEMINI_ANALYSIS_RESULT',
            questionData: questionData,
            data: {
                error: errorMessage,
                answer: 'Error analyzing question',
                explanation: `An error occurred: ${errorMessage}`,
                confidence: 0
            }
        }, '*');
    }
    
    // Request exercise data from interceptor
    function requestExerciseData() {
        console.log('Altissia Wizard: Requesting exercise data from interceptor');
        window.postMessage({ type: 'GET_ALTISSIA_EXERCISE_DATA' }, '*');
    }
    
    // Request assessment data from interceptor
    function requestAssessmentData() {
        console.log('Altissia Wizard: Requesting assessment data from interceptor');
        window.postMessage({ type: 'GET_ALTISSIA_ASSESSMENT_DATA' }, '*');
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
        
        console.log('Altissia Wizard: Updating wizard content, current children count:', contentArea.childElementCount);
        
        // Save feature-toggles element if it exists
        const featureToggles = contentArea.querySelector('.feature-toggles');
        
        // Completely clear content area
        contentArea.innerHTML = '';
        
        // Re-add feature-toggles if it existed
        if (featureToggles) {
            contentArea.appendChild(featureToggles);
        }
        
        // Always re-check current page before updating content
        detectCurrentPage();
        
        console.log('Altissia Wizard: Content area cleared, now updating based on current page:', currentPage, 
                   'Exercise data present:', !!exerciseData);
        
        if (exerciseData && exerciseData.content && exerciseData.content.items) {
            // If we have exercise data, always show it regardless of page type
            showExerciseContent(contentArea);
            
            // Make sure the wizard is expanded if it was minimized
            if (isMinimized) {
                toggleMinimize();
            }
            
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
            // On activity pages, don't show any waiting message - let the UI be clean until answers are available
            console.log('Altissia Wizard: On activity page, waiting for exercise data, showing nothing');
            
            // Auto-minimize the wizard when there's no data on activity pages
            if (!isMinimized) {
                toggleMinimize();
            }
        } else if (currentPage === 'assessment') {
            // On assessment pages, show a waiting message for exam assistance
            showAssessmentWaiting(contentArea);
            
            // Make sure the wizard is expanded on assessment pages
            if (isMinimized) {
                toggleMinimize();
            }
        } else {
            // On lesson pages, show the waiting animation
            showWaitingAnimation(contentArea);
            
            // Make sure the wizard is expanded on lesson pages
            if (isMinimized) {
                toggleMinimize();
            }
        }
        
        console.log('Altissia Wizard: Content updated successfully');
    }
    
    // Show the waiting animation
    function showWaitingAnimation(container) {
        console.log('Altissia Wizard: Adding waiting animation to container');
        
        // Create a single container for everything
        const waitingContainer = document.createElement('div');
        waitingContainer.className = 'waiting-container';
        waitingContainer.style.textAlign = 'center';
        
        // Add title/header
        const waitingTitle = document.createElement('div');
        waitingTitle.className = 'waiting-text';
        waitingTitle.textContent = 'Waiting for exercise...';
        waitingTitle.style.fontWeight = 'bold';
        waitingTitle.style.marginBottom = '15px';
        waitingContainer.appendChild(waitingTitle);
        
        // Add single eye
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
        waitingContainer.appendChild(eye);
        
        // Add message
        const waitingMessage = document.createElement('div');
        waitingMessage.className = 'waiting-message';
        waitingMessage.innerHTML = 'Please answer at least one question<br>to activate Altissia Wizard';
        waitingMessage.style.marginTop = '15px';
        waitingMessage.style.fontSize = '13px';
        waitingContainer.appendChild(waitingMessage);
        
        // Add to main container
        container.appendChild(waitingContainer);
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
        
        // Add header with exercise title
        const exerciseHeader = document.createElement('div');
        exerciseHeader.className = 'exercise-header';
        exerciseHeader.textContent = exerciseData.title || 'Exercise';
        container.appendChild(exerciseHeader);
        
        // Process each question/item
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
    
    // Show waiting message for assessment pages
    function showAssessmentWaiting(container) {
        console.log('Altissia Wizard: Adding assessment waiting message');
        
        // Create a container for the assessment waiting message
        const assessmentContainer = document.createElement('div');
        assessmentContainer.className = 'assessment-container';
        assessmentContainer.style.textAlign = 'center';
        assessmentContainer.style.padding = '20px 10px';
        
        // Add title
        const title = document.createElement('div');
        title.className = 'assessment-title';
        title.textContent = 'Exam Assistant';
        title.style.fontWeight = 'bold';
        title.style.fontSize = '16px';
        title.style.marginBottom = '15px';
        assessmentContainer.appendChild(title);
        
        // Add message
        const message = document.createElement('div');
        message.className = 'assessment-message';
        message.innerHTML = 'Waiting for exam questions...<br>I\'ll help you when they appear!';
        message.style.color = '#666';
        message.style.marginBottom = '15px';
        assessmentContainer.appendChild(message);
        
        // Add an icon or image
        const icon = document.createElement('div');
        icon.innerHTML = '🧠';
        icon.style.fontSize = '32px';
        icon.style.margin = '10px 0';
        assessmentContainer.appendChild(icon);
        
        // Add to main container
        container.appendChild(assessmentContainer);
    }
    
    // Show assessment answer from Gemini AI
    function showAssessmentAnswer(assessmentData) {
        console.log('Altissia Wizard: Showing assessment answer for question', assessmentData);
        
        if (!wizardDiv) return;
        
        const contentArea = wizardDiv.querySelector('.wizard-content');
        if (!contentArea) return;
        
        // Save feature-toggles element if it exists
        const featureToggles = contentArea.querySelector('.feature-toggles');
        
        // Completely clear content area
        contentArea.innerHTML = '';
        
        // Re-add feature-toggles if it existed
        if (featureToggles) {
            contentArea.appendChild(featureToggles);
        }
        
        // Create container for assessment
        const assessmentContainer = document.createElement('div');
        assessmentContainer.className = 'assessment-container';
        assessmentContainer.style.padding = '15px 10px';
        
        // Add title
        const title = document.createElement('div');
        title.className = 'assessment-title';
        title.textContent = 'Exam Assistant';
        title.style.fontWeight = 'bold';
        title.style.fontSize = '16px';
        title.style.marginBottom = '15px';
        title.style.borderBottom = '1px solid #eee';
        title.style.paddingBottom = '10px';
        assessmentContainer.appendChild(title);
        
        // Add question information
        const questionInfo = document.createElement('div');
        questionInfo.className = 'question-info';
        
        // Format the question text to highlight the gap
        let questionText = assessmentData.question.question || '';
        questionText = questionText.replace('[GAP]', '<span style="background: #e8f5e9; padding: 2px 5px; border-radius: 3px; font-weight: bold;">___</span>');
        
        // Check if this is an open-ended question
        const isOpenQuestion = assessmentData.question.type === 'OPEN' || (assessmentData.question.answers && assessmentData.question.answers.length === 0);
        
        // Check if this is a listening comprehension question
        const isListeningComprehension = assessmentData.question.uuidSound && assessmentData.question.uuidSound.length > 0;
        
        // Get any specific instructions
        const specificInstruction = assessmentData.question.specificInstruction || '';
        const specificInstructionGap = assessmentData.question.specificInstructionGap || '';
        
        // Create HTML for the question info - different for open vs. multiple choice
        let questionInfoHTML = `
            <div style="font-weight: bold; margin-bottom: 5px;">Question:</div>
            <div style="margin-bottom: 15px; color: #333;">${questionText}</div>
        `;
        
        // Add audio player for listening comprehension questions
        if (isListeningComprehension) {
            const audioUrl = constructAudioUrl(assessmentData.question.uuidSound);
            
            questionInfoHTML += `
                <div style="margin-bottom: 15px;">
                    <div style="font-weight: bold; margin-bottom: 5px; color: #2196F3;">
                        <span style="margin-right: 5px;">🎧</span> Listening Comprehension
                    </div>
                    <div style="background: #e3f2fd; padding: 10px; border-radius: 5px; display: flex; flex-direction: column; align-items: center;">
                        <audio controls style="width: 100%; margin-bottom: 5px;">
                            <source src="${audioUrl}" type="audio/mpeg">
                            Your browser does not support the audio element.
                        </audio>
                        <div style="font-size: 12px; color: #666; text-align: center;">
                            Listen carefully and select the best answer based on the audio.
                        </div>
                    </div>
                </div>
            `;
        }
        
        // Add specific instructions if available
        if (specificInstruction || specificInstructionGap) {
            questionInfoHTML += `
                <div style="font-weight: bold; margin-bottom: 5px;">Instruction:</div>
                <div style="margin-bottom: 15px; color: #666; font-style: italic;">
                    ${specificInstruction ? specificInstruction : ''}
                    ${specificInstructionGap ? ' (Expected: ' + specificInstructionGap + ')' : ''}
                </div>
            `;
        }
        
        // For multiple choice questions, add the options
        if (!isOpenQuestion && assessmentData.question.answers && assessmentData.question.answers.length > 0) {
            questionInfoHTML += `
                <div style="font-weight: bold; margin-bottom: 5px;">Options:</div>
                <ul style="margin-bottom: 15px; padding-left: 20px;">
                    ${assessmentData.question.answers.map(answer => `<li>${answer}</li>`).join('')}
                </ul>
            `;
        }
        
        questionInfo.innerHTML = questionInfoHTML;
        assessmentContainer.appendChild(questionInfo);
        
        // Add a separator
        const separator = document.createElement('div');
        separator.style.borderTop = '1px dashed #ddd';
        separator.style.margin = '15px 0';
        assessmentContainer.appendChild(separator);
        
        // Add Gemini AI answer section (initially loading)
        const answerSection = document.createElement('div');
        answerSection.className = 'answer-section';
        answerSection.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 5px;">Gemini AI Suggestion:</div>
            <div id="gemini-answer" style="display: flex; align-items: center; justify-content: center; padding: 15px; background: #f5f5f5; border-radius: 5px; color: #666;">
                <div class="loading-spinner" style="border: 3px solid #eee; border-top: 3px solid #4CAF50; border-radius: 50%; width: 20px; height: 20px; margin-right: 10px; animation: spin 2s linear infinite;"></div>
                Analyzing question...
            </div>
        `;
        assessmentContainer.appendChild(answerSection);
        
        // Add style for spinner animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        assessmentContainer.appendChild(style);
        
        // Add to main container
        contentArea.appendChild(assessmentContainer);
        
        // Make sure the wizard is visible and expanded
        if (isMinimized) {
            toggleMinimize();
        }
        
        // Send to Gemini AI for analysis
        window.postMessage({
            type: 'ANALYZE_WITH_GEMINI',
            data: assessmentData
        }, '*');
    }
    
    // Helper function to construct the audio URL
    function constructAudioUrl(uuidSound) {
        if (!uuidSound) return '';
        
        // Extract language code from UUID if it has a format like "EN_GB_LISTENING_..."
        const parts = uuidSound.split('_');
        let langCode = 'en';
        
        if (parts.length >= 2) {
            langCode = parts[0].toLowerCase();
        }
        
        return `https://app.ofppt-langues.ma/dataLevelTest/data/${langCode}/sounds/${uuidSound}.blu`;
    }
    
    // Update assessment answer with Gemini AI response
    function updateAssessmentAnswer(answerData) {
        console.log('Altissia Wizard: Updating assessment answer with Gemini response', answerData);
        
        const answerElement = document.getElementById('gemini-answer');
        if (!answerElement) return;
        
        const { questionData, answer, confidence, explanation, isListeningComprehension } = answerData;
        
        // Create confidence color based on confidence level
        let confidenceColor = '#4CAF50'; // High confidence (green)
        let confidenceLabel = 'High';
        
        if (confidence < 0.7) {
            confidenceColor = '#FFC107'; // Medium confidence (amber)
            confidenceLabel = 'Medium';
        }
        if (confidence < 0.4) {
            confidenceColor = '#F44336'; // Low confidence (red)
            confidenceLabel = 'Low';
        }
        
        // Check if this is an open-ended question
        const isOpenQuestion = questionData.question.type === 'OPEN' || 
                              (questionData.question.answers && questionData.question.answers.length === 0);
        
        // Update the answer element - common header for both types
        answerElement.style.display = 'block';
        answerElement.style.background = '#fff';
        answerElement.style.border = '1px solid #e0e0e0';
        answerElement.style.borderRadius = '5px';
        answerElement.style.padding = '0';
        
        let answerHTML = `
            <div style="padding: 10px; border-bottom: 1px solid #eee;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="font-weight: bold;">Suggested Answer:${isListeningComprehension ? ' (Based on Listening)' : ''}</div>
                    <div style="background: ${confidenceColor}25; color: ${confidenceColor}; padding: 3px 8px; border-radius: 10px; font-size: 12px; font-weight: bold;">${confidenceLabel} Confidence</div>
                </div>
            </div>
        `;
        
        // Different display for open vs multiple choice questions
        if (isOpenQuestion) {
            // For open-ended questions, show the answer prominently
            answerHTML += `
                <div style="padding: 15px;">
                    <div style="background: ${confidenceColor}25; border-left: 4px solid ${confidenceColor}; padding: 12px; margin: 5px 0; border-radius: 3px; font-weight: bold; font-size: 16px; text-align: center;">
                        ${answer}
                    </div>
                </div>
            `;
        } else {
            // For multiple choice, list all options with the correct one highlighted
            const options = questionData.question.answers || [];
            let optionsHtml = '';
            
            options.forEach(option => {
                if (option === answer) {
                    optionsHtml += `<div style="background: ${confidenceColor}25; border-left: 4px solid ${confidenceColor}; padding: 10px; margin: 5px 0; border-radius: 3px; font-weight: bold;">${option} ✓</div>`;
                } else {
                    optionsHtml += `<div style="padding: 8px; margin: 5px 0; color: #666;">${option}</div>`;
                }
            });
            
            answerHTML += `
                <div style="padding: 10px;">
                    ${optionsHtml}
                </div>
            `;
        }
        
        // Explanation section is common for both types
        answerHTML += `
            <div style="padding: 10px; border-top: 1px solid #eee; font-size: 12px; color: #666;">
                ${isListeningComprehension ? '<strong>Note:</strong> This answer is based on what would typically be discussed in this context, as the AI cannot directly hear the audio.<br><br>' : ''}
                <strong>Explanation:</strong> ${explanation || 'No explanation available.'}
            </div>
        `;
        
        answerElement.innerHTML = answerHTML;
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
