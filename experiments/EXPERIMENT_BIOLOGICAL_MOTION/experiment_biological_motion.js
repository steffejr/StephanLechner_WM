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

    const BIOLOGICAL_MOTION_PARAMS = (() => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'sequence_config.json5', false);
        xhr.send();
        const config = parseJSON5(xhr.responseText);
        return config.parameters.biological_motion;
    })();

    // experiment parameters
    const TESTING_MODE = false;
    const GIF_FOLDER = "experiments/EXPERIMENT_BIOLOGICAL_MOTION/point_light_walkers/";
    const TRIALS_PER_BLOCK = BIOLOGICAL_MOTION_PARAMS.trials_per_block;
    const TOTAL_BLOCKS = 2;
    
    // test mode - set to true for quick testing
    const RUN_TEST = true;

    // determine block order (counterbalancing)
    const participantNumber = parseInt(subjectId.replace(/\D/g, '')) || 1;
    const BLOCK_ORDER = participantNumber % 2 === 0 ? 
        ["Emotion", "Speed"] : ["Speed", "Emotion"];
    
    console.log(`Participant ${subjectId}: Block order = ${BLOCK_ORDER.join(" → ")}`);
    if (RUN_TEST) console.log("RUNNING IN TEST MODE - each block will finish after 1 trial");

    // training parameters - updated for 2-question design
    const TRAINING_TRIALS = [
        // emotion training (unscrambled)
        { question: "Emotion", emotionPair: ["neutral", "sad"], speed: "slow", direction: "left", structure: "unscrambled", trials: 2 },
        { question: "Emotion", emotionPair: ["neutral", "sad"], speed: "fast", direction: "right", structure: "unscrambled", trials: 2 },
        
        // speed training (unscrambled)
        { question: "Speed", emotion: "neutral", direction: "left", structure: "unscrambled", trials: 2 },
        { question: "Speed", emotion: "sad", direction: "right", structure: "unscrambled", trials: 2 }
    ];

    // global variables
    let trialSequence = [];
    let balanceStats = {};
    let blockInstructions = [];

    // generate balanced trial sequence for 2-block design
    function generateBalancedTrialSequence(translations) {
        console.log("=== GENERATING 2-BLOCK TRIAL SEQUENCE ===");
        console.log("Block order:", BLOCK_ORDER);

        // define the 8 unique stimuli
        const stimuli = [
            "PLW_left_neutral_slow_unscrambled.gif",
            "PLW_left_neutral_fast_unscrambled.gif",
            "PLW_left_sad_slow_unscrambled.gif",
            "PLW_left_sad_fast_unscrambled.gif",
            "PLW_right_neutral_slow_unscrambled.gif",
            "PLW_right_neutral_fast_unscrambled.gif",
            "PLW_right_sad_slow_unscrambled.gif",
            "PLW_right_sad_fast_unscrambled.gif"
        ];

        const generatedSequence = [];

        // generate both blocks
        for (let blockIdx = 0; blockIdx < 2; blockIdx++) {
            const blockType = BLOCK_ORDER[blockIdx];
            const blockNumber = blockIdx + 1;
            
            console.log(`\nGenerating Block ${blockNumber}: ${blockType}`);

            // create balanced stimulus list: 6 stimuli × 11 + 2 stimuli × 12 = 90
            let blockStimuli = [];
            const shuffledStimuli = [...stimuli].sort(() => Math.random() - 0.5);
            
            // 6 stimuli get 11 appearances
            for (let i = 0; i < 6; i++) {
                blockStimuli = blockStimuli.concat(Array(11).fill(shuffledStimuli[i]));
            }
            // 2 stimuli get 12 appearances
            for (let i = 6; i < 8; i++) {
                blockStimuli = blockStimuli.concat(Array(12).fill(shuffledStimuli[i]));
            }

            // shuffle the block stimuli
            blockStimuli.sort(() => Math.random() - 0.5);

            // create trials for this block
            blockStimuli.forEach((filename, trialIdx) => {
                const baseName = filename.replace('.gif', '');
                const parts = baseName.split('_');
                
                const direction = parts[1];
                const emotion = parts[2];
                const speed = parts[3];
                const structure = parts[4];
                const question = blockType;

                let correctResponse = "";
                let correctKey = "";
                let leftLabel = "";
                let middleLabel = "";
                let rightLabel = "";
                
                if (question === "Emotion") {
                    correctResponse = emotion;
                    if (emotion === "neutral") {
                        correctKey = '1';
                    } else if (emotion === "sad") {
                        correctKey = '3';
                    }
                    leftLabel = "" // translations.biological_motion_emotion_label_neutral;
                    middleLabel = "";
                    rightLabel = "" // translations.biological_motion_emotion_label_sad;
                    
                } else if (question === "Speed") {
                    correctResponse = speed;
                    correctKey = speed === "slow" ? '1' : '3';
                    leftLabel = "" // translations.biological_motion_speed_label_slow;
                    middleLabel = "";
                    rightLabel = "" // translations.biological_motion_speed_label_fast;
                }

                const trialData = {
                    filename: filename,
                    question: question,
                    direction: direction,
                    emotion: emotion,
                    speed: speed,
                    structure: structure,
                    left_label: leftLabel,
                    middle_label: middleLabel,
                    right_label: rightLabel,
                    correct_response: correctResponse,
                    correct_key: correctKey,
                    participant_response: null,
                    response_key: null,
                    response_correct: null,
                    rt: null,
                    trial_completed: false,
                    block_number: blockNumber,
                    block_type: blockType,
                    block_trial_number: trialIdx + 1
                };

                generatedSequence.push(trialData);
            });

            // create block instruction
            let instructionText = "";
            if (blockType === "Emotion") {
                instructionText = translations.block_instruction_mood;
            } else if (blockType === "Speed") {
                instructionText = translations.block_instruction_speed;
            }
            
            blockInstructions.push({
                block_number: blockNumber,
                block_type: blockType,
                instruction: instructionText
            });
        }

        // calculate and display statistics
        balanceStats = calculateStatistics(generatedSequence);
        displaySequenceStatistics(generatedSequence);
        return generatedSequence;
    }

    function displaySequenceStatistics(sequence) {
        console.log("\n=== SEQUENCE STATISTICS ===");
        
        // overall counts
        const emotionTrials = sequence.filter(t => t.question === "Emotion").length;
        const speedTrials = sequence.filter(t => t.question === "Speed").length;
        console.log(`Emotion trials: ${emotionTrials}`);
        console.log(`Speed trials: ${speedTrials}`);
        console.log(`Total trials: ${sequence.length}`);

        // block 1 stats
        const block1 = sequence.filter(t => t.block_number === 1);
        console.log(`\nBlock 1 (${block1[0].block_type}):`);
        displayBlockStatistics(block1);

        // block 2 stats
        const block2 = sequence.filter(t => t.block_number === 2);
        console.log(`\nBlock 2 (${block2[0].block_type}):`);
        displayBlockStatistics(block2);

        // stimulus appearances
        console.log("\n=== STIMULUS APPEARANCES ===");
        const stimCounts = {};
        sequence.forEach(t => {
            stimCounts[t.filename] = (stimCounts[t.filename] || 0) + 1;
        });
        Object.entries(stimCounts).sort().forEach(([stim, count]) => {
            console.log(`${stim}: ${count} times`);
        });
    }

    function displayBlockStatistics(blockTrials) {
        const directionCounts = { left: 0, right: 0 };
        const emotionCounts = { neutral: 0, sad: 0 };
        const speedCounts = { slow: 0, fast: 0 };

        blockTrials.forEach(t => {
            directionCounts[t.direction]++;
            emotionCounts[t.emotion]++;
            speedCounts[t.speed]++;
        });

        console.log(`  Direction: Left=${directionCounts.left}, Right=${directionCounts.right}`);
        console.log(`  Emotion: Neutral=${emotionCounts.neutral}, Sad=${emotionCounts.sad}`);
        console.log(`  Speed: Slow=${speedCounts.slow}, Fast=${speedCounts.fast}`);
    }

    function calculateStatistics(trialSeq) {
        const stimCounts = {};
        const questionCounts = {};
        const emotionCounts = {};
        const matrix = {};
        
        trialSeq.forEach(trial => {
            stimCounts[trial.filename] = (stimCounts[trial.filename] || 0) + 1;
            questionCounts[trial.question] = (questionCounts[trial.question] || 0) + 1;
            emotionCounts[trial.emotion] = (emotionCounts[trial.emotion] || 0) + 1;
            
            if (!matrix[trial.filename]) {
                matrix[trial.filename] = {
                    "Emotion": 0,
                    "Speed": 0
                };
            }
            
            matrix[trial.filename][trial.question]++;
        });

        const counts = Object.values(stimCounts);
        
        return {
            stimulus_counts: stimCounts,
            question_counts: questionCounts,
            emotion_counts: emotionCounts,
            stimulus_question_matrix: matrix,
            min_appearances: Math.min(...counts),
            max_appearances: Math.max(...counts),
            total_trials: trialSeq.length,
            total_blocks: 2
        };
    }

    const translations = jatos.studySessionData.translations;
    trialSequence = generateBalancedTrialSequence(translations);

    function preloadGifs() {
        const uniqueGifs = [...new Set(trialSequence.map(t => t.filename))];
        console.log(`Preloading ${uniqueGifs.length} GIFs...`);
        
        let loaded = 0;
        let failed = 0;
        
        uniqueGifs.forEach(filename => {
            const img = new Image();
            img.onload = () => {
                loaded++;
                console.log(`✓ ${filename} loaded (${loaded}/${uniqueGifs.length})`);
            };
            img.onerror = () => {
                failed++;
                console.error(`✗ Failed to load: ${filename}`);
            };
            
            img.src = GIF_FOLDER + filename + '?preload=' + Date.now();
        });
    }

    preloadGifs();
    setTimeout(preloadGifs, 100);

    // training functions
    function createTrainingTrial(trainingConfig, trialNum, totalTrainingTrials) {
        let correctAnswer, leftAnchor, rightAnchor, middleTarget;
        let leftLabel = "", rightLabel = "";
        let questionText = "";
        
        if (trainingConfig.question === "Speed") {
            correctAnswer = Math.random() < 0.5 ? "slow" : "fast";
            questionText = translations.biological_motion_training_trial_speed;
            
            leftAnchor = `PLW_${trainingConfig.direction}_${trainingConfig.emotion}_slow_unscrambled.gif`;
            rightAnchor = `PLW_${trainingConfig.direction}_${trainingConfig.emotion}_fast_unscrambled.gif`;
            middleTarget = `PLW_${trainingConfig.direction}_${trainingConfig.emotion}_${correctAnswer}_${trainingConfig.structure}.gif`;
            
            leftLabel = translations.biological_motion_speed_label_slow;
            rightLabel = translations.biological_motion_speed_label_fast;
            
            } else if (trainingConfig.question === "Emotion") {
                correctAnswer = trainingConfig.emotionPair[Math.floor(Math.random() * trainingConfig.emotionPair.length)];
                questionText = translations.biological_motion_training_trial_mood;
                
                const [emotion1, emotion2] = trainingConfig.emotionPair;
                leftAnchor = `PLW_${trainingConfig.direction}_${emotion1}_${trainingConfig.speed}_unscrambled.gif`;
                rightAnchor = `PLW_${trainingConfig.direction}_${emotion2}_${trainingConfig.speed}_unscrambled.gif`;
                middleTarget = `PLW_${trainingConfig.direction}_${correctAnswer}_${trainingConfig.speed}_${trainingConfig.structure}.gif`;
                
                leftLabel = translations[`biological_motion_emotion_label_${emotion1}`];
                rightLabel = translations[`biological_motion_emotion_label_${emotion2}`];
            }
            
            let correctKey;
            if (trainingConfig.question === "Speed") {
                correctKey = correctAnswer === "slow" ? '1' : '3';
            } else if (trainingConfig.question === "Emotion") {
                const [emotion1, emotion2] = trainingConfig.emotionPair;
                correctKey = correctAnswer === emotion1 ? '1' : '3';
            }
        
        return {
            type: jsPsychHtmlKeyboardResponse,
            stimulus: `
                <div style="display: flex; flex-direction: column; align-items: center; height: 80vh; justify-content: center;">
                    <div style="font-size: 24px; color: white; margin-bottom: 30px; text-align: center;">
                        ${translations.biological_motion_training_trial_counter.replace('{current}', trialNum + 1).replace('{total}', totalTrainingTrials)}<br>
                        ${questionText}
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; width: 90%; margin-bottom: 30px;">
                        <div style="font-size: 28px; color: #4CAF50; font-weight: bold; text-align: center; flex: 1;">
                            ${leftLabel}<br>(${translations.biological_motion_press_button} 1)
                        </div>
                        <div style="font-size: 28px; color: white; font-weight: bold; text-align: center; flex: 1;">
                            ?
                        </div>
                        <div style="font-size: 28px; color: #FF5252; font-weight: bold; text-align: center; flex: 1;">
                            ${rightLabel}<br>(${translations.biological_motion_press_button} 3)
                        </div>
                    </div>
                    
                    <div style="display: flex; justify-content: center; align-items: center; width: 100%; gap: 50px;">
                        <div id="left-anchor-${trialNum}" style="flex: 1; text-align: center;"></div>
                        <div id="middle-target-${trialNum}" style="flex: 1; text-align: center;"></div>
                        <div id="right-anchor-${trialNum}" style="flex: 1; text-align: center;"></div>
                    </div>
                    
                    <div style="margin-top: 40px; font-size: 20px; color: #aaa;">
                        ${translations.biological_motion_training_trial_instructions}
                    </div>
                </div>
            `,
            choices: ['1', '3'],
            data: {
                task: 'training',
                training_trial: trialNum + 1,
                total_training_trials: totalTrainingTrials,
                question: trainingConfig.question,
                correct_answer: correctAnswer,
                correct_key: correctKey,
                structure: trainingConfig.structure,
                left_anchor: leftAnchor,
                middle_target: middleTarget,
                right_anchor: rightAnchor
            },

            on_load: function() {
                const leftContainer = document.getElementById(`left-anchor-${trialNum}`);
                const middleContainer = document.getElementById(`middle-target-${trialNum}`);
                const rightContainer = document.getElementById(`right-anchor-${trialNum}`);
                
                [leftContainer, middleContainer, rightContainer].forEach((container, index) => {
                    const img = new Image();
                    const src = GIF_FOLDER + [leftAnchor, middleTarget, rightAnchor][index];
                    img.src = src;
                    img.style.width = '100%';
                    img.style.maxWidth = '250px';
                    img.style.height = 'auto';
                    container.appendChild(img);
                });
            },
            on_finish: function(data) {
                const responseKey = data.response ? data.response.toLowerCase() : null;
                const isCorrect = responseKey === correctKey;
                
                let participantResponse = "";
                if (trainingConfig.question === "Speed") {
                    participantResponse = responseKey === '1' ? "slow" : "fast";
                } else if (trainingConfig.question === "Emotion") {
                    const [emotion1, emotion2] = trainingConfig.emotionPair;
                    participantResponse = responseKey === '1' ? emotion1 : emotion2;
                }
                
                data.response_correct = isCorrect;
                data.participant_response = participantResponse;
                
                console.log(`Training trial ${trialNum + 1}: ${isCorrect ? 'CORRECT' : 'INCORRECT'}`);
            }
        };
    }

    function generateTrainingTimeline() {
        const trainingTimeline = [];
        let trialCounter = 0;
        
        // total training trials
        const totalTraining = TRAINING_TRIALS.reduce((sum, config) => sum + config.trials, 0);
        
        // training instructions
        trainingTimeline.push({
            type: jsPsychHtmlKeyboardResponse,
            stimulus: translations.biological_motion_training_instructions,
            choices: [],
            on_load: function() {
                document.getElementById('start-training-btn').addEventListener('click', function() {
                    jsPsych.finishTrial();
                });
            }
        });
        
        // generate training trials
        TRAINING_TRIALS.forEach(config => {
            for (let i = 0; i < config.trials; i++) {
                const trialWithFeedback = {
                    timeline: [
                        createTrainingTrial(config, trialCounter, totalTraining),
                        {
                            type: jsPsychHtmlKeyboardResponse,
                            stimulus: function() {
                                const lastTrial = jsPsych.data.get().last(1).values()[0];
                                const isCorrect = lastTrial.response_correct;
                                const correctAnswer = lastTrial.correct_answer;
                                const responseKey = lastTrial.participant_response;
                                
                                let leftLabel = "", rightLabel = "";
                                if (lastTrial.question === "Speed") {
                                    leftLabel = translations.biological_motion_speed_label_slow;
                                    rightLabel = translations.biological_motion_speed_label_fast;
                                } else if (lastTrial.question === "Emotion") {
                                    leftLabel = translations[`biological_motion_emotion_label_${lastTrial.left_anchor.includes("neutral") ? "neutral" : "sad"}`];
                                    rightLabel = translations[`biological_motion_emotion_label_${lastTrial.right_anchor.includes("neutral") ? "neutral" : "sad"}`];
                                }
                                
                                let correctAnswerDisplay = "";
                                if (lastTrial.question === "Speed") {
                                    correctAnswerDisplay = correctAnswer === "slow" ? 
                                        translations.biological_motion_speed_label_slow : 
                                        translations.biological_motion_speed_label_fast;
                                } else if (lastTrial.question === "Emotion") {
                                    correctAnswerDisplay = translations[`biological_motion_emotion_label_${correctAnswer.toLowerCase()}`];
                                }
                                
                                return `
                                    <div style="text-align: center; font-size: 32px; padding: 40px; height: 80vh; display: flex; flex-direction: column; justify-content: center;">
                                        <div style="font-size: 72px; margin-bottom: 30px;">
                                            ${isCorrect ? '✅' : '❌'}
                                        </div>
                                        <div style="font-size: 36px; margin-bottom: 30px; color: ${isCorrect ? '#4CAF50' : '#FF5252'}">
                                            ${isCorrect ? translations.biological_motion_feedback_correct : translations.biological_motion_feedback_incorrect}
                                        </div>
                                        <div style="font-size: 24px; color: #aaa; margin-bottom: 20px;">
                                            ${translations.biological_motion_feedback_walker} <strong style="color: white;">${correctAnswerDisplay}</strong>
                                        </div>
                                            ${!isCorrect ? `<div style="font-size: 20px; color: #FF9800; margin-top: 20px;">
                                            ${translations.biological_motion_feedback_selection} ${lastTrial.participant_response}
                                        </div>` : ''}
                                        <div style="margin-top: 50px; font-size: 20px; color: #888;">
                                            ${translations.biological_motion_feedback_next_trial_in}
                                        </div>
                                    </div>
                                `;
                            },
                            choices: [],
                            trial_duration: 1500,
                            data: {
                                task: 'training_feedback',
                                trial_num: trialCounter + 1
                            }
                        }
                    ]
                };
                
                trainingTimeline.push(trialWithFeedback);
                trialCounter++;
            }
        });
        
        // transition to main experiment
        trainingTimeline.push({
            type: jsPsychHtmlKeyboardResponse,
            stimulus: translations.biological_motion_training_complete,
            choices: [],
            on_load: function() {
                document.getElementById('start-main-btn').addEventListener('click', function() {
                    jsPsych.finishTrial();
                });
            }
        });
        
        return trainingTimeline;
    }

    // main instruction trials
    function createInstructionTrial(pageNumber) {
        const totalPages = 2;
        
        let stimulusHTML = '';
        
        if (pageNumber === 1) {
            stimulusHTML = translations.biological_motion_introduction_page_1;
        } else if (pageNumber === 2) {
            stimulusHTML = translations.biological_motion_introduction_page_2;
        }
        
        let buttonsHTML = '<div style="display: flex; justify-content: space-between; margin-top: 50px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.2);">';
        
        if (pageNumber > 1) {
            buttonsHTML += `
                <button id="prev-btn" style="
                    font-size: 20px;
                    padding: 12px 30px;
                    background-color: #555;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                ">
                    ← ${translations.biological_motion_button_previous}
                </button>
            `;
        } else {
            buttonsHTML += '<div style="width: 120px;"></div>';
        }
        
        if (pageNumber < totalPages) {
            buttonsHTML += `
                <button id="next-btn" style="
                    font-size: 20px;
                    padding: 12px 30px;
                    background-color: #4CAF50;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                ">
                    ${translations.biological_motion_button_next} →
                </button>
            `;
        } else {
            buttonsHTML += `
                <button id="start-btn" style="
                    font-size: 20px;
                    padding: 12px 40px;
                    background-color: #2196F3;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                    font-weight: bold;
                ">
                    ${translations.biological_motion_start_training_button}
                </button>
            `;
        }
        
        buttonsHTML += '</div>';
        stimulusHTML += buttonsHTML;
        
        return {
            type: jsPsychHtmlKeyboardResponse,
            stimulus: stimulusHTML,
            choices: [],
            data: {
                task: 'instruction',
                page: pageNumber
            },
            on_load: function() {
                if (pageNumber > 1) {
                    document.getElementById('prev-btn').addEventListener('click', function() {
                        jsPsych.finishTrial({action: 'previous'});
                    });
                }
                
                if (pageNumber < totalPages) {
                    document.getElementById('next-btn').addEventListener('click', function() {
                        jsPsych.finishTrial({action: 'next'});
                    });
                } else {
                    document.getElementById('start-btn').addEventListener('click', function() {
                        jsPsych.finishTrial({action: 'start'});
                    });
                }
            }
        };
    }

    const instructionTimeline = {
        timeline: [],
        loop_function: function(data) {
            const lastTrialData = jsPsych.data.get().last(1).values()[0];
            const action = lastTrialData.action;
            
            if (action === 'next') {
                instructionTimeline.timeline = [createInstructionTrial(lastTrialData.page + 1)];
                return true;
            } else if (action === 'previous') {
                instructionTimeline.timeline = [createInstructionTrial(lastTrialData.page - 1)];
                return true;
            } else if (action === 'start') {
                return false;
            }
            
            return false;
        }
    };

    instructionTimeline.timeline = [createInstructionTrial(1)];

    // block instruction
    function createBlockInstruction(blockNum, blockType) {
        const instruction = blockInstructions.find(b => b.block_number === blockNum);
        return {
            type: jsPsychHtmlKeyboardResponse,
            stimulus: instruction.instruction,
            choices: [' '],
            data: {
                task: 'block_instruction',
                block_number: blockNum,
                block_type: blockType
            }
        };
    }

    // main trial
    function createPLWTrial(trialData, trialIndex) {
        const choices = ['1', '3'];
        
        const labelHTML = `
            <div style="display: flex; justify-content: space-between; width: 80%; margin-bottom: 30px;">
                <div style="font-size: 28px; color: #4CAF50; font-weight: bold; text-align: center; flex: 1;">
                    ${trialData.left_label}
                </div>
                <div style="font-size: 28px; color: #FF5252; font-weight: bold; text-align: center; flex: 1;">
                    ${trialData.right_label}
                </div>
            </div>
        `;
        
        const imgSrc = GIF_FOLDER + trialData.filename;
        
        return {
            type: jsPsychHtmlKeyboardResponse,
            stimulus: `
                <div style="display: flex; flex-direction: column; align-items: center; height: 80vh; justify-content: center;">
                    ${labelHTML}
                    
                    <div style="display: flex; justify-content: center; align-items: center; flex: 1; width: 100%;" id="gif-container-${trialIndex}">
                    </div>
                </div>
            `,
            choices: choices,
            data: {
                trial_index: trialIndex,
                stimulus: trialData.filename,
                question: trialData.question,
                correct_key: trialData.correct_key,
                correct_response: trialData.correct_response,
                block_number: trialData.block_number,
                block_type: trialData.block_type,
                block_trial_number: trialData.block_trial_number,
                task: 'main_judgment'
            },
            on_load: function() {
                const container = document.getElementById(`gif-container-${trialIndex}`);
                if (container) {
                    const img = new Image();
                    img.src = imgSrc;
                    img.style.maxWidth = 'none';
                    img.style.width = '50%';
                    img.style.height = 'auto';
                    container.appendChild(img);
                }
            },
            on_finish: function(data) {
                const responseKey = data.response ? data.response.toLowerCase() : null;
                const isCorrect = responseKey === trialData.correct_key;
                
                let participantResponse = "";
                if (trialData.question === "Emotion") {
                    participantResponse = responseKey === '1' ? "neutral" : "sad";
                } else if (trialData.question === "Speed") {
                    participantResponse = responseKey === '1' ? "slow" : "fast";
                }
                
                trialData.response_key = responseKey;
                trialData.participant_response = participantResponse;
                trialData.response_correct = isCorrect;
                trialData.rt = data.rt;
                trialData.trial_completed = true;
                
                data.participant_response = participantResponse;
                data.response_correct = isCorrect;
                
                console.log(`Trial ${trialIndex + 1}: ${isCorrect ? 'CORRECT' : 'INCORRECT'} (${participantResponse})`);
            }
        };
    }

    // fixation cross
    const fixationCross = {
        type: jsPsychHtmlKeyboardResponse,
        stimulus: '<div style="font-size: 60px; text-align: center; color: white;">+</div>',
        choices: "NO_KEYS",
        trial_duration: 1000,
        data: {
            task: 'fixation'
        }
    };

    // save data
    function saveData() {      
        const trialByTrialData = jsPsych.data.get().values();
        const completedTrials = trialSequence.filter(t => t.trial_completed);
        const correctTrials = completedTrials.filter(t => t.response_correct).length;
        
        const totalRT = completedTrials.reduce((sum, t) => sum + (t.rt || 0), 0);
        const avgRT = completedTrials.length > 0 ? totalRT / completedTrials.length : 0;
        const accuracy = completedTrials.length > 0 ? correctTrials / completedTrials.length : 0;
        
        console.log(`Completed: ${completedTrials.length}/${trialSequence.length} trials`);
        console.log(`Accuracy: ${(accuracy * 100).toFixed(1)}%`);
        console.log(`Average RT: ${avgRT.toFixed(0)}ms`);
        
        const completeData = {
            subject_info: {
                subject_id: subjectId,
                date: new Date().toISOString(),
                session_duration: jsPsych.getTotalTime() / 1000,
                block_order: BLOCK_ORDER
            },
            experiment_parameters: {
                total_trials: 180,
                total_blocks: 2,
                trials_per_block: 90,
                testing_mode: TESTING_MODE,
                gif_folder: GIF_FOLDER
            },
            
            balance_statistics: balanceStats,
            block_instructions: blockInstructions,
            
            trial_sequence: trialSequence.map((trial, index) => {
                return {
                    trial_number: index + 1,
                    block_info: {
                        block_number: trial.block_number,
                        block_type: trial.block_type,
                        block_trial_number: trial.block_trial_number
                    },
                    filename: trial.filename,
                    question: trial.question,
                    physical_parameters: {
                        direction: trial.direction,
                        emotion: trial.emotion,
                        speed: trial.speed,
                        structure: trial.structure
                    },
                    trial_parameters: {
                        left_label: trial.left_label,
                        middle_label: trial.middle_label,
                        right_label: trial.right_label,
                        correct_response: trial.correct_response,
                        correct_key: trial.correct_key
                    },
                    responses: {
                        participant_response: trial.participant_response,
                        response_key: trial.response_key,
                        response_correct: trial.response_correct,
                        rt: trial.rt
                    },
                    trial_completed: trial.trial_completed
                };
            }),
            
            performance_summary: {
                completed_trials: completedTrials.length,
                accuracy: accuracy,
                correct_trials: correctTrials,
                mean_rt: avgRT,
                total_session_time: jsPsych.getTotalTime()
            },
            
            raw_jspsych_data: trialByTrialData
        };

        if (!jatos.studySessionData.experimentData) {
            jatos.studySessionData.experimentData = {};
        }
        
        jatos.studySessionData.experimentData.biologicalMotion = completeData;
        jatos.setStudySessionData(jatos.studySessionData);
        
        jatos.submitResultData(completeData, function() {
            console.log("Data submitted");
        });
    }

    // continue to next
    function showThankYouScreen() {
        document.getElementById('jspsych-content').innerHTML = jatos.studySessionData.translations.biological_motion_complete;

        // document.getElementById('continue-btn').onclick = function() {
        //     if (window.continueToNext) {
        //         window.continueToNext();
        //     } else {
        //         console.error("continueToNext not found!");
        //     }
        // };
        document.getElementById('continue-btn').onclick = () => window.continueToNext();
    }

    // Ctrl+C abort
    document.addEventListener('keydown', function(event) {
        if (event.ctrlKey && event.key === 'z') {
            event.preventDefault();
            
            setTimeout(() => {
                const currentTrials = jsPsych.data.get().filter({task: 'main_judgment'}).count();
                for (let i = 0; i < currentTrials && i < trialSequence.length; i++) {
                    if (!trialSequence[i].trial_completed) {
                        trialSequence[i].trial_completed = true;
                    }
                }
                
                saveData();
                document.body.innerHTML = `
                    <div style="font-size: 24px; text-align: center; padding: 50px; color: white;">
                        <h1>Experiment Aborted</h1>
                        <p>Data has been saved.</p>
                    </div>
                `;
            }, 100);
        }
    });

    // create timeline
    var timeline = [];
    timeline.push(instructionTimeline);

    // style reset after instructions
    timeline.push({
        type: jsPsychHtmlKeyboardResponse,
        stimulus: '<div style="display: none;"></div>',
        trial_duration: 1,
        on_load: function() {
            const container = document.getElementById('jspsych-content');
            if (container) {
                container.style.padding = '';
                container.style.margin = '';
                container.style.maxWidth = '';
                container.style.overflow = 'visible';
            }
        }
    });

    // training block
    const trainingTimeline = generateTrainingTimeline();
    timeline.push({
        timeline: trainingTimeline
    });
    
    // style reset after training
    timeline.push({
        type: jsPsychHtmlKeyboardResponse,
        stimulus: '<div style="display: none;"></div>',
        trial_duration: 1,
        on_load: function() {
            const container = document.getElementById('jspsych-content');
            if (container) {
                container.style.padding = '';
                container.style.margin = '';
                container.style.overflow = 'visible';
            }
        }
    });

    // group trials by block
    const trialsByBlock = {};
    trialSequence.forEach((trialData, index) => {
        if (!trialsByBlock[trialData.block_number]) {
            trialsByBlock[trialData.block_number] = [];
        }
        trialsByBlock[trialData.block_number].push({trialData, index});
    });

    // add blocks to timeline
    Object.keys(trialsByBlock).sort((a, b) => a - b).forEach((blockNum, blockIdx) => {
        const blockTrials = trialsByBlock[blockNum];
        const blockType = blockTrials[0].trialData.block_type;
        
        // add break between blocks
        if (blockIdx === 1) {
            timeline.push({
            type: jsPsychHtmlKeyboardResponse,
            stimulus: `
                <div style="text-align: center; padding: 50px; color: white;">
                    <h1 style="font-size: 48px; margin-bottom: 30px;">Break Time!</h1>
                    <p style="font-size: 24px; margin-bottom: 20px;">You've completed Block 1.</p>
                    <p style="font-size: 20px; color: #aaa;">Take a short break. Press SPACE when ready to continue.</p>
                </div>
            `,
            choices: [' '],
            trial_duration: BIOLOGICAL_MOTION_PARAMS.block_break_duration,
            data: {
                task: 'break'
            }
        });
        }
        
        // block instruction
        timeline.push(createBlockInstruction(parseInt(blockNum), blockType));
        
        // add trials
        let trialsToAdd = blockTrials;
        if (RUN_TEST) {
            // trialsToAdd = [blockTrials[0]]; // only take first trial in testing mode
            trialsToAdd = blockTrials.slice(0, BIOLOGICAL_MOTION_PARAMS.trials_per_block);

        }
        
        trialsToAdd.forEach(({trialData, index}) => {
            timeline.push(createPLWTrial(trialData, index));
            
            // fixation between trials (not after last trial in block)
            if (trialData.block_trial_number < TRIALS_PER_BLOCK) {
                timeline.push(fixationCross);
            }
        });
    });

    timeline.push({
        type: jsPsychHtmlKeyboardResponse,
        stimulus: '<div style="display: none;"></div>',
        trial_duration: 100,
        on_finish: function() {}
    });

    jsPsych.run(timeline);
});