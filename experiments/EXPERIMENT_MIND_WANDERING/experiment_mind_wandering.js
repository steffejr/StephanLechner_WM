const jsPsych = initJsPsych({
    on_finish: function() {
        console.log("jsPsych finished, but not ending study");
    },
    show_progress_bar: false,
    auto_update_progress_bar: false,
    default_iti: 250
});

// load params from config file
// JSON5 parser
function parseJSON5(json5String) {
    json5String = json5String.replace(/\/\/.*$/gm, '');
    json5String = json5String.replace(/\/\*[\s\S]*?\*\//g, '');
    json5String = json5String.replace(/,(\s*[}\]])/g, '$1');
    return JSON.parse(json5String);
}    
const PARAMETERS = (() => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', 'sequence_config.json5', false);
    xhr.send();
    const config = parseJSON5(xhr.responseText); 
    return config.parameters.mind_wandering;
})();
// ============================================


jatos.onLoad(function() {
    // guard at the START of jatos.onLoad
    if (window.mindWanderingRunning) {
        console.log("Mind wandering already running, skipping");
        return;
    }
    window.mindWanderingRunning = true;

    const subjectId = jatos.studySessionData.subjectId || 'unknown';
    console.log("Subject ID:", subjectId);

    // add subject ID to ALL data collected
    jsPsych.data.addProperties({
        subject_id: subjectId
    });

    // Get VAS questions from translations
    // Original English versions:
    // [
    //     {
    //         question: "My thoughts were about",
    //         left_label: "Internal stimuli (e.g., inner speech, autobiographical memories)",
    //         right_label: "External stimuli (e.g., auditory, visual, olfactory)",
    //         name: "internal_external"
    //     },
    //     {
    //         question: "My thoughts were",
    //         left_label: "Calm",
    //         right_label: "Fast",
    //         name: "calm_fast"
    //     },
    //     {
    //         question: "My thoughts were flowing",
    //         left_label: "Evenly",
    //         right_label: "Unevenly",
    //         name: "even_uneven"
    //     }
    // ]
    const vasQuestions = [
    {
        question: jatos.studySessionData.translations.mind_wandering_orientation_question,
        left_label: jatos.studySessionData.translations.mind_wandering_orientation_left,
        right_label: jatos.studySessionData.translations.mind_wandering_orientation_right,
        name: jatos.studySessionData.translations.mind_wandering_orientation_name
    },
    {
        question: jatos.studySessionData.translations.mind_wandering_speed_question,
        left_label: jatos.studySessionData.translations.mind_wandering_speed_left,
        right_label: jatos.studySessionData.translations.mind_wandering_speed_right,
        name: jatos.studySessionData.translations.mind_wandering_speed_name
    },
    {
        question: jatos.studySessionData.translations.mind_wandering_flow_question,
        left_label: jatos.studySessionData.translations.mind_wandering_flow_left,
        right_label: jatos.studySessionData.translations.mind_wandering_flow_right,
        name: jatos.studySessionData.translations.mind_wandering_flow_name
    }
    ];

    function saveData() {
        const subjectId = jatos.studySessionData.subjectId || 'unknown';
        const allData = jsPsych.data.get().values();

        // create CSV content
        let csvContent = "trial_number,resting_duration,internal_external,internal_external_rt,calm_fast,calm_fast_rt,even_uneven,even_uneven_rt,total_time_elapsed\n";
        
        let trialNumber = 1;
        
        for (let i = 0; i < allData.length; i++) {
            const trial = allData[i];
            
            if (trial.trial_type === 'html-keyboard-response' && 
                trial.stimulus && 
                trial.stimulus.includes('fixation')) {
                
                const vasTrials = [];
                for (let j = 1; j <= 3; j++) {
                    if (allData[i + j] && allData[i + j].trial_type === 'html-slider-response') {
                        vasTrials.push(allData[i + j]);
                    }
                }
                
                if (vasTrials.length === 3) {
                    let restingDuration = trial.resting_duration || 0;
                    csvContent += `${trialNumber},${restingDuration},${vasTrials[0].response || ''},${vasTrials[0].rt || ''},${vasTrials[1].response || ''},${vasTrials[1].rt || ''},${vasTrials[2].response || ''},${vasTrials[2].rt || ''},${vasTrials[2].time_elapsed || ''}\n`;
                    trialNumber++;
                }
            }
        }

        console.log("Total trials processed:", trialNumber - 1);

        // store in study session data
        if (!jatos.studySessionData.experimentData) {
            jatos.studySessionData.experimentData = {};
        }
        
        jatos.studySessionData.experimentData.mindWandering = {
            csv: csvContent,
            metadata: {
                subject_id: subjectId,
                date: new Date().toISOString(),
                total_trials: trialNumber - 1
            }
        };
        
        jatos.setStudySessionData(jatos.studySessionData);
        console.log("Mind wandering data stored in session");
        
        // Optional: Local CSV download
        // const date = new Date();
        // const dateStr = date.toISOString().split('T')[0];
        // const timeStr = date.toTimeString().split(':').slice(0, 2).join('');
        // const filename = `${dateStr}_${timeStr}_${subjectId}_mindwandering.csv`;
        
        // const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        // const url = URL.createObjectURL(blob);
        // const link = document.createElement('a');
        // link.href = url;
        // link.download = filename;
        // document.body.appendChild(link);
        // link.click();
        // document.body.removeChild(link);
        // setTimeout(() => URL.revokeObjectURL(url), 1000);
        
        // console.log("Local backup downloaded");
        
        window.continueToNext();
    }

    // ctrl+z
    document.addEventListener('keydown', function(event) {
        if (event.ctrlKey && event.key === 'z') {
            event.preventDefault();
            
            console.log("Ctrl+C pressed - aborting experiment");
            
            const allData = jsPsych.data.get().values();
            let csvContent = "trial_number,resting_duration,internal_external,internal_external_rt,calm_fast,calm_fast_rt,even_uneven,even_uneven_rt,total_time_elapsed\n";
            
            let trialNumber = 1;
            for (let i = 0; i < allData.length; i++) {
                const trial = allData[i];
                if (trial.trial_type === 'html-keyboard-response' && 
                    trial.stimulus && 
                    trial.stimulus.includes('fixation')) {
                    const vasTrials = [];
                    for (let j = 1; j <= 3; j++) {
                        if (allData[i + j] && allData[i + j].trial_type === 'html-slider-response') {
                            vasTrials.push(allData[i + j]);
                        }
                    }
                    if (vasTrials.length === 3) {
                        let restingDuration = trial.resting_duration || 0;
                        csvContent += `${trialNumber},${restingDuration},${vasTrials[0].response || ''},${vasTrials[0].rt || ''},${vasTrials[1].response || ''},${vasTrials[1].rt || ''},${vasTrials[2].response || ''},${vasTrials[2].rt || ''},${vasTrials[2].time_elapsed || ''}\n`;
                        trialNumber++;
                    }
                }
            }
            
            if (typeof jatos !== 'undefined') {
                jatos.submitResultData(csvContent, function() {
                    console.log("Abort data submitted to JATOS");
                    
                    document.body.innerHTML = `
                        <div style="font-size: 24px; text-align: center; padding: 50px;">
                            <h1>Experiment Aborted</h1>
                            <p>The experiment has been stopped.</p>
                            <p>Your data has been saved.</p>
                            <p style="margin-top: 30px;">You may close this window.</p>
                        </div>
                    `;
                    
                    jatos.endStudy("Aborted by Ctrl+C");
                });
            }
            
            //LOCAL SAVING
            // const date = new Date();
            // const dateStr = date.toISOString().split('T')[0];
            // const timeStr = date.toTimeString().split(':').slice(0, 2).join('');
            // const filename = `ABORTED_${dateStr}_${timeStr}_${jatos.studySessionData.subjectId}.csv`;
            
            // const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            // const url = URL.createObjectURL(blob);
            // const link = document.createElement('a');
            // link.href = url;
            // link.download = filename;
            // document.body.appendChild(link);
            // link.click();
            // document.body.removeChild(link);
        }
    });

    const timeline = [];

    // Instructions
    // Original English text:
    // `Dear participant,<br><br>
    // While performing this task, we ask you to keep your eyes open and avoid prolonged structured thinking, such as counting or singing.<br><br>
    // Each time the "+" symbol is shown on the screen, simply rest with your eyes open.<br><br>
    // After the "+" disappears, you will see a few questions asking how you felt while the "+" was on the screen.<br><br>
    // When you feel ready, press the space bar to begin the task.`
    const instructions = {
        type: jsPsychInstructions,
        pages: [
            jatos.studySessionData.translations.mind_wandering_instructions
        ],
        show_clickable_nav: true,
        button_label_previous: jatos.studySessionData.translations.button_previous,
        button_label_next: jatos.studySessionData.translations.button_next
    };

    // LSL marker function (for possible combo with EEG later; based on Bianca's psychopy code)
    function sendLSLMarker(marker) {
        console.log(`LSL Marker: ${marker}`);
    }

    // MAIN experimental loop
    const experimentalTrials = {
        timeline: [
            // Resting State Period
            {
                type: jsPsychHtmlKeyboardResponse,
                stimulus: '<div class="fixation">+</div>',
                choices: "NO_KEYS",
                // trial_duration: function () {
                //     // const duration = 4 * (Math.floor(Math.random() * 7) + 2);        // 8-32s in 4s increments
                //     // const duration = 2; // 2 seconds for testing
                //     // const duration = PARAMETERS.restingDuration;
                //     const duration = eval(PARAMETERS.restingDuration);  // eval("24 * (Math.floor(Math.random() * 7) + 2)")

                //     this.duration_used = duration;
                //     return duration * 1000;
                // },
                trial_duration: function () {
                    const durationFunc = eval('(' + PARAMETERS.restingDuration + ')');
                    const duration = durationFunc(); // random each trial, always call function from json, tht's why i need it a string
                    this.duration_used = duration;
                    return duration * 1000;
                },
                on_load: function () {
                    console.log("Resting state started - LSL Marker 3");
                },
                on_finish: function (data) {
                    data.resting_duration = this.duration_used;
                    console.log("Resting state ended - LSL Marker 4");
                }
            },

            // VAS questions for each trial
            {
                timeline: vasQuestions.map((questionObj, index) => {
                    // Parse the question object from string if needed
                    const question = typeof questionObj === 'string' ? JSON.parse(questionObj) : questionObj;
                    return {
                        type: jsPsychHtmlSliderResponse,
                        stimulus: `
                            <div style="color: white; text-align: center; font-size: 24px; margin-bottom: 30px;">
                                ${question.question}
                            </div>
                            <div style="display: flex; justify-content: space-between; width: 80%; margin: 0 auto 20px auto; color: white;">
                                <div style="text-align: left; width: 40%; font-size: 16px;">${question.left_label}</div>
                                <div style="text-align: right; width: 40%; font-size: 16px;">${question.right_label}</div>
                            </div>
                        `,
                        min: 1,
                        max: 10,
                        slider_start: 5.5,
                        step: 0.05,
                        slider_width: 600,
                        labels: ['1', '5.5', '10'],
                        require_movement: true,
                        button_label: jatos.studySessionData.translations.button_next,
                        on_load: function () {
                            const slider = document.querySelector('.jspsych-slider');
                            if (slider) {
                                slider.addEventListener('input', function () {
                                    const value = parseInt(this.value);
                                    const min = parseInt(this.min);
                                    const max = parseInt(this.max);
                                    const percent = ((value - min) / (max - min)) * 100;
                                    this.style.setProperty('--thumb-position', percent + '%');
                                });
                            }
                            console.log(`VAS question ${index + 1} started - LSL Marker 7`);
                        },
                        on_finish: function (data) {
                            console.log(`VAS question ${index + 1} ended - LSL Marker 8`);
                            console.log(`Response: ${data.response}`);
                        }
                    };
                })
            }
        ],
        repetitions: PARAMETERS.trialRepetitions,
    };

    // End screen
    // Original English text:
    // `
    //     <div style="font-size: 24px; text-align: center;">
    //         <h1>Experiment Complete!</h1>
    //         <p>Thank you for participating.</p>
    //         <p>Your data has been saved.</p>
    //         <p style="margin-top: 30px;">You may close this window.</p>
    //     </div>
    // `
    const end_screen = {
        type: jsPsychHtmlKeyboardResponse,
        stimulus: jatos.studySessionData.translations.mind_wandering_thanks,
        choices: 'NO_KEYS',
        trial_duration: 2000,
        on_start: function() {
            console.log("End screen started, calling saveData"); 
            saveData(); // call saveData HERE in end screen like finger tapping does
        }
    };

    timeline.push(instructions);
    timeline.push(experimentalTrials);
    timeline.push(end_screen);

    jsPsych.run(timeline);
});