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

    if ( window.innerWidth < window.innerHeight )
    { 
        CanvasHeight = window.innerWidth
        CanvasWidth = window.innerWidth
    }
    else
    { 
        CanvasHeight = window.innerHeight
        CanvasWidth = window.innerHeight
    }
    const CanvasScale = 0.65



    const TESTING_MODE = false;
    
    const MAX_TRIALS = SPATIAL_DMS_PARAMS.MaxTrials;
    console.log("Max Trials: "+MAX_TRIALS)
    
    // test mode - set to true for quick testing
    const RUN_TEST = true;


    var setupPractice = {
    type: jsPsychCallFunction,
    func: function() {
        stair1 = new Stair(SPATIAL_DMS_PARAMS.StartValue, SPATIAL_DMS_PARAMS.MinValue, 
            SPATIAL_DMS_PARAMS.MaxValue, SPATIAL_DMS_PARAMS.MaxReversals, SPATIAL_DMS_PARAMS.NPracticeTrials,
            SPATIAL_DMS_PARAMS.StepSize, SPATIAL_DMS_PARAMS.NUp, SPATIAL_DMS_PARAMS.NDown, 
            SPATIAL_DMS_PARAMS.FastStart);
        //document.getElementById("jspsych-progressbar-container").style.visibility = "visible"
        //document.getElementById("progress-bar-text").innerHTML = LabelNames.ProgressBar
        //jsPsych.setProgressBar(0)
        FeedbackFlag = true
        console.log(stair1)
        }
    }
    var setupTest = {
    type: jsPsychCallFunction,
    func: function() {
        stair1 = new Stair(SPATIAL_DMS_PARAMS.StartValue, SPATIAL_DMS_PARAMS.MinValue, 
            SPATIAL_DMS_PARAMS.MaxValue, SPATIAL_DMS_PARAMS.MaxReversals, SPATIAL_DMS_PARAMS.MaxTrials,
            SPATIAL_DMS_PARAMS.StepSize, SPATIAL_DMS_PARAMS.NUp, SPATIAL_DMS_PARAMS.NDown, 
            SPATIAL_DMS_PARAMS.FastStart);
        //document.getElementById("jspsych-progressbar-container").style.visibility = "visible"
        //document.getElementById("progress-bar-text").innerHTML = LabelNames.ProgressBar
        //jsPsych.setProgressBar(0)
        FeedbackFlag = true
        console.log(stair1)
        }
    }
    var VisualStimulus = {
    type: jsPsychCanvasButtonResponse,
    stimulus: function(c) {
        CurrentLoad = stair1.Current
        CurrentLocations = ReturnElementsFromPermute(CurrentLoad, NumberLocations)
        for ( var i = 0; i < CurrentLoad; i++ ) {
        var temp = mapLinearIndexToGridIndex(CurrentLocations[i] ,GridCountX, GridCountY)
        filledCirc(c, CircleRadius+(temp[0]*2*CircleRadius),CircleRadius+(temp[1]*2*CircleRadius),CircleRadius, CircleColor);
        }
        CanvasText(c, (CanvasScale*CanvasWidth)/2+0, (CanvasScale*CanvasHeight)/2+0, "+")
//        document.getElementById('jspsych-canvas-button-response-button-0').style.visibility = 'hidden';
    },
    canvas_size: [CanvasScale*CanvasHeight, CanvasScale*CanvasWidth],
    choices: ['dummy'],
    valid_choices: function() { return SPATIAL_DMS_PARAMS.KeyboardValues },
    prompt: '',
    trial_duration: function() { return SPATIAL_DMS_PARAMS.StimOnTime },
    };





    // create timeline
    var timeline = [];

    var WelcomeWritten = {
        type: jsPsychHtmlButtonResponse,
        stimulus: function() { 
            var Str = jatos.studySessionData.translations.spatial_dms_welcome_text            
            return Str
        },
        post_trial_gap: 0,
        //margin_horizontal: function() { return GapBetweenButtons },
        choices: [jatos.studySessionData.translations.button_continue],  
    }
    
    var Instructions01a = {
        type: jsPsychHtmlButtonResponse,
        stimulus: function() { 
            var Str = jatos.studySessionData.translations.spatial_dms_instructions01a            
            return Str
        },
        post_trial_gap: 0,
        //margin_horizontal: function() { return GapBetweenButtons },
        choices: [jatos.studySessionData.translations.button_continue],  
    }
    var Instructions01b = {
        type: jsPsychHtmlButtonResponse,
        stimulus: function() { 
            var Str = jatos.studySessionData.translations.spatial_dms_instructions01b
            return Str
        },
        post_trial_gap: 0,
        //margin_horizontal: function() { return GapBetweenButtons },
        choices: [jatos.studySessionData.translations.button_continue],  
    }
    var Instructions01c = {
        type: jsPsychHtmlButtonResponse,
        stimulus: function() { 
            var Str = jatos.studySessionData.translations.spatial_dms_instructions01c 
            return Str
        },
        post_trial_gap: 0,
        //margin_horizontal: function() { return GapBetweenButtons },
        choices: [jatos.studySessionData.translations.button_continue],  
    }
    var Instructions02 = {
        type: jsPsychHtmlButtonResponse,
        stimulus: function() { 
            var Str = jatos.studySessionData.translations.spatial_dms_instructions02 
            return Str
        },
        post_trial_gap: 0,
        //margin_horizontal: function() { return GapBetweenButtons },
        choices: [jatos.studySessionData.translations.button_continue],  
    }

    timeline.push(setupPractice)
    timeline.push(VisualStimulus)
    timeline.push(WelcomeWritten)
    timeline.push(Instructions01a)
    timeline.push(Instructions01b)
    timeline.push(Instructions01c)
    timeline.push(Instructions02)
    jsPsych.run(timeline);
})