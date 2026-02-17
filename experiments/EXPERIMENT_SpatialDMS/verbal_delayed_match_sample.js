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

    const VERBAL_DMS_PARAMS = (() => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'STUDY_GERMANY/sequence_config.json5', false);
        xhr.send();
        const config = parseJSON5(xhr.responseText);
        return config.parameters.verbal_delayed_match_sample;
    })();
    console.log("PARAMETERS")
    console.log(VERBAL_DMS_PARAMS)
    
    // Prepare the parameters that are stored as functions
    const buttonLabelFunc = eval('(' + VERBAL_DMS_PARAMS.ButtonLabels + ')');
    VERBAL_DMS_PARAMS.ButtonLabels = buttonLabelFunc()
    const KeyboardValuesFunc = eval('(' + VERBAL_DMS_PARAMS.KeyboardValues +')');
    VERBAL_DMS_PARAMS.KeyboardValues = KeyboardValuesFunc()
    const KeyboardMappingsFunc = eval('(' + VERBAL_DMS_PARAMS.KeyboardMappings +')');
    VERBAL_DMS_PARAMS.KeyboardMappings = KeyboardMappingsFunc()
    const ProbeColorFunc = eval('(' + VERBAL_DMS_PARAMS.ProbeColor +')');
    VERBAL_DMS_PARAMS.ProbeColor = ProbeColorFunc()

    // experiment parameters
    var countInstr = 0
    var Current = 4
    DMSFontSize = VERBAL_DMS_PARAMS.DMSFontSize
    var count = 0
    var stair1
    var FeedbackFlag = false
    var FeedbackText


    const TESTING_MODE = false;
    
    const MAX_TRIALS = VERBAL_DMS_PARAMS.MaxTrials;
    console.log("Max Trials: "+MAX_TRIALS)
    console.log("Keyboard mappings are:")
    console.log(VERBAL_DMS_PARAMS.KeyboardMappings)
    console.log("Keyboard values are:")
    console.log(VERBAL_DMS_PARAMS.KeyboardValues)    
    // test mode - set to true for quick testing
    const RUN_TEST = true;


    var setupPractice = {
        type: jsPsychCallFunction,
        func: function() {
            stair1 = new Stair(VERBAL_DMS_PARAMS.StartValue, VERBAL_DMS_PARAMS.MinValue, 
                VERBAL_DMS_PARAMS.MaxValue, VERBAL_DMS_PARAMS.MaxReversals, VERBAL_DMS_PARAMS.NPracticeTrials,
                VERBAL_DMS_PARAMS.StepSize, VERBAL_DMS_PARAMS.NUp, VERBAL_DMS_PARAMS.NDown, 
                VERBAL_DMS_PARAMS.FastStart);
            //document.getElementById("jspsych-progressbar-container").style.visibility = "visible"
            //document.getElementById("progress-bar-text").innerHTML = LabelNames.ProgressBar
            //jsPsych.setProgressBar(0)
            stimList = new AdaptiveStimulusList();    
            console.log("STIM LIST: ")
            console.log(stimList)
            FeedbackFlag = true
            console.log("STAIR: ")
            console.log(stair1)
        }
    }
    var setupTest = {
    type: jsPsychCallFunction,
    func: function() {
        stair1 = new Stair(VERBAL_DMS_PARAMS.StartValue, VERBAL_DMS_PARAMS.MinValue, 
            VERBAL_DMS_PARAMS.MaxValue, VERBAL_DMS_PARAMS.MaxReversals, VERBAL_DMS_PARAMS.MaxTrials,
            VERBAL_DMS_PARAMS.StepSize, VERBAL_DMS_PARAMS.NUp, VERBAL_DMS_PARAMS.NDown, 
            VERBAL_DMS_PARAMS.FastStart);
        //document.getElementById("jspsych-progressbar-container").style.visibility = "visible"
        //document.getElementById("progress-bar-text").innerHTML = LabelNames.ProgressBar
        //jsPsych.setProgressBar(0)
        FeedbackFlag = false
        console.log(stair1)
        }
    }
  
    var Stimulus = {
      type: jsPsychHtmlButtonResponse,
      stimulus: function(){
        console.log("Current: "+stair1.Current)
        console.log("Last Stim: "+stimList.getLastStim())
        console.log("Last Probe: "+stimList.getLastProbe())
        output = MakeAdaptiveStimulus(stair1.Current, stimList.getLastStim(), stimList.getLastProbe(),VERBAL_DMS_PARAMS.AllowableLetters)
        console.log(output)
        return PutLettersInGridV2(output[0],3,3,700,20,60)
        //return StimulusLetters
      },
      trial_duration: function() { return VERBAL_DMS_PARAMS.StimOnTime },
      choices: [],
      valid_choices: [],
      prompt: '',
      on_finish: function(data){
        stimList.addStim(output[2])
        stimList.addProbe(output[1][0])
        stimList.addCorrect(output[1][1])
        //data.trialType = "Stimulus",
        count += 1
        },
    }

       var Retention = {
      // Each trial also has its own specific cue which occurs BEFORE the stimulus presentation
      // The cue itself is actually made in the setup file and not here. This could be changed if desired
      type: jsPsychHtmlButtonResponse,
      stimulus: '<p style="font-size:'+VERBAL_DMS_PARAMS.DMSFontSize+'px; color:black">+</p>',
      choices: [],
      valid_choices: [],
      trial_duration: function() { return VERBAL_DMS_PARAMS.RetOnTime},
      //on_finish: function(data){
              // data.trialType = "Retention"
      //},
    } 

    var Probe = {
      type:jsPsychHtmlButtonResponse,
      stimulus: function() {
        return '<p style="color:'+VERBAL_DMS_PARAMS.ProbeColor+'; font-size:'+VERBAL_DMS_PARAMS.DMSFontSize+'px">'+stimList.CurrentProbe+'</p>'
      },
      choices: function() { return VERBAL_DMS_PARAMS.ButtonLabels},
      valid_choices: function() { return VERBAL_DMS_PARAMS.KeyboardValues },
      trial_duration: function() { return VERBAL_DMS_PARAMS.ProbeOnTime },
      on_finish: function(data){
        // NEED TO UPDATE THIS BASED ON TEH ADAPTIVE NATURE OF THE TRIALS
        // This puts the stimulus letters on the same line as the trial response
        data.ProbeLetter = stimList.CurrentProbe
        // tag this trial
        data.trialType = "Probe"
        data.StimLetters = stimList.getCurrentStim()
        data.Load = data.StimLetters.length
        var correct = stimList.getCurrentCorrect() //jsPsych.timelineVariable("Correct", true)
        // in the list of allowable key presses, what is the index of wehat was pressed?
        var ResponseMapping = VERBAL_DMS_PARAMS.KeyboardValues
        var KeyboardMappings = VERBAL_DMS_PARAMS.KeyboardMappings

        var ResponseIndex = ResponseMapping.indexOf(data.response)

        if ( KeyboardMappings[ResponseIndex] == correct) 
          {
            data.correct = 1,
            console.log(data)
            stair1.Decide(true, data.rt)
            FeedbackText = LabelNames.Correct
          }
        else {
          data.correct = 0
          stair1.Decide(false, data.rt)
          FeedbackText = LabelNames.Incorrect
        }
        /* If the ESCAPE key is pressed the current timeline is ended and the thank you screen is shown */
        if (data.response == 27) {jsPsych.end();}

      }
    }


  var Fix = {
      type: jsPsychHtmlButtonResponse,
      stimulus: function(data) {
        console.log(FeedbackFlag)
        if ( FeedbackFlag )
        {return '<p style="font-size:'+VERBAL_DMS_PARAMS.DMSFontSize+'px; color:'+ProbeColor+'">'+FeedbackText+'</p>'}
        else 
          {return '<p style="font-size:'+VERBAL_DMS_PARAMS.DMSFontSize+'px; color:'+ProbeColor+'">+</p>'}
      },
      choices: [],
      valid_choices: [],
      trial_duration: function() { return parameters.ITITime},
     // on_finish: function(data){
     //   data.trialType = "fixation"
     // }
    } 


    // Define any logic used 

    var loop_node = {
    timeline: [Stimulus, Retention, Probe, Fix],
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
            var Str = jatos.studySessionData.translations.verbal_dms_welcome_text            
            return Str
        },
        post_trial_gap: 0,
        //margin_horizontal: function() { return GapBetweenButtons },
        choices: [jatos.studySessionData.translations.button_continue],  
    }
    
