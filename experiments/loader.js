

// global function that experiments can call to continue
window.continueToNext = function() {
    console.log("Continue called, loading next component...");
    loadNextComponent();
};

// load translations from CSV
async function loadTranslations(language) {
    return new Promise((resolve, reject) => {
        const csvUrl = "./experiments/translations.csv";
        console.log("Loading translations for language:", language);

        Papa.parse(csvUrl, {
            download: true,
            header: true,
            complete: function(results) {
                const translations = {};
                results.data.forEach(row => {
                    if (!row.variable) return;
                    
                    // try to get HTML version first, then plain text
                    const htmlColumn = language + '_html';
                    const plainColumn = language;
                    
                    translations[row.variable] = row[htmlColumn] || row[plainColumn] || '';
                });
                resolve(translations);
            },
            error: function(error) {
                console.error("Error loading translations:", error);
                reject(error);
            }
        });
    });
}

function clearPreviousStyles() {
    // remove all dynamically added stylesheets (but keep the base page styles)
    const links = document.querySelectorAll('link[rel="stylesheet"]');
    links.forEach(link => {
        if (link.href.includes('jspsych') || link.href.includes('experiments') || link.href.includes('css/')) {
            link.remove();
        }
    });
    
    // remove ALL style tags (they will be re-added by the next experiment)
    const styles = document.querySelectorAll('style');
    styles.forEach(style => {
        style.remove();
    });
    
    // remove dynamically loaded scripts (but keep jatos.js and loader.js)
    const scripts = document.querySelectorAll('script[src]');
    scripts.forEach(script => {
        const src = script.getAttribute('src');
        if (src && !src.includes('jatos.js') && !src.includes('loader.js')) {
            script.remove();
        }
    });
    
    // clear the container completely
    const container = document.getElementById('experiment-container');
    if (container) {
        container.innerHTML = '';
        container.removeAttribute('style');
        container.removeAttribute('class');
    }
    
    // remove any jspsych-specific elements that might persist
    const jsPsychElements = document.querySelectorAll('[class*="jspsych"]');
    jsPsychElements.forEach(el => {
        if (el.id !== 'experiment-container') {
            el.remove();
        }
    });
}

