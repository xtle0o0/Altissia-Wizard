(function() {
    const LESSON_URL_PATTERN = /\/gw\/lcapi\/main\/api\/lc\/lessons\/(.*?)$/;
    const EXERCISE_URL_PATTERN = /\/gw\/lcapi\/main\/api\/lc\/exercises\/(.*?)$/;
    const ACTIVITY_PAGE_PATTERN = /https:\/\/app\.ofppt-langues\.ma\/platform\/learning-path\/mission\/.*\/lesson\/.*\/activity\/.*/;
    console.log('Altissia Network Interceptor Initialized');

    // Store the exercise data we intercept
    let lastExerciseData = null;

    // Check if we're on an activity page
    function isActivityPage() {
        return ACTIVITY_PAGE_PATTERN.test(window.location.href);
    }

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
        }
    });
    
    // Watch for URL changes to detect page navigation
    let lastUrl = window.location.href;
    
    // Function to check if URL has changed
    function checkUrlChange() {
        const currentUrl = window.location.href;
        if (currentUrl !== lastUrl) {
            lastUrl = currentUrl;
            console.log('Interceptor: URL changed to', currentUrl);
            
            // If we have stored exercise data and we're on an activity page, send it
            if (lastExerciseData && isActivityPage()) {
                setTimeout(() => {
                    window.postMessage({
                        type: 'ALTISSIA_EXERCISE_DATA',
                        data: lastExerciseData
                    }, '*');
                }, 1000);
            }
        }
        
        setTimeout(checkUrlChange, 1000);
    }
    
    // Start URL change detection
    checkUrlChange();
    
    // If we already have exercise data on the page, try to detect it
    setTimeout(() => {
        try {
            // Look for common data structures in the page that might contain exercise data
            const possibleData = 
                window.__NEXT_DATA__?.props?.pageProps?.activity || 
                window.__INITIAL_STATE__?.activity || 
                window.appData?.activity;
                
            if (possibleData && possibleData.content && possibleData.content.items) {
                console.log('Interceptor: Found existing exercise data on page');
                processExerciseData(possibleData);
            }
        } catch (error) {
            console.error('Error looking for existing exercise data:', error);
        }
    }, 1000);
})(); 