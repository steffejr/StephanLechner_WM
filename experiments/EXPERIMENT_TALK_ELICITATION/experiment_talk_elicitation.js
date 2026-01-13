jatos.onLoad(function() {
    // guard against double execution
    if (window.talkElicitationRunning) {
        console.log("Talk elicitation already running, skipping");
        return;
    }
    window.talkElicitationRunning = true;
    console.log("=== TALK ELICITATION EXPERIMENT STARTING ===");

    // get subject ID from session
    const subjectId = jatos.studySessionData.subjectId || 'unknown';
    console.log("Subject ID:", subjectId);

    var jsPsych = initJsPsych({
        on_finish: function() {
        }
    });

    // add subject ID to ALL data collected
    jsPsych.data.addProperties({
        subject_id: subjectId
    });

    // load params from config file
    // JSON5 parser
    function parseJSON5(json5String) {
        json5String = json5String.replace(/\/\/.*$/gm, '');
        json5String = json5String.replace(/\/\*[\s\S]*?\*\//g, '');
        json5String = json5String.replace(/,(\s*[}\]])/g, '$1');
        return JSON.parse(json5String);
    }    
    const TALK_ELICITATION_PARAMS = (() => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'sequence_config.json5', false);
        xhr.send();
        const config = parseJSON5(xhr.responseText);
        return config.parameters.talk_elicitation;
    })();
    
    // get recording duration from parameters
    const recording_time = TALK_ELICITATION_PARAMS.recording_duration;
    console.log("Recording duration:", recording_time, "ms");

    const instruction_trial = {
        type: jsPsychInstructions,
        pages: [
            jatos.studySessionData.translations.talk_elicitation_introduction
        ],
        show_clickable_nav: true,
        button_label_next: jatos.studySessionData.translations.button_continue
    };

    const picture_screen = {
        type: jsPsychHtmlKeyboardResponse,
        stimulus: jatos.studySessionData.translations.button_start_recording + `
            <div style="width: 100vw; height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                <img src="experiments/EXPERIMENT_TALK_ELICITATION/talk_elicitation1.jpg"
                     style="max-width: 95vw; max-height: 95vh; object-fit: contain;"
                     alt="Picture to describe">
            </div>
        `,
        choices: "NO_KEYS",
        trial_duration: null,

        on_load: function() {
            const startBtn = document.getElementById('start-btn');

            startBtn.onclick = function() {
                jsPsych.finishTrial({start_recording: true});
            };
        }
    };

    const recording_trial = {
        type: jsPsychHtmlKeyboardResponse,
        stimulus: `
            <div style="width: 100%; height: 4px; background: #f0f0f0; position: fixed; top: 25px; left: 0; z-index: 1000;">
                <div id="progress" style="height: 100%; width: 0%; background: #4CAF50; transition: width 0.3s;"></div>
            </div>

            ` + jatos.studySessionData.translations.button_done_talking + `

            <div style="width: 100vw; height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                <img src="experiments/EXPERIMENT_TALK_ELICITATION/talk_elicitation1.jpg"
                     style="max-width: 95vw; max-height: 95vh; object-fit: contain;"
                     alt="Picture to describe">
            </div>
        `,
        choices: "NO_KEYS",
        trial_duration: recording_time,

        on_load: function() {
            let mediaRecorder;
            let audioChunks = [];
            const progress = document.getElementById('progress');
            const endBtn = document.getElementById('end-btn');
            let startTime;
            let timerInterval;

            navigator.mediaDevices.getUserMedia({ audio: true })
                .then(stream => {
                    mediaRecorder = new MediaRecorder(stream);
                    audioChunks = [];

                    mediaRecorder.ondataavailable = event => {
                        audioChunks.push(event.data);
                    };

                    mediaRecorder.onstop = () => {
                        setTimeout(() => {
                            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                            const reader = new FileReader();
                            reader.onloadend = function() {
                                const base64 = reader.result.split(',')[1];
                                const actualDuration = Date.now() - startTime;

                                // store in study session data
                                if (!jatos.studySessionData.experimentData) {
                                    jatos.studySessionData.experimentData = {};
                                }
                                jatos.studySessionData.experimentData.talkElicitation = {
                                    audio_base64: base64,
                                    audio_format: 'webm',
                                    duration: actualDuration,
                                    timestamp: new Date().toISOString(),
                                    subject_id: subjectId
                                };
                                jatos.setStudySessionData(jatos.studySessionData);
                                console.log("Talk elicitation data stored in session");

                                // thank you screen
                                document.getElementById('jspsych-content').innerHTML = jatos.studySessionData.translations.talk_elicitation_thanks;

                                document.getElementById('continue-btn').onclick = () => {
                                    jsPsych.finishTrial();
                                    window.continueToNext();
                                };
                            };
                            reader.readAsDataURL(audioBlob);
                        }, 3000);

                        stream.getTracks().forEach(track => track.stop());
                        if (timerInterval) clearInterval(timerInterval);
                    };

                    mediaRecorder.start();
                    startTime = Date.now();

                    timerInterval = setInterval(() => {
                        const elapsed = Date.now() - startTime;
                        const percent = Math.min(100, (elapsed / recording_time) * 100);
                        progress.style.width = percent + '%';

                        if (elapsed >= recording_time) {
                            mediaRecorder.stop();
                            endBtn.style.display = 'none';
                        }
                    }, 100);
                })
                .catch(err => {
                    alert("Microphone error: " + err.message);
                    jsPsych.finishTrial();
                });

            endBtn.onclick = function() {
                if (mediaRecorder && mediaRecorder.state === 'recording') {
                    mediaRecorder.stop();
                    endBtn.style.display = 'none';
                    progress.style.width = '100%';
                    if (timerInterval) clearInterval(timerInterval);
                }
            };
        }
    };

    const thank_you_trial = {
        type: jsPsychHtmlKeyboardResponse,
        stimulus: jatos.studySessionData.translations.talk_elicitation_thanks,
        choices: "NO_KEYS",
        trial_duration: null,

        on_load: function() {
            document.getElementById('continue-btn').onclick = () => {
                jsPsych.finishTrial();
                window.continueToNext();
            };
        }
    };

    const timeline = [
        instruction_trial,
        picture_screen,
        {
            timeline: [recording_trial, thank_you_trial],
            conditional_function: function() {
                const data = jsPsych.data.get().last(1).values()[0];
                return data && data.start_recording === true;
            }
        }
    ];

    // ctrl+z
    document.addEventListener('keydown', function(event) {
        if (event.ctrlKey && event.key === 'z') {
            event.preventDefault();
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                mediaRecorder.stop();
                setTimeout(() => {
                    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                    const reader = new FileReader();
                    reader.onloadend = function() {
                        const base64 = reader.result.split(',')[1];
                        const actualDuration = Date.now() - startTime;

                        if (!jatos.studySessionData.experimentData) {
                            jatos.studySessionData.experimentData = {};
                        }
                        jatos.studySessionData.experimentData.talkElicitation = {
                            audio_base64: base64,
                            audio_format: 'webm',
                            duration: actualDuration,
                            timestamp: new Date().toISOString(),
                            subject_id: subjectId
                        };
                        jatos.setStudySessionData(jatos.studySessionData);

                        document.body.innerHTML = `
                            <div style="font-size: 24px; text-align: center; padding: 50px;">
                                <h1>Experiment Aborted</h1>
                                <p>The experiment has been stopped.</p>
                                <p>Your data has been saved.</p>
                                <p style="margin-top: 30px;">You may close this window.</p>
                            </div>
                        `;
                        if (window.continueToNext) {
                            window.continueToNext();
                        }
                    };
                    reader.readAsDataURL(audioBlob);
                }, 3000);
            }
        }
    });

    jsPsych.run(timeline);
});