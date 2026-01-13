// load params from config file
// JSON5 parser
function parseJSON5(json5String) {
    json5String = json5String.replace(/\/\/.*$/gm, '');
    json5String = json5String.replace(/\/\*[\s\S]*?\*\//g, '');
    json5String = json5String.replace(/,(\s*[}\]])/g, '$1');
    return JSON.parse(json5String);
}

const FINGER_TAPPING_PARAMS = (() => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', 'sequence_config.json5', false);
    xhr.send();    
    const config = parseJSON5(xhr.responseText);
    return config.parameters.finger_tapping;
})();


jatos.onLoad(function() {
    // guard against double execution
    if (window.fingerTappingRunning) {
        return;
    }
    window.fingerTappingRunning = true;

    console.log("=== FINGER TAPPING EXPERIMENT STARTING ===");

    // set subject ID from session (set by welcome screen)
    const subjectId = jatos.studySessionData.subjectId || 'unknown';
    console.log("Subject ID:", subjectId);

    var jsPsych = initJsPsych({
        on_finish: function() {
            window.continueToNext();
        }
    });

    // add subject ID to ALL data collected
    jsPsych.data.addProperties({
        subject_id: subjectId
    });

    const experimentParameters = [
        { interval: 800, condition: 'fast', description: 'Fast (0.8s intervals)' },
        { interval: 1900, condition: 'slow', description: 'Slow (1.9s intervals)' }
    ];

    // get sub info
    function getSubjectInfo() {
        return {
            subID: subjectId || 'unknown',
            date: new Date().toISOString()
        };
    }

    const sub_info = getSubjectInfo();

    const randomizedConditions = [...experimentParameters].sort(() => Math.random() - 0.5);     // randomize condition order


    let audioContext;
    let beepBuffer;

    function initAudio() {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();

        const duration = 0.1;
        const sampleRate = audioContext.sampleRate;
        const numFrames = duration * sampleRate;
        const buffer = audioContext.createBuffer(1, numFrames, sampleRate);
        const data = buffer.getChannelData(0);

        const frequency = 450;
        for (let i = 0; i < numFrames; i++) {
            data[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0.5;
        }

        beepBuffer = buffer;
    }

    function playBeepSound() {
        initAudio();

        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }

        const source = audioContext.createBufferSource();
        source.buffer = beepBuffer;

        const gainNode = audioContext.createGain();
        gainNode.gain.value = 0.5;

        source.connect(gainNode);
        gainNode.connect(audioContext.destination);

        source.start();
        source.stop(audioContext.currentTime + 0.1);
    }

    function prepareAndStoreData() {
        const subjectId = jatos.studySessionData.subjectId || 'unknown';
        const allData = jsPsych.data.get().values();

        const processedTrials = [];
        let trialNumber = 1;

        allData.forEach(trial => {
            if (trial.tap_timestamps && trial.tap_timestamps.length > 0) {
                const condition = trial.condition || 'unknown';
                const phase = trial.phase || 'unknown';
                
                const roundedTimestamps = trial.tap_timestamps.map(t => Math.round(t * 100000) / 100000);
                const roundedIntervals = (trial.tap_intervals || []).map(t => Math.round(t * 100000) / 100000);

                // create trial object
                const trialData = {
                    trial_number: trialNumber,
                    condition: condition,
                    phase: phase,
                    tap_timestamps: roundedTimestamps,
                    tap_intervals: roundedIntervals
                };

                processedTrials.push(trialData);
                trialNumber++;
            }
        });

        jatos.studySessionData.experimentData = {
            fingerTapping: {
                trials: processedTrials,
                metadata: {
                    subject_id: subjectId,
                    date: new Date().toISOString(),
                    total_trials: processedTrials.length,
                    total_taps: processedTrials.reduce((sum, trial) => sum + trial.tap_timestamps.length, 0),
                    condition_order: randomizedConditions.map(c => c.condition)
                }
            }
        };


        jatos.setStudySessionData(jatos.studySessionData);
        console.log("Finger tapping data prepared:", processedTrials.length, "trials");
    }

    // abort handler data preparation
    function prepareAbortData() {
        console.log("Preparing abort data...");
        prepareAndStoreData();
    }

    // MAIN timeline
    var timeline = [];

    // instructions
    var instructions = {
        type: jsPsychHtmlKeyboardResponse,
        stimulus: jatos.studySessionData.translations.fingertapping_introduction,
        choices: [' '],
        on_finish: function() {
            initAudio();
        }
    };
    timeline.push(instructions);

    // create trials for each condition
    randomizedConditions.forEach((condition, index) => {
        let tapTimestamps = [];
        let tapIntervals = [];
        let lastTapTime = null;
        let tappingStartTime = null;

        // learning Phase
        var learning_phase = {
            type: jsPsychHtmlKeyboardResponse,
            stimulus: `
                <div style="text-align: center; font-size: 48px;">
                    <p>+</p>
                </div>
            `,
            choices: ['f'],
            trial_duration: condition.interval * 12 + 1000,
            response_ends_trial: false,
            on_start: function () {
                // ensure audio context is active
                if (audioContext && audioContext.state === 'suspended') {
                    audioContext.resume();
                }

                console.log("Starting learning phase with interval:", condition.interval);

                const playBeepSequence = (beepNumber) => {
                    if (beepNumber < 11) {
                        setTimeout(() => {
                            playBeepSound();
                            console.log("Beep:", beepNumber + 1);
                            playBeepSequence(beepNumber + 1);
                        }, condition.interval);
                    }
                };

                setTimeout(() => {
                    playBeepSound();
                    console.log("First beep");
                    playBeepSequence(1);
                }, 500);
            },
            on_load: function() {
                // initialize for learning phase taps
                tapTimestamps = [];
                tapIntervals = [];
                lastTapTime = null;
                tappingStartTime = performance.now();

                this.keyboardListener = function (event) {
                    if (event.code === 'KeyF') {
                        event.preventDefault();

                        const currentTime = performance.now();
                        const relativeTime = currentTime - tappingStartTime;

                        tapTimestamps.push(relativeTime);

                        if (lastTapTime !== null) {
                            const interval = relativeTime - lastTapTime;
                            tapIntervals.push(interval);
                        }

                        lastTapTime = relativeTime;
                    }
                };

                document.addEventListener('keydown', this.keyboardListener);
            },
            on_finish: function (data) {
                document.removeEventListener('keydown', this.keyboardListener);

                // store learning phase data
                data.phase = 'learning';
                data.condition = condition.condition;
                data.tap_timestamps = tapTimestamps.slice();
                data.tap_intervals = tapIntervals.slice();

                console.log("Learning phase finished. Taps recorded:", tapTimestamps.length);
            }
        };
        timeline.push(learning_phase);

        // tapping Phase
        var tapping_phase = {
            type: jsPsychHtmlKeyboardResponse,
            stimulus: `
                <div style="text-align: center; font-size: 48px;">
                    <p>+</p>
                </div>
            `,
            choices: ['f'],
            // trial_duration: 10000, // 10 seconds for testing - change to 300000 for 5 minutes
            trial_duration: FINGER_TAPPING_PARAMS.main_duration, 
            
            response_ends_trial: false,

            on_load: function () {
                tappingStartTime = performance.now();

                this.keyboardListener = function (event) {
                    if (event.code === 'KeyF') {
                        event.preventDefault();

                        const currentTime = performance.now();
                        const relativeTime = currentTime - tappingStartTime;

                        tapTimestamps.push(relativeTime);

                        if (lastTapTime !== null) {
                            const interval = relativeTime - lastTapTime;
                            tapIntervals.push(interval);
                        }

                        lastTapTime = relativeTime;

                        const tapCounter = document.getElementById('tap-counter');
                        if (tapCounter) {
                            tapCounter.textContent = 'Taps: ' + tapTimestamps.length;
                        }
                    }
                };
                document.addEventListener('keydown', this.keyboardListener);
            },

            on_finish: function (data) {
                document.removeEventListener('keydown', this.keyboardListener);

                data.phase = 'main_tapping';
                data.condition = condition.condition;
                data.tap_timestamps = tapTimestamps.slice();
                data.tap_intervals = tapIntervals.slice();

                // prepare and store data after the last condition
                if (index === randomizedConditions.length - 1) {
                    console.log("Last condition completed, preparing data...");
                    prepareAndStoreData();
                }
            }
        };
        timeline.push(tapping_phase);

        // break between conditions
        if (index < randomizedConditions.length - 1) {
            var break_screen = {
                type: jsPsychHtmlKeyboardResponse,
                stimulus: jatos.studySessionData.translations.fingertapping_break,
                choices: 'NO_KEYS',
                // trial_duration: 1000 // testing: 60000 for 60 seconds
                trial_duration: FINGER_TAPPING_PARAMS.break_duration

            };
            timeline.push(break_screen);
        }
    });

    // Ctrl+C
    document.addEventListener('keydown', function(event) {
        if (event.ctrlKey && event.key === 'z') {
            event.preventDefault();
            prepareAbortData();
            document.body.innerHTML = `
                <div style="font-size: 24px; text-align: center; padding: 50px;">
                    <h1>Experiment Aborted</h1>
                    <p>The experiment has been stopped.</p>
                    <p>Your data has been saved.</p>
                    <p style="margin-top: 30px;">You may close this window.</p>
                </div>
            `;
            jatos.endStudy();
        }
    });

    jsPsych.run(timeline);
});