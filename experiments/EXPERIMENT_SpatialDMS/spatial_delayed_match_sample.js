jatos.onLoad(function() {
    if (window.biologicalMotionExperimentRunning) {
        return;
    }
    window.biologicalMotionExperimentRunning = true;

    const subjectId = jatos.studySessionData.subjectId || 'unknown';
    console.log("Subject ID:", subjectId);

    var jsPsych = initJsPsych({
        on_finish: function() {
            saveData();
            showThankYouScreen();
        }
    });

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

    const SPATIAL_DMS_PARAMS = (() => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'STUDY_GERMANY/sequence_config.json5', false);
        xhr.send();
        const config = parseJSON5(xhr.responseText);
        return config.parameters.spatial_delayed_match_sample;
    })();

    // experiment parameters
    const TESTING_MODE = false;
    
    const MAX_TRIALS = SPATIAL_DMS_PARAMS.MaxTrials;
    console.log("Max Trials: "+MAX_TRIALS)
    
    // test mode - set to true for quick testing
    const RUN_TEST = true;

    // create timeline
    var timeline = [];

    var WelcomeWritten = {
        type: jsPsychHtmlButtonResponse,
        stimulus: "JASON",//function() { 
            //var Str = jatos.studySessionData.translations.spatial_dms_welcome_text            
        post_trial_gap: 0,
        //margin_horizontal: function() { return GapBetweenButtons },
        prompt: 'PROMPT',
        choices: ['CONTINUE'],  
    }
    console.log("JASONJASONJASON")
    console.log(jatos.studySessionData)
    console.log(jatos.studySessionData.translations)
    
    timeline.push(WelcomeWritten)
    jsPsych.run(timeline);
})