var thank_you = {
    type: jsPsychHtmlButtonResponse,
    stimulus: function() {
      return jatos.studySessionData.translations.goodbye_text
    },
    post_trial_gap: 0,    
    choices: [jatos.studySessionData.translations.button_continue],  
    on_finish: function() {
        jatos.endStudy()
    }
}

    var Instructions01a = {
        type: jsPsychHtmlButtonResponse,
        stimulus: function() { 
            var Str = jatos.studySessionData.translations.verbal_dms_instructions01a            
            return Str
        },
        post_trial_gap: 0,
        //margin_horizontal: function() { return GapBetweenButtons },
        choices: [jatos.studySessionData.translations.button_continue],  
    }
    var Instructions01b = {
        type: jsPsychHtmlButtonResponse,
        stimulus: function() { 
            var Str = jatos.studySessionData.translations.verbal_dms_instructions01b
            return Str
        },
        post_trial_gap: 0,
        //margin_horizontal: function() { return GapBetweenButtons },
        choices: [jatos.studySessionData.translations.button_continue],  
    }
    var Instructions01c = {
        type: jsPsychHtmlButtonResponse,
        stimulus: function() { 
            var Str = jatos.studySessionData.translations.verbal_dms_instructions01c 
            return Str
        },
        post_trial_gap: 0,
        //margin_horizontal: function() { return GapBetweenButtons },
        choices: [jatos.studySessionData.translations.button_continue],  
    }
    var Instructions02 = {
        type: jsPsychHtmlButtonResponse,
        stimulus: function() { 
            var Str = jatos.studySessionData.translations.VERBAL_dms_instructions02 
            return Str
        },
        post_trial_gap: 0,
        //margin_horizontal: function() { return GapBetweenButtons },
        choices: [jatos.studySessionData.translations.button_continue],  
    }
    var Instructions03 = {
        type: jsPsychHtmlButtonResponse,
        stimulus: function() { 
            var Str = jatos.studySessionData.translations.verbal_dms_instructions03 
            return Str
        },
        post_trial_gap: 0,
        //margin_horizontal: function() { return GapBetweenButtons },
        choices: [jatos.studySessionData.translations.button_continue],  
    }

    var SendData = {
    type: jsPsychCallFunction,
    func: function() {
        var data = jsPsych.data.get()
        Results = DMS_Scoring(stair1, data)    
        jsPsych.finishTrial(Results)
        jatos.submitResultData(Results)
    },
    }    
    // timeline.push(WelcomeWritten)
    // timeline.push(Instructions01a)
    // timeline.push(Instructions01b)
    // timeline.push(Instructions01c)
    // timeline.push(Instructions02)
     timeline.push(setupPractice)
     timeline.push(loop_node)
    // timeline.push(Instructions03)
    // timeline.push(setupTest)
    // timeline.push(loop_node)
    // timeline.push(SendData)
    // timeline.push(thank_you)
    jsPsych.run(timeline);
})