(function() {
    const LESSON_URL_PATTERN = /\/gw\/lcapi\/main\/api\/lc\/lessons\/(.*?)$/;
    const EXERCISE_URL_PATTERN = /\/gw\/lcapi\/main\/api\/lc\/exercises\/(.*?)$/;
    const ACTIVITY_PAGE_PATTERN = /https:\/\/app\.ofppt-langues\.ma\/platform\/learning-path\/mission\/.*\/lesson\/.*\/activity\/.*/;
    const LESSON_PAGE_PATTERN = /https:\/\/app\.ofppt-langues\.ma\/platform\/learning-path\/mission\/.*\/lesson\/[^\/]*$/;
    const ASSESSMENT_PAGE_PATTERN = /https:\/\/app\.ofppt-langues\.ma\/platform\/retake\/language-assessment.*/;
    const ASSESSMENT_API_PATTERN = /\/gw\/languageassessmentapi\/main\/api\/la\/internal\/language-assessments\/.*\/ques/;
    const LISTENING_AUDIO_PATTERN = /https:\/\/app\.ofppt-langues\.ma\/dataLevelTest\/data\/.*\/sounds\/.*\.blu/;
    console.log('Altissia Network Interceptor Initialized');

    // Store the exercise data we intercept
    let lastExerciseData = null;
    
    // Store the latest assessment question
    let lastAssessmentData = null;
    
    // Store detected audio file URLs for listening comprehension
    let detectedAudioUrls = new Set();

    // Check if we're on an activity page
    function isActivityPage() {
        return ACTIVITY_PAGE_PATTERN.test(window.location.href);
    }

    // Check if we're on a lesson page
    function isLessonPage() {
        return LESSON_PAGE_PATTERN.test(window.location.href);
    }
    
    // Check if we're on an assessment page
    function isAssessmentPage() {
        return ASSESSMENT_PAGE_PATTERN.test(window.location.href);
    }
    
    // Log current page type on initialization
    console.log('Current page is activity page:', isActivityPage());
    console.log('Current page is lesson page:', isLessonPage());
    console.log('Current page is assessment page:', isAssessmentPage());

    // Create a function to process the intercepted response
    function processExerciseData(responseData) {
        try {
            if (responseData && responseData.content && responseData.content.items) {
                console.log('Exercise data intercepted:', responseData.title);
                lastExerciseData = responseData;
                
                // Notify content script about the new data
                window.postMessage({
                    type: 'ALTISSIA_EXERCISE_DATA',
                    data: responseData
                }, '*');
                
                // Send another message after a short delay to ensure it's received
                setTimeout(() => {
                    window.postMessage({
                        type: 'ALTISSIA_EXERCISE_DATA',
                        data: responseData
                    }, '*');
                }, 500);
            }
        } catch (error) {
            console.error('Error processing exercise data:', error);
        }
    }

    // Process assessment question data
    function processAssessmentData(questionData) {
        try {
            if (questionData && questionData.question) {
                console.log('Assessment question intercepted:', questionData.question.uuid);
                
                // Check if this is a listening comprehension question
                const isListeningComprehension = questionData.question.uuidSound && questionData.question.uuidSound.length > 0;
                
                if (isListeningComprehension) {
                    console.log('Listening comprehension question detected with audio ID:', questionData.question.uuidSound);
                    
                    // Construct the audio URL
                    const audioUrl = constructAudioUrl(questionData.question.uuidSound);
                    
                    // Add to our set of detected audio URLs
                    if (audioUrl) {
                        detectedAudioUrls.add(audioUrl);
                        console.log('Added audio URL to detection list:', audioUrl);
                    }
                }
                
                lastAssessmentData = questionData;
                
                // Notify content script about the assessment question
                window.postMessage({
                    type: 'ALTISSIA_ASSESSMENT_DATA',
                    data: questionData
                }, '*');
            }
        } catch (error) {
            console.error('Error processing assessment data:', error);
        }
    }
    
    // Helper function to construct audio URL
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

    // Use the Fetch API to intercept network requests
    const originalFetch = window.fetch;
    window.fetch = async function(input, init) {
        const response = await originalFetch(input, init);
        
        // Clone the response so we can read it and still return the original
        const responseClone = response.clone();
        
        try {
            const url = typeof input === 'string' ? input : input.url;
            
            // Check if this is an exercise API call
            if (url && (EXERCISE_URL_PATTERN.test(url) || LESSON_URL_PATTERN.test(url))) {
                responseClone.json().then(data => {
                    processExerciseData(data);
                }).catch(error => {
                    console.error('Error parsing response:', error);
                });
            }
            
            // Check if this is an assessment question API call
            if (url && ASSESSMENT_API_PATTERN.test(url)) {
                responseClone.json().then(data => {
                    processAssessmentData(data);
                }).catch(error => {
                    console.error('Error parsing assessment response:', error);
                });
            }
            
            // Check if this is a listening comprehension audio file
            if (url && LISTENING_AUDIO_PATTERN.test(url)) {
                console.log('Intercepted listening comprehension audio request:', url);
                // Add to detected audio URLs
                detectedAudioUrls.add(url);
            }
        } catch (error) {
            console.error('Error in fetch interceptor:', error);
        }
        
        return response;
    };

    // Intercept XMLHttpRequest as a fallback
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;
    
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        this._altissiaUrl = url;
        return originalXHROpen.apply(this, [method, url, ...rest]);
    };
    
    XMLHttpRequest.prototype.send = function(...args) {
        if (this._altissiaUrl && (EXERCISE_URL_PATTERN.test(this._altissiaUrl) || LESSON_URL_PATTERN.test(this._altissiaUrl))) {
            const originalOnReadyStateChange = this.onreadystatechange;
            this.onreadystatechange = function() {
                if (this.readyState === 4 && this.status === 200) {
                    try {
                        const data = JSON.parse(this.responseText);
                        processExerciseData(data);
                    } catch (error) {
                        console.error('Error parsing XHR response:', error);
                    }
                }
                if (originalOnReadyStateChange) {
                    originalOnReadyStateChange.apply(this, arguments);
                }
            };
        }
        
        // Handle assessment API calls
        if (this._altissiaUrl && ASSESSMENT_API_PATTERN.test(this._altissiaUrl)) {
            const originalOnReadyStateChange = this.onreadystatechange;
            this.onreadystatechange = function() {
                if (this.readyState === 4 && this.status === 200) {
                    try {
                        const data = JSON.parse(this.responseText);
                        processAssessmentData(data);
                    } catch (error) {
                        console.error('Error parsing assessment XHR response:', error);
                    }
                }
                if (originalOnReadyStateChange) {
                    originalOnReadyStateChange.apply(this, arguments);
                }
            };
        }
        
        // Monitor for audio file requests
        if (this._altissiaUrl && LISTENING_AUDIO_PATTERN.test(this._altissiaUrl)) {
            console.log('Intercepted XHR audio request:', this._altissiaUrl);
            detectedAudioUrls.add(this._altissiaUrl);
        }
        
        return originalXHRSend.apply(this, args);
    };

    // Handle requests from content script
    window.addEventListener('message', function(event) {
        // Only respond to messages from our extension
        if (event.data && event.data.type === 'GET_ALTISSIA_EXERCISE_DATA') {
            console.log('Interceptor: Received request for exercise data');
            // Send the latest exercise data back to content script
            if (lastExerciseData) {
                console.log('Interceptor: Sending stored exercise data back to content script');
                window.postMessage({
                    type: 'ALTISSIA_EXERCISE_DATA',
                    data: lastExerciseData
                }, '*');
            } else {
                console.log('Interceptor: No stored exercise data available');
            }
        } else if (event.data && event.data.type === 'GET_ALTISSIA_ASSESSMENT_DATA') {
            console.log('Interceptor: Received request for assessment data');
            // Send the latest assessment question data back to content script
            if (lastAssessmentData) {
                console.log('Interceptor: Sending stored assessment data back to content script');
                window.postMessage({
                    type: 'ALTISSIA_ASSESSMENT_DATA',
                    data: lastAssessmentData
                }, '*');
            } else {
                console.log('Interceptor: No stored assessment data available');
            }
        }
    });
    
    // Watch for URL changes to detect page navigation
    let lastUrl = window.location.href;
    
    // Function to check if URL has changed
    function checkUrlChange() {
        const currentUrl = window.location.href;
        if (currentUrl !== lastUrl) {
            const previousUrl = lastUrl;
            lastUrl = currentUrl;
            console.log('Interceptor: URL changed from', previousUrl, 'to', currentUrl);
            
            const wasActivityPage = ACTIVITY_PAGE_PATTERN.test(previousUrl);
            const isNowActivityPage = isActivityPage();
            const wasLessonPage = LESSON_PAGE_PATTERN.test(previousUrl);
            const isNowLessonPage = isLessonPage();
            const wasAssessmentPage = ASSESSMENT_PAGE_PATTERN.test(previousUrl);
            const isNowAssessmentPage = isAssessmentPage();
            
            // Check if we're moving between different page types
            const pageTypeChanged = 
                (wasActivityPage && !isNowActivityPage) || 
                (wasLessonPage && !isNowLessonPage) ||
                (wasAssessmentPage && !isNowAssessmentPage) ||
                (!wasActivityPage && !wasLessonPage && !wasAssessmentPage && 
                 (isNowActivityPage || isNowLessonPage || isNowAssessmentPage));
            
            // Clear the exercise data when changing page types
            if (pageTypeChanged) {
                if (lastExerciseData) {
                    console.log('Interceptor: Page type changed, clearing exercise data');
                    lastExerciseData = null;
                    
                    // Notify content script that data was cleared
                    window.postMessage({
                        type: 'ALTISSIA_EXERCISE_DATA_CLEARED'
                    }, '*');
                }
                
                // Clear assessment data if we're leaving an assessment page
                if (wasAssessmentPage && !isNowAssessmentPage && lastAssessmentData) {
                    console.log('Interceptor: Leaving assessment page, clearing assessment data');
                    lastAssessmentData = null;
                }
            }
            
            // If we have stored exercise data and we're on an activity page, send it
            if (lastExerciseData && isNowActivityPage) {
                // Add a slight initial delay
                setTimeout(() => {
                    console.log('Interceptor: Sending stored exercise data after page change');
                    window.postMessage({
                        type: 'ALTISSIA_EXERCISE_DATA',
                        data: lastExerciseData
                    }, '*');
                }, 500);
                
                // Try again after a longer delay in case of slow page loading
                setTimeout(() => {
                    window.postMessage({
                        type: 'ALTISSIA_EXERCISE_DATA',
                        data: lastExerciseData
                    }, '*');
                }, 2000);
            } else if (isNowActivityPage) {
                // If we're on an activity page but don't have exercise data yet,
                // check for data in the page
                setTimeout(() => {
                    tryToFindExerciseDataInPage();
                }, 1000);
                
                // Try again after a longer delay
                setTimeout(() => {
                    tryToFindExerciseDataInPage();
                }, 3000);
            }
            
            // If we have stored assessment data and we're on an assessment page, send it
            if (lastAssessmentData && isNowAssessmentPage) {
                setTimeout(() => {
                    console.log('Interceptor: Sending stored assessment data after page change');
                    window.postMessage({
                        type: 'ALTISSIA_ASSESSMENT_DATA',
                        data: lastAssessmentData
                    }, '*');
                }, 500);
            }
        }
        
        setTimeout(checkUrlChange, 500); // Check more frequently
    }
    
    // Try to find exercise data in the page - used for activity pages
    function tryToFindExerciseDataInPage() {
        try {
            console.log('Interceptor: Actively looking for exercise data in page');
            // Look for common data structures in the page that might contain exercise data
            const possibleData = 
                window.__NEXT_DATA__?.props?.pageProps?.activity || 
                window.__INITIAL_STATE__?.activity || 
                window.appData?.activity;
                
            if (possibleData && possibleData.content && possibleData.content.items) {
                console.log('Interceptor: Found existing exercise data on page');
                processExerciseData(possibleData);
                return true;
            }
            
            // Look for exercise data in network response cache
            if (window.performance && window.performance.getEntriesByType) {
                const resources = window.performance.getEntriesByType('resource');
                console.log('Interceptor: Checking', resources.length, 'network resources for exercise data');
            }
            
            return false;
        } catch (error) {
            console.error('Error looking for existing exercise data:', error);
            return false;
        }
    }
    
    // Start URL change detection
    checkUrlChange();
    
    // If we already have exercise data on the page, try to detect it
    setTimeout(() => {
        tryToFindExerciseDataInPage();
    }, 1000);
})(); 