async function loadNextComponent() {
    console.log("=== LOADING NEXT COMPONENT ===");

    try {
        // load JSON5 library
        const baseUrl = window.location.href.substring(0, window.location.href.lastIndexOf('/start'));
        const json5Path = baseUrl + '/experiments/json5.min.js';
        console.log("Loading JSON5 from:", json5Path);
        
        await loadScript(json5Path);
        
        // load config as JSON5
        const response = await fetch('STUDY_GERMANY/sequence_config.json5');
        const configText = await response.text();
        const config = JSON5.parse(configText);
        
        console.log("Config loaded:", config);

        // load translations if not already loaded
        if (!jatos.studySessionData.translations) {
            console.log("Loading translations for language:", config.language);
            const translations = await loadTranslations(config.language);
            jatos.studySessionData.translations = translations;
            await jatos.setStudySessionData(jatos.studySessionData);
        }

        // get current index
        let currentIndex = jatos.studySessionData.currentIndex || 0;

        if (currentIndex >= config.sequence.length) {
            console.log("All components complete. Ending study.");
            jatos.endStudy();
            return;
        }

        let sequenceItem = config.sequence[currentIndex];
        let htmlPath;

        // handle both string URLs and objects with url property
        if (typeof sequenceItem === 'string') {
            htmlPath = sequenceItem;
        } else if (sequenceItem && typeof sequenceItem === 'object' && sequenceItem.url) {
            htmlPath = sequenceItem.url;
            // store parameters for this component
            if (sequenceItem.restingDuration || sequenceItem.trialRepetitions) {
                jatos.studySessionData.componentParameters = {
                    restingDuration: sequenceItem.restingDuration,
                    trialRepetitions: sequenceItem.trialRepetitions
                };
                await jatos.setStudySessionData(jatos.studySessionData);
            }
        } else {
            console.error("Invalid sequence item:", sequenceItem);
            // skip to next
            jatos.studySessionData.currentIndex = currentIndex + 1;
            await jatos.setStudySessionData(jatos.studySessionData);
            await loadNextComponent();
            return;
        }

        console.log(`Loading component ${currentIndex + 1}/${config.sequence.length}:`, htmlPath);

        // make relative paths absolute
        if (!htmlPath.startsWith('http')) {
            const baseUrl = window.location.href.substring(0, window.location.href.lastIndexOf('/'));
            if (htmlPath.startsWith('/')) {
                htmlPath = htmlPath.substring(1);
            }
            htmlPath = baseUrl + '/' + htmlPath;
        }

        // fetch the HTML file
        const htmlResponse = await fetch(htmlPath);
        if (!htmlResponse.ok) {
            throw new Error(`Failed to fetch ${htmlPath}: ${htmlResponse.status}`);
        }
        const htmlText = await htmlResponse.text();

        // parse it
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlText, 'text/html');

        // clear previous experiment's styles
        clearPreviousStyles();

        //extract and load CSS files
        const linkTags = doc.querySelectorAll('link[rel="stylesheet"]');
        for (const link of linkTags) {
            const href = link.getAttribute('href');
            if (!href) continue;

            const cssPath = resolveUrl(href, htmlPath);
            const linkEl = document.createElement('link');
            linkEl.rel = 'stylesheet';
            linkEl.href = cssPath;
            document.head.appendChild(linkEl);
            console.log("Loaded CSS:", cssPath);
        }

        // extract and load any <style> tags from the HTML
        const styleTags = doc.querySelectorAll('style');
        styleTags.forEach(styleTag => {
            const styleText = styleTag.textContent;
            const modifiedStyle = styleText.replace(/body\s*{/g, '#experiment-container {');
            const newStyle = document.createElement('style');
            newStyle.textContent = modifiedStyle;
            document.head.appendChild(newStyle);
            console.log("Loaded inline style");
        });

        // extract and load JS files (in order!)
        const scriptTags = doc.querySelectorAll('script[src]');
        for (const script of scriptTags) {
            const src = script.getAttribute('src');
            if (!src) continue;

            if (src.includes('jatos.js')) {
                console.log("Skipping jatos.js");
                continue;
            }

            const scriptPath = resolveUrl(src, htmlPath);
            await loadScript(scriptPath);
            console.log("Loaded script:", scriptPath);
        }

        // make sure body exists first
        if (!document.body) {
            console.error("BODY IS NULL! Recreating body...");
            const newBody = document.createElement('body');
            document.documentElement.appendChild(newBody);
        }

        // make sure container exists before trying to use it
        let container = document.getElementById('experiment-container');
        if (!container) {
            console.warn("Container was missing, recreating it");
            container = document.createElement('div');
            container.id = 'experiment-container';
            document.body.appendChild(container);
        }

        // clear and inject the body content
        container.innerHTML = '';
        container.style = '';
        const bodyContent = doc.querySelector('body').innerHTML;
        container.innerHTML = bodyContent;

        // increment index for next time
        jatos.studySessionData.currentIndex = currentIndex + 1;
        await jatos.setStudySessionData(jatos.studySessionData);

        // execute inline scripts from the HTML
        const inlineScripts = doc.querySelectorAll('script:not([src])');
        for (const script of inlineScripts) {
            const scriptText = script.textContent.trim();
            if (scriptText) {
                console.log("Executing inline script");
                try {
                    eval(scriptText);
                } catch (e) {
                    console.error("Error executing inline script:", e);
                }
            }
        }

    } catch (error) {
        console.error("Loader error:", error);

        if (!document.body) {
            console.error("BODY IS NULL during error! Recreating body...");
            const newBody = document.createElement('body');
            document.documentElement.appendChild(newBody);
        }

        let container = document.getElementById('experiment-container');
        if (!container) {
            console.log("Container missing during error, recreating...");
            container = document.createElement('div');
            container.id = 'experiment-container';
            document.body.appendChild(container);
        }

        container.innerHTML = `
            <div style="padding: 50px; text-align: center;">
                <h1>Error Loading Experiment</h1>
                <p>${error.message}</p>
                <button onclick="loadNextComponent()">Retry</button>
            </div>
        `;
    }
}

function resolveUrl(url, basePath) {
    // if absolute path, return as-is
    if (url.startsWith('/') || url.startsWith('http')) {
        return url;
    }
    
    // resolve relative path
    const baseDir = basePath.substring(0, basePath.lastIndexOf('/'));
    return baseDir + '/' + url;
}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = () => {
            console.log("Script loaded successfully:", src);
            resolve();
        };
        script.onerror = () => {
            console.error("Failed to load script:", src);
            reject(new Error(`Failed to load ${src}`));
        };
        document.head.appendChild(script);
    });
}


jatos.onLoad(async function() {
    console.log("=== LOADER STARTING ===");
    await loadNextComponent();
});