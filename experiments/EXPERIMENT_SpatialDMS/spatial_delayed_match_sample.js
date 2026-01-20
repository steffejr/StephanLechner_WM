jatos.onLoad(function() {
    
    
    
    if (window.biologicalMotionExperimentRunning) {
        return;
    }
    window.biologicalMotionExperimentRunning = true;

    const subjectId = jatos.studySessionData.subjectId || 'unknown';
    console.log("Subject ID:", subjectId);

    var jsPsych = initJsPsych({
        on_finish: function() {
            //saveData();
            //showThankYouScreen();
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
    console.log("PARAMETERS")
    
    // Prepare the parameters that are stored as functions
    const buttonLabelFunc = eval('(' + SPATIAL_DMS_PARAMS.ButtonLabels + ')');
    SPATIAL_DMS_PARAMS.ButtonLabels = buttonLabelFunc()
    const KeyboardValuesFunc = eval('(' + SPATIAL_DMS_PARAMS.KeyboardValues +')');
    SPATIAL_DMS_PARAMS.KeyboardValues = KeyboardValuesFunc()
    const KeyboardMappingsFunc = eval('(' + SPATIAL_DMS_PARAMS.KeyboardMappings +')');
    SPATIAL_DMS_PARAMS.KeyboardMappings = KeyboardMappingsFunc()
    const ProbeColorFunc = eval('(' + SPATIAL_DMS_PARAMS.ProbeColor +')');
    SPATIAL_DMS_PARAMS.ProbeColor = ProbeColorFunc()

    // experiment parameters
    var countInstr = 0
    var Current = 4
    DMSFontSize = 36
    var count = 0
    var stair1
    var FeedbackFlag = false
    var FeedbackText
    const GridCountX = 6
    const GridCountY = 6
    const NumberLocations = GridCountX*GridCountY
    var CurrentLocations
    const CircleColor = 'yellow'
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
    // Decide circle radius based on the canvas size
    const CircleRadius = CalculateRadius(CanvasScale*CanvasWidth, CanvasScale*CanvasHeight, GridCountX)



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

    var VisualProbe = {
    type: jsPsychCanvasButtonResponse,
    stimulus: function(c) {
        // decide if this is a positive or negative probe trial
        Probe = Math.round(Math.random())
        var Loc
        if ( Probe == 1 ) {
        console.log("POSITIVE PROBE")
        Loc = shuffle(CurrentLocations).slice(0,1)
        }
        else {
        console.log("NEGATIVE PROBE")
        Loc = NegativeProbeLocation(CurrentLocations, NumberLocations)
        }
        var temp = mapLinearIndexToGridIndex(Loc ,GridCountX, GridCountY)
        filledCirc(c, CircleRadius+(temp[0]*2*CircleRadius),CircleRadius+(temp[1]*2*CircleRadius),CircleRadius, SPATIAL_DMS_PARAMS.ProbeColor);
        CanvasText(c, CanvasScale*CanvasWidth/2+0, CanvasScale*CanvasHeight/2+0, "+")
    },
    canvas_size: [CanvasScale*CanvasHeight, CanvasScale*CanvasWidth ],
    choices: function() { return SPATIAL_DMS_PARAMS.ButtonLabels},
    valid_choices: function() { return SPATIAL_DMS_PARAMS.KeyboardValues },

    prompt: '',
    trial_duration: function() { return SPATIAL_DMS_PARAMS.ProbeOnTime },
    
    on_finish: function(data){
        var ResponseMapping = SPATIAL_DMS_PARAMS.KeyboardValues
        var KeyboardMappings = SPATIAL_DMS_PARAMS.KeyboardMappings

        var ResponseIndex = ResponseMapping.indexOf(data.response)

        // Note that the response buttons are in the order of 0,1,2,3,4
        // Therefore, the left button is a zero and the right button is a one
        // Response mapping (using one and zero) indicates which values are yes (one)
        // and which is no (zero)
        if ( Probe == 1 && SPATIAL_DMS_PARAMS.KeyboardMappings[ResponseIndex]) 
        { 
        data.correct = 1
        FeedbackText = jatos.studySessionData.translations.spatial_dms_feedback_correct
        stair1.Decide(true, data.rt)
        }
        else if ( Probe == 0 && ! SPATIAL_DMS_PARAMS.KeyboardMappings[ResponseIndex]) 
        { 
        data.correct = 1
        FeedbackText = jatos.studySessionData.translations.spatial_dms_feedback_correct
        stair1.Decide(true, data.rt)
        } 
        else 
        {
        data.correct = 0
        FeedbackText = jatos.studySessionData.translations.spatial_dms_feedback_incorrect
        stair1.Decide(false, data.rt)
        }
        data.CurrentLocations = CurrentLocations
        data.Load = CurrentLoad
        data.TrialType = 'Probe'
    }
    };

    var VisualMask = {
    type: jsPsychCanvasButtonResponse,
    stimulus: function(c) {
        for ( var i = 0; i < GridCountX; i++ ) 
        {
        for ( var j = 0; j < GridCountY; j++ ) 
        {
            filledCirc(c, CircleRadius+(i*2*CircleRadius),CircleRadius+(j*2*CircleRadius),CircleRadius, CircleColor);
        }
        }
        CanvasText(c, CanvasScale*CanvasWidth/2+0, CanvasScale*CanvasHeight/2+0, "+")
        document.getElementById('jspsych-canvas-button-response-btngroup').style.visibility = 'hidden';
    },
    canvas_size: [CanvasScale*CanvasHeight, CanvasScale*CanvasWidth],
    choices: ['dummy'],
    valid_choices: function() { return SPATIAL_DMS_PARAMS.KeyboardValues },
    prompt: '',
    trial_duration: function() { return SPATIAL_DMS_PARAMS.MaskOnTime },
    };

    var RetentionCanvas = {
    type: jsPsychCanvasButtonResponse,
    stimulus: function(c) {
        CanvasText(c, CanvasScale*CanvasWidth/2+0, CanvasScale*CanvasHeight/2+0, "+", 'white')
        document.getElementById('jspsych-canvas-button-response-btngroup').style.visibility = 'hidden';
    },
    canvas_size: [CanvasScale*CanvasHeight, CanvasScale*CanvasWidth],
    choices: ['dummy'],
    valid_choices: function() { return SPATIAL_DMS_PARAMS.KeyboardValues },
    prompt: '',
    trial_duration: function() { return SPATIAL_DMS_PARAMS.RetOnTime },
    }

    var Fix = {
    type: jsPsychCanvasButtonResponse,
    stimulus: function(c) {
        if ( FeedbackFlag )
        { CanvasText(c,CanvasScale*CanvasWidth/2+0, CanvasScale*CanvasHeight/2+0, FeedbackText, 'white') }
        else
        { CanvasText(c, CanvasScale*CanvasWidth/2+0, CanvasScale*CanvasHeight/2+0, "+", 'red') }
        document.getElementById('jspsych-canvas-button-response-btngroup').style.visibility = 'hidden';
    },
    canvas_size: [CanvasScale*CanvasHeight, CanvasScale*CanvasWidth],
    choices: ['dummy'],
    valid_choices: function() { return SPATIAL_DMS_PARAMS.KeyboardValues },
    prompt: '',
    trial_duration: function() { return SPATIAL_DMS_PARAMS.ITITime },
    // on_finish: function(data){
    //   data.trialType = "fixation"
    // }
    } 


    // Define any logic used 

    var loop_node = {
    timeline: [VisualStimulus, VisualMask, RetentionCanvas, VisualProbe, Fix],
    loop_function: function(data){
        console.log((stair1.TrialCount)/(stair1.MaxTrials))
        //jsPsych.setProgressBar((stair1.TrialCount)/(stair1.MaxTrials))
        return (! stair1.Finished)
        }
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
    timeline.push(loop_node)
    timeline.push(WelcomeWritten)
    timeline.push(Instructions01a)
    timeline.push(Instructions01b)
    timeline.push(Instructions01c)
    timeline.push(Instructions02)
    jsPsych.run(timeline);
})