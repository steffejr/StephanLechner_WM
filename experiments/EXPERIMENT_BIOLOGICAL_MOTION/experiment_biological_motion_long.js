jatos.onLoad(function() {
    if (window.biologicalMotionExperimentRunning) {     // prevents JATOS from repeatedly running same experimetn
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


    // ============ LOAD PARAMETERS FROM CONFIG ============
    // Simple JSON5 parser that removes comments
    function parseJSON5(json5String) {
        console.log("Original:", json5String);
        
        // Remove single-line comments
        json5String = json5String.replace(/\/\/.*$/gm, '');
        console.log("After removing comments:", json5String);
        
        // Remove multi-line comments  
        json5String = json5String.replace(/\/\*[\s\S]*?\*\//g, '');
        
        // FIX: Remove trailing commas in objects and arrays
        json5String = json5String.replace(/,(\s*[}\]])/g, '$1');
        
        // Parse as regular JSON
        return JSON.parse(json5String);
    }

    const BIOLOGICAL_MOTION_PARAMS = (() => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'sequence_config.json5', false);
        xhr.send();
        const config = parseJSON5(xhr.responseText);
        return config.parameters.biological_motion;
    })();
    // ============================================

    //  experiment parameters 
    const GIF_FOLDER = "experiments/EXPERIMENT_BIOLOGICAL_MOTION/point_light_walkers/";

   //  training parameters
    const TRAINING_TRIALS = [
        // Part 1: nscrambled middle
        // 1. Direction unscrambled
        { question: "Direction", emotion: "neutral", speed: "slow", structure: "unscrambled", trials: 1 },
        // 2. Speed unscrambled  
        { question: "Speed", emotion: "neutral", direction: "left", structure: "unscrambled", trials: 1 },
        // 3. Emotion: Happy vs Sad unscrambled
        { question: "Emotion", emotionPair: ["happy", "sad"], speed: "slow", direction: "left", structure: "unscrambled", trials: 1 },
        // 4. Emotion: Happy vs Neutral unscrambled
        { question: "Emotion", emotionPair: ["happy", "neutral"], speed: "slow", direction: "left", structure: "unscrambled", trials: 1 },
        // 5. Emotion: Neutral vs Sad unscrambled
        { question: "Emotion", emotionPair: ["neutral", "sad"], speed: "slow", direction: "left", structure: "unscrambled", trials: 1 },
        
        // Part 2: Scrambled middle (2 trials each)
        // 6-7. Direction scrambled 
        { question: "Direction", emotion: "neutral", speed: "slow", structure: "scrambled", trials: 2 },
        // 8-9. Speed scrambled 
        { question: "Speed", emotion: "neutral", direction: "left", structure: "scrambled", trials: 2 },
        // 10-11. Emotion: Happy vs Sad scrambled 
        { question: "Emotion", emotionPair: ["happy", "sad"], speed: "slow", direction: "left", structure: "scrambled", trials: 2 },
        // 12-13. Emotion: Happy vs Neutral scrambled 
        { question: "Emotion", emotionPair: ["happy", "neutral"], speed: "slow", direction: "left", structure: "scrambled", trials: 2 },
        // 14-15. Emotion: Neutral vs Sad scrambled 
        { question: "Emotion", emotionPair: ["neutral", "sad"], speed: "slow", direction: "left", structure: "scrambled", trials: 2 }
    ];

    //  global variables 
    let trialSequence = [];
    let balanceStats = {};
    let blockInstructions = [];

    //  create stimuli sequence with 3 emotions and block design
    function generateBalancedTrialSequence(translations) {
        console.log("=== DEBUG generateBalancedTrialSequence ===");
        console.log("Translations parameter:", translations);
        console.log("Type:", typeof translations);
        console.log("Keys:", Object.keys(translations));
        
        // check for our specific keys
        const checkKeys = [
            'biological_motion_direction_label_left',
            'biological_motion_direction_label_right',
            'biological_motion_emotion_label_happy',
            'biological_motion_emotion_label_neutral',
            'biological_motion_emotion_label_sad',
            'biological_motion_speed_label_slow',
            'biological_motion_speed_label_fast'
        ];
        
        checkKeys.forEach(key => {
            console.log(`${key}:`, translations[key]);
        });


        const directions = ["left", "right"];
        const emotions = ["happy", "neutral", "sad"]; 
        const speeds = ["slow", "fast"];
        const structures = ["unscrambled", "scrambled"];
        const questions = ["Emotion", "Direction", "Speed"];  
        const trialsPerQuestion = 90;  
        const totalTrials = trialsPerQuestion * questions.length;  // 270 total trials

        // generate all 24 physical stimuli (2×3×2×2)
        const stimuli = [];
        for (const d of directions) {
            for (const e of emotions) {
                for (const s of speeds) {
                    for (const st of structures) {
                        stimuli.push(`PLW_${d}_${e}_${s}_${st}.gif`);
                    }
                }
            }
        }

        // create master trial list with maximally balanced stimuli
        const basePerStim = Math.floor(totalTrials / stimuli.length);
        const extraNeeded = totalTrials % stimuli.length;

        let masterTrialList = [];
        stimuli.forEach(stim => {
            masterTrialList = masterTrialList.concat(Array(basePerStim).fill(stim));
        });

        // randomly select stimuli for extra appearances
        const extraStimuli = [];
        const shuffledStimuli = [...stimuli].sort(() => Math.random() - 0.5);
        for (let i = 0; i < extraNeeded; i++) {
            extraStimuli.push(shuffledStimuli[i]);
        }
        masterTrialList = masterTrialList.concat(extraStimuli);
        masterTrialList.sort(() => Math.random() - 0.5);

        // create 27 blocks × 10 trials = 270 trials
        // 9 blocks of each question type
        const blocks = [];
        const blockTypes = [];
        
        // create array of block types: 9 of each question type
        for (let i = 0; i < 9; i++) {
            blockTypes.push("Emotion", "Direction", "Speed");
        }
        // shuffle block order but ensure no more than 2 of same type in a row
        for (let i = 0; i < blockTypes.length - 2; i++) {
            if (blockTypes[i] === blockTypes[i+1] && blockTypes[i] === blockTypes[i+2]) {
               for (let j = i+3; j < blockTypes.length; j++) {       // find a different block to swap with
                    if (blockTypes[j] !== blockTypes[i]) {
                        [blockTypes[i+2], blockTypes[j]] = [blockTypes[j], blockTypes[i+2]];
                        break;
                    }
                }
            }
        }
        
        // assign trials to blocks
        let trialIndex = 0;
        const generatedSequence = [];
        
        for (let blockNum = 0; blockNum < 27; blockNum++) {
            const blockType = blockTypes[blockNum];
            const blockTrials = [];
            
            // get 10 trials for this block
            for (let i = 0; i < BIOLOGICAL_MOTION_PARAMS.trials_per_block; i++) {
                if (trialIndex >= totalTrials) break;
                
                const filename = masterTrialList[trialIndex];
                const baseName = filename.replace('.gif', '');
                const parts = baseName.split('_');
                
                const direction = parts[1];
                const emotion = parts[2];
                const speed = parts[3];
                const structure = parts[4];
                const question = blockType;  // all trials in block have same question

                let correctResponse = "";
                let correctKey = "";
                let leftLabel = "";
                let middleLabel = ""; 
                let rightLabel = "";
                
                if (question === "Direction") {
                    correctResponse = direction;
                    correctKey = direction === "left" ? '1' : '3';
                    leftLabel = translations.biological_motion_direction_label_left;
                    middleLabel = "";
                    rightLabel = translations.biological_motion_direction_label_right;
                } else if (question === "Emotion") {
                    correctResponse = emotion;
                    if (emotion === "happy") {
                        correctKey = '1';
                        leftLabel = translations.biological_motion_emotion_label_happy;
                        middleLabel = translations.biological_motion_emotion_label_neutral;
                        rightLabel = translations.biological_motion_emotion_label_sad;
                    } else if (emotion === "neutral") {
                        correctKey = '2';
                        leftLabel = translations.biological_motion_emotion_label_happy;
                        middleLabel = translations.biological_motion_emotion_label_neutral;
                        rightLabel = translations.biological_motion_emotion_label_sad;
                    } else if (emotion === "sad") {
                        correctKey = '3';
                        leftLabel = translations.biological_motion_emotion_label_happy;
                        middleLabel = translations.biological_motion_emotion_label_neutral;
                        rightLabel = translations.biological_motion_emotion_label_sad;
                    }
                } else if (question === "Speed") {
                    correctResponse = speed;
                    correctKey = speed === "slow" ? '1' : '3';
                    leftLabel = translations.biological_motion_speed_label_slow;
                    middleLabel = "";
                    rightLabel = translations.biological_motion_speed_label_fast;
                }

                const trialData = {
                    filename: filename,
                    question: question,
                    direction: direction,
                    emotion: emotion,
                    speed: speed,
                    structure: structure,
                    speed_value: speed === 'slow' ? 48 : 80,
                    mood: emotion === 'happy' ? 32 : (emotion === 'neutral' ? 64 : 96), 
                    orientation: direction === 'right' ? 90 : -90,
                    scramble: structure === 'scrambled' ? 100 : 0,
                    blur: structure === 'scrambled' ? 15 : 0,
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
                    block_number: blockNum + 1,
                    block_type: blockType,
                    block_trial_number: i + 1
                };

                blockTrials.push(trialData);
                trialIndex++;
            }
            
            // add block trials to sequence
            generatedSequence.push(...blockTrials);
            
            // create block instruction
            let instructionText = "";
            
            if (blockType === "Emotion") {
                instructionText = translations.block_instruction_mood;
            } else if (blockType === "Direction") {
                instructionText = translations.block_instruction_direction;
            } else if (blockType === "Speed") {
                instructionText = translations.block_instruction_speed;
            }
            
            blockInstructions.push({
                block_number: blockNum + 1,
                block_type: blockType,
                instruction: instructionText
            });
        }
        
        balanceStats = calculateStatistics(generatedSequence);
        
        // df-style preview in the consloe for testing
        console.log("\n=== TRIAL SEQUENCE PREVIEW (First 15 trials) ===");
        console.log("Idx  Filename".padEnd(40) + "Question".padEnd(12) + "Block".padEnd(6) + "Dir".padEnd(6) + "Emo".padEnd(8) + 
                   "Spd".padEnd(6) + "Scr".padEnd(6) + "Correct");
        console.log("-".repeat(100));
        
        generatedSequence.slice(0, 15).forEach((trial, idx) => {
            console.log(
                idx.toString().padStart(3).padEnd(5) +
                trial.filename.padEnd(40) +
                trial.question.padEnd(12) +
                trial.block_number.toString().padEnd(6) +
                trial.direction.padEnd(6) +
                trial.emotion.padEnd(8) +
                trial.speed.padEnd(6) +
                (trial.structure === "scrambled" ? "Yes" : "No").padEnd(6) +
                trial.correct_response
            );
        });

        console.log(`\nTotal trials: ${generatedSequence.length}`);
        console.log(`Total blocks: 27 (9 blocks of each question type)`);
        console.log(`Trials per block: ${BIOLOGICAL_MOTION_PARAMS.trials_per_block}`);

        // complete table for inspection
        let completeTable = "\n" + "=".repeat(100) + "\n";
        completeTable += "COMPLETE TRIAL SEQUENCE (All 270 stimuli)\n";
        completeTable += "=".repeat(100) + "\n";
        completeTable += "Idx  Filename".padEnd(40) + "Question".padEnd(12) + "Block".padEnd(6) + "Dir".padEnd(6) + "Emo".padEnd(8) + 
                        "Spd".padEnd(6) + "Scr".padEnd(6) + "Correct\n";
        completeTable += "-".repeat(100) + "\n";

        generatedSequence.forEach((trial, idx) => {
            completeTable += idx.toString().padStart(3).padEnd(5) +
                           trial.filename.padEnd(40) +
                           trial.question.padEnd(12) +
                           trial.block_number.toString().padEnd(6) +
                           trial.direction.padEnd(6) +
                           trial.emotion.padEnd(8) +
                           trial.speed.padEnd(6) +
                           (trial.structure === "scrambled" ? "Yes" : "No").padEnd(6) +
                           trial.correct_response + "\n";
        });

        // output the entire table as one string to avoid line numbers
        console.log(completeTable);

        // output as CSV format
        console.log("\n" + "=".repeat(100));
        console.log("TRIAL SEQUENCE IN CSV FORMAT");
        console.log("=".repeat(100));
        
        // CSV header
        let csvOutput = "Trial,Block,BlockType,BlockTrial,Filename,Question,Direction,Emotion,Speed,Scrambled,CorrectResponse,CorrectKey\n";
        
        // CSV data rows
        generatedSequence.forEach((trial, idx) => {
            csvOutput += `${idx + 1},${trial.block_number},${trial.block_type},${trial.block_trial_number},` +
                        `"${trial.filename}","${trial.question}","${trial.direction}",` +
                        `"${trial.emotion}","${trial.speed}","${trial.structure}",` +
                        `"${trial.correct_response}","${trial.correct_key}"\n`;
        });
        
        // output the CSV formated trial list
        console.log(csvOutput);
        
        // check of generated sequence
        console.log("\n=============nSEQUENCE CHECK");
        const finalQuestionCounts = { "Emotion": 0, "Direction": 0, "Speed": 0 };
        const finalEmotionCounts = { "happy": 0, "neutral": 0, "sad": 0 };
        const finalStimulusCounts = {};
        const questionByStimulus = {};
        const blockTypeCounts = {};
        
        generatedSequence.forEach(trial => {
            finalQuestionCounts[trial.question]++;
            finalEmotionCounts[trial.emotion]++;
            finalStimulusCounts[trial.filename] = (finalStimulusCounts[trial.filename] || 0) + 1;
            blockTypeCounts[trial.block_type] = (blockTypeCounts[trial.block_type] || 0) + 1;
            
            if (!questionByStimulus[trial.filename]) {
                questionByStimulus[trial.filename] = { "Emotion": 0, "Direction": 0, "Speed": 0 };
            }
            questionByStimulus[trial.filename][trial.question]++;
        });
        
        console.log("\nQuestion distribution in final sequence:");
        Object.entries(finalQuestionCounts).forEach(([q, count]) => {
            console.log(`${q}: ${count} trials`);
        });
        
        console.log("\nEmotion distribution:");
        console.log(`Happy: ${finalEmotionCounts["happy"]} | Neutral: ${finalEmotionCounts["neutral"]} | Sad: ${finalEmotionCounts["sad"]}`);
        
        console.log("\nBlock type distribution:");
        Object.entries(blockTypeCounts).forEach(([type, count]) => {
            console.log(`${type}: ${count} trials`);
        });
        
        console.log("\nStimulus appearances (first 5):");
        Object.entries(finalStimulusCounts).slice(0, 5).forEach(([stim, count]) => {
            console.log(`${stim}: ${count} times`);
        });
        
        // check for physical feature balance
        const directionCounts = { "left": 0, "right": 0 };
        const speedCounts = { "slow": 0, "fast": 0 };
        const structureCounts = { "scrambled": 0, "unscrambled": 0 };
        
        generatedSequence.forEach(trial => {
            directionCounts[trial.direction]++;
            speedCounts[trial.speed]++;
            structureCounts[trial.structure]++;
        });
        
        console.log("\n=== PHYSICAL FEATURE BALANCE ===");
        console.log(`Left: ${directionCounts["left"]} | Right: ${directionCounts["right"]}`);
        console.log(`Slow: ${speedCounts["slow"]} | Fast: ${speedCounts["fast"]}`);
        console.log(`Scrambled: ${structureCounts["scrambled"]} | Unscrambled: ${structureCounts["unscrambled"]}`);
        
        return generatedSequence;
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
                    "Direction": 0,
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
            total_blocks: 27
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
                if (loaded + failed === uniqueGifs.length) {
                    console.log(`Preload complete: ${loaded} loaded, ${failed} failed`);
                }
            };
            img.onerror = () => {
                failed++;
                console.error(`✗ Failed to load: ${filename}`);
                if (loaded + failed === uniqueGifs.length) {
                    console.log(`Preload complete: ${loaded} loaded, ${failed} failed`);
                }
            };
            
            // force load with cache busting for first load only
            img.src = GIF_FOLDER + filename + '?preload=' + Date.now();
        });
    }

    // start preloading IMMEDIATELY
    preloadGifs();

    // start preloading after a brief delay
    setTimeout(preloadGifs, 100);


    //training block funcitons
    function createTrainingTrial(trainingConfig, trialNum, totalTrainingTrials) {
        
        // correct answer for this trial
        let correctAnswer, leftAnchor, rightAnchor, middleTarget;
        let leftLabel = "", rightLabel = "";
        let questionText = "";
        
        // set up based on question type
        if (trainingConfig.question === "Direction") {
            // randomly choose left or right for correct answer
            correctAnswer = Math.random() < 0.5 ? "left" : "right";
            questionText = translations.biological_motion_training_trial_direction;
            
            // anchors: left walker (left), right walker (right)
            leftAnchor = `PLW_left_${trainingConfig.emotion}_${trainingConfig.speed}_unscrambled.gif`;
            rightAnchor = `PLW_right_${trainingConfig.emotion}_${trainingConfig.speed}_unscrambled.gif`;
            middleTarget = `PLW_${correctAnswer}_${trainingConfig.emotion}_${trainingConfig.speed}_${trainingConfig.structure}.gif`;
            
            leftLabel = translations.biological_motion_direction_label_left;
            rightLabel = translations.biological_motion_direction_label_right;
            
        } else if (trainingConfig.question === "Speed") {
            // randomly choose slow or fast for correct answer
            correctAnswer = Math.random() < 0.5 ? "slow" : "fast";
            questionText = translations.biological_motion_training_trial_speed;
            
            // anchors: slow walker (left), fast walker (right)
            leftAnchor = `PLW_${trainingConfig.direction}_${trainingConfig.emotion}_slow_unscrambled.gif`;
            rightAnchor = `PLW_${trainingConfig.direction}_${trainingConfig.emotion}_fast_unscrambled.gif`;
            middleTarget = `PLW_${trainingConfig.direction}_${trainingConfig.emotion}_${correctAnswer}_${trainingConfig.structure}.gif`;
            
            leftLabel = translations.biological_motion_speed_label_slow;
            rightLabel = translations.biological_motion_speed_label_fast;
            
        } else if (trainingConfig.question === "Emotion") {
            // randomly choose one of the emotion pair for correct answer
            correctAnswer = trainingConfig.emotionPair[Math.floor(Math.random() * 2)];
            questionText = translations.biological_motion_training_trial_mood;
            
            // anchors: first emotion (left), second emotion (right)
            const [emotion1, emotion2] = trainingConfig.emotionPair;
            leftAnchor = `PLW_${trainingConfig.direction}_${emotion1}_${trainingConfig.speed}_unscrambled.gif`;
            rightAnchor = `PLW_${trainingConfig.direction}_${emotion2}_${trainingConfig.speed}_unscrambled.gif`;
            middleTarget = `PLW_${trainingConfig.direction}_${correctAnswer}_${trainingConfig.speed}_${trainingConfig.structure}.gif`;
            
            leftLabel = translations[`biological_motion_emotion_label_${emotion1}`];
            rightLabel = translations[`biological_motion_emotion_label_${emotion2}`];
        }
        
        const correctKey = correctAnswer === "left" || correctAnswer === "slow" || 
                          (trainingConfig.question === "Emotion" && correctAnswer === trainingConfig.emotionPair[0]) ? '1' : '3';
        
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
                // load the three preloaded GIFs 
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
                
                // store response in data
                data.response_correct = isCorrect;
                data.participant_response = responseKey === '1' ? leftLabel.toLowerCase() : rightLabel.toLowerCase();
                
                console.log(`Training trial ${trialNum + 1}: ${isCorrect ? 'CORRECT' : 'INCORRECT'} (Response: ${responseKey}, Correct: ${correctKey})`);
            }
        };
    }
    
    function createTrainingFeedbackTrial(previousTrialData) {
        return {
            type: jsPsychHtmlKeyboardResponse,
            stimulus: function() {
                const lastTrial = jsPsych.data.get().last(1).values()[0];
                const isCorrect = lastTrial.response_correct;
                const correctAnswer = lastTrial.correct_answer;
                const responseKey = lastTrial.participant_response;
                
                let leftLabel = "", rightLabel = "";
                if (lastTrial.question === "Direction") {
                    leftLabel = translations.biological_motion_direction_label_left;
                    rightLabel = translations.biological_motion_direction_label_right;
                } else if (lastTrial.question === "Speed") {
                    leftLabel = translations.biological_motion_speed_label_slow;
                    rightLabel = translations.biological_motion_speed_label_fast;
                } else if (lastTrial.question === "Emotion") {
                    leftLabel = translations[`biological_motion_emotion_label_${lastTrial.left_anchor.includes("happy") ? "happy" : 
                            lastTrial.left_anchor.includes("neutral") ? "neutral" : "sad"}`];
                    rightLabel = translations[`biological_motion_emotion_label_${lastTrial.right_anchor.includes("happy") ? "happy" : 
                                lastTrial.right_anchor.includes("neutral") ? "neutral" : "sad"}`];
                }
                
                // Get correct answer display text
                let correctAnswerDisplay = "";
                if (lastTrial.question === "Direction") {
                    correctAnswerDisplay = correctAnswer === "left" ? 
                        translations.biological_motion_direction_label_left : 
                        translations.biological_motion_direction_label_right;
                } else if (lastTrial.question === "Speed") {
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
                            ${translations.biological_motion_feedback_selection} ${responseKey === 'left' || responseKey === 'slow' || responseKey === leftLabel.toLowerCase() ? leftLabel : rightLabel}
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
                trial_num: previousTrialData.training_trial
            }
        };
    }
    
        function generateTrainingTimeline() {
        const trainingTimeline = [];
        let trialCounter = 0;
        
        // first add training instructions
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
        
        // generate ALL training trials with their feedback trials
        // create a timeline for each training trial + feedback
        // the actual training trial
        // the feedback trial
        // Get the previous trial's data
        // determine labels
        TRAINING_TRIALS.forEach(config => {
            for (let i = 0; i < config.trials; i++) {
                const trialWithFeedback = {
                    timeline: [
                        createTrainingTrial(config, trialCounter, 15),
                        {
                            type: jsPsychHtmlKeyboardResponse,
                            stimulus: function() {
                                const lastTrial = jsPsych.data.get().last(1).values()[0];
                                const isCorrect = lastTrial.response_correct;
                                const correctAnswer = lastTrial.correct_answer;
                                const responseKey = lastTrial.participant_response;
                                
                                let leftLabel = "", rightLabel = "";
                                if (lastTrial.question === "Direction") {
                                    leftLabel = translations.biological_motion_direction_label_left;
                                    rightLabel = translations.biological_motion_direction_label_right;
                                } else if (lastTrial.question === "Speed") {
                                    leftLabel = translations.biological_motion_speed_label_slow;
                                    rightLabel = translations.biological_motion_speed_label_fast;
                                } else if (lastTrial.question === "Emotion") {
                                    leftLabel = translations[`biological_motion_emotion_label_${lastTrial.left_anchor.includes("happy") ? "happy" : 
                                            lastTrial.left_anchor.includes("neutral") ? "neutral" : "sad"}`];
                                    rightLabel = translations[`biological_motion_emotion_label_${lastTrial.right_anchor.includes("happy") ? "happy" : 
                                                lastTrial.right_anchor.includes("neutral") ? "neutral" : "sad"}`];
                                }
                                
                                // Get correct answer display text - THIS WAS MISSING!
                                let correctAnswerDisplay = "";
                                if (lastTrial.question === "Direction") {
                                    correctAnswerDisplay = correctAnswer === "left" ? 
                                        translations.biological_motion_direction_label_left : 
                                        translations.biological_motion_direction_label_right;
                                } else if (lastTrial.question === "Speed") {
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
                                            ${translations.biological_motion_feedback_selection} ${responseKey === 'left' || responseKey === 'slow' || responseKey === leftLabel.toLowerCase() ? leftLabel : rightLabel}
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
        
        // ad transition to main experiment
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

    // main instructions 
    function createInstructionTrial(pageNumber) {
        const translations = jatos.studySessionData.translations;
        const totalPages = 3;
        const GIF_FOLDER = "experiments/EXPERIMENT_BIOLOGICAL_MOTION/point_light_walkers/";
        
        let stimulusHTML = '';
        
        // grab html content from CSV for the specific page
        if (pageNumber === 1) {
            stimulusHTML = translations.biological_motion_introduction_page_1_long;
        } else if (pageNumber === 2) {
            stimulusHTML = translations.biological_motion_introduction_page_2_long;
        } else if (pageNumber === 3) {
            stimulusHTML = translations.biological_motion_introduction_page_3_long;
        }
        
        // next/previous buttons
        let buttonsHTML = '<div style="display: flex; justify-content: space-between; margin-top: 50px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.2);">';
        
        if (pageNumber > 1) { // previous button (hidden on first page)
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
        
        // nex/start button
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
                // fix JATOS container for page 2 ONLY, otherwise margins fuck up box postioning
                if (pageNumber === 2) {
                    const container = document.getElementById('jspsych-content');
                    if (container) {
                        container.style.padding = '0';
                        container.style.margin = '0 auto';
                        container.style.maxWidth = 'none';
                        container.style.width = '100%';
                        container.style.height = '100vh';
                        container.style.overflow = 'hidden';
                        container.style.position = 'relative';
                        container.style.left = '0';
                        container.style.transform = 'none';
                    }
                    
                    // force body/html to reset
                    document.body.style.margin = '0';
                    document.body.style.padding = '0';
                    document.body.style.overflow = 'hidden';
                    document.documentElement.style.overflow = 'hidden';
                    
                    // force scroll to top
                    setTimeout(() => {
                        const stimulus = document.getElementById('jspsych-html-keyboard-response-stimulus');
                        if (stimulus) {
                            stimulus.scrollIntoView({ behavior: 'instant', block: 'start' });
                        }
                    }, 50);
                    
                    // compact the layout = reduce all spacing to fit more walkerd
                    const allDivs = document.querySelectorAll('div[style*="padding"]');
                    allDivs.forEach(div => {
                        const style = div.getAttribute('style');
                        if (style && style.includes('padding: 20px')) {
                            div.style.padding = '5px';
                        }
                        if (style && style.includes('padding: 15px')) {
                            div.style.padding = '3px';
                        }
                    });
                    

                    const images = document.querySelectorAll('img');
                    images.forEach(img => {
                        img.style.width = '180px';
                        img.style.height = 'auto';
                        img.style.margin = '0';
                    });
                    
                    // remove gaps between flex containers
                    const flexContainers = document.querySelectorAll('div[style*="display: flex"]');
                    flexContainers.forEach(container => {
                        if (container.style.gap) {
                            container.style.gap = '5px';
                        }
                        container.style.margin = '5px 0';
                    });
                    
                    // boxes more compact
                    const boxes = document.querySelectorAll('div[style*="border: 2px solid white"]');
                    boxes.forEach(box => {
                        box.style.padding = '10px';
                        box.style.margin = '5px';
                    });
                    
                    //  main title spacing adjustment
                    const h1 = document.querySelector('h1');
                    if (h1) {
                        h1.style.marginBottom = '10px';
                    }
                }
                
                // button
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



    
// override the function to fix JATOS container styles
const originalCreateInstructionTrial = createInstructionTrial;
createInstructionTrial = function(pageNumber) {
    const trial = originalCreateInstructionTrial(pageNumber);
    const originalOnLoad = trial.on_load;
    
    trial.on_load = function() {
        // fix JATOS container styles - PAGE 2 ONLY
        if (pageNumber === 2) {
            const container = document.getElementById('jspsych-content');
            if (container) {
                container.style.padding = '0';
                container.style.margin = '0';
                container.style.maxWidth = 'none';
                container.style.height = '100vh';
                container.style.overflowY = 'visible';
                container.style.position = 'relative';
                container.style.top = '0';
                container.style.left = '0';
                container.style.transform = 'matrix(1, 0, 0, 1, 0, 0)';
            }
            
            // force scroll to top
            window.scrollTo(0, 0);
            document.documentElement.scrollTop = 0;
            document.body.scrollTop = 0;
            
            // keep forcing it
            const scrollInterval = setInterval(() => {
                window.scrollTo(0, 0);
                document.documentElement.scrollTop = 0;
            }, 10);
            
            // stop after 1 second
            setTimeout(() => clearInterval(scrollInterval), 1000);
        }
        
        // call original on_load if it exists
        if (originalOnLoad) originalOnLoad.call(this);
    };
    
    return trial;
};



    // main instruction timeline with navigation
    const instructionTimeline = {
        timeline: [],
        loop_function: function(data) {
            // get the last trial's data
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

    // start with page 1
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

    // MAIN TRIAL
    function createPLWTrial(trialData, trialIndex) {
        let choices = [];
        if (trialData.question === "Emotion") {
            choices = ['1', '2', '3'];  
        } else {
            choices = ['1', '3'];  
        }
        
        // stims with middle label for mood trials
        let labelHTML = '';
        if (trialData.question === "Emotion") {
            labelHTML = `
                <div style="display: flex; justify-content: space-between; width: 90%; margin-bottom: 30px;">
                    <div style="font-size: 28px; color: #4CAF50; font-weight: bold; text-align: left; flex: 1;">
                        ${trialData.left_label}
                    </div>
                    <div style="font-size: 26px; color: #FFC107; font-weight: bold; text-align: center; flex: 1;">
                        ${trialData.middle_label}
                    </div>
                    <div style="font-size: 28px; color: #FF5252; font-weight: bold; text-align: right; flex: 1;">
                        ${trialData.right_label}
                    </div>
                </div>
            `;
        } else {
            labelHTML = `
                <div style="display: flex; justify-content: space-between; width: 80%; margin-bottom: 30px;">
                    <div style="font-size: 28px; color: #4CAF50; font-weight: bold; text-align: left; flex: 1;">
                        ${trialData.left_label}
                    </div>
                    <div style="font-size: 24px; color: white; font-weight: bold; text-align: center; flex: 2;">
                        ${trialData.question}
                    </div>
                    <div style="font-size: 28px; color: #FF5252; font-weight: bold; text-align: right; flex: 1;">
                        ${trialData.right_label}
                    </div>
                </div>
            `;
        }
        
        // create image element once and reuse it
        const imgSrc = GIF_FOLDER + trialData.filename;
        
        return {
            type: jsPsychHtmlKeyboardResponse,
            stimulus: `
                <div style="display: flex; flex-direction: column; align-items: center; height: 80vh; justify-content: center;">
                    ${labelHTML}
                    
                    <div style="display: flex; justify-content: center; align-items: center; flex: 1; width: 100%;" id="gif-container-${trialIndex}">
                        <!-- Image will be inserted by on_load -->
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
                // create and cache image
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
                if (trialData.question === "Direction") {
                    participantResponse = responseKey === '1' ? "left" : "right";
                } else if (trialData.question === "Emotion") {
                    if (responseKey === '1') participantResponse = "happy";
                    else if (responseKey === '2') participantResponse = "neutral";
                    else if (responseKey === '3') participantResponse = "sad";
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
                
                console.log(`\n══════════════════════════════
                TRIAL ${trialIndex + 1}/${trialSequence.length} | Block ${trialData.block_number}.${trialData.block_trial_number}
                ══════════════════════════════
                Filename:    ${trialData.filename}
                Question:    ${trialData.question}
                Parameters:
                • Direction:   ${trialData.direction}
                • Emotion:     ${trialData.emotion}
                • Speed:       ${trialData.speed}
                • Structure:   ${trialData.structure}
                Choices:
                ${trialData.question === "Emotion" ? 
                `• 1 = ${trialData.left_label}\n• 2 = ${trialData.middle_label}\n• 3 = ${trialData.right_label}` :
                `• 1 = ${trialData.left_label}\n• 2 = ${trialData.right_label}`}
                Correct:      ${trialData.correct_response} (${trialData.correct_key.toUpperCase()})
                ────────────────────────────────────────────────────────────────────────────────
                Response:     ${responseKey ? responseKey.toUpperCase() : 'NO RESPONSE'} (${participantResponse})
                Correct:      ${isCorrect ? 'YES' : 'NO'}
                RT:           ${data.rt}ms
                ══════════════════════════════\n`);
            }
        };
    }

    //fixation  
    const fixationCross = {
        type: jsPsychHtmlKeyboardResponse,
        stimulus: '<div style="font-size: 60px; text-align: center; color: white;">+</div>',
        choices: "NO_KEYS",
        trial_duration: 1000,
        data: {
            task: 'fixation'
        }
    };

    // savedata
    function saveData() {
        console.log("\n" + "=".repeat(80));
        console.log("SAVING COMPLETE DATA");
        console.log("=".repeat(80));
        
        const trialByTrialData = jsPsych.data.get().values();
        const completedTrials = trialSequence.filter(t => t.trial_completed);
        const correctTrials = completedTrials.filter(t => t.response_correct).length;
        
        const totalRT = completedTrials.reduce((sum, t) => sum + (t.rt || 0), 0);
        const avgRT = completedTrials.length > 0 ? totalRT / completedTrials.length : 0;
        const accuracy = completedTrials.length > 0 ? correctTrials / completedTrials.length : 0;
        
        console.log(`Completed trials: ${completedTrials.length}/${trialSequence.length}`);
        console.log(`Completed blocks: ${new Set(completedTrials.map(t => t.block_number)).size}/27`);
        console.log(`Accuracy: ${(accuracy * 100).toFixed(1)}% (${correctTrials} correct)`);
        console.log(`Average RT: ${avgRT.toFixed(0)}ms`);
        
        //consoleprint block stats
        console.log("\n=== BLOCK STATISTICS ===");
        const blockStats = {};
        completedTrials.forEach(trial => {
            if (!blockStats[trial.block_number]) {
                blockStats[trial.block_number] = {
                    type: trial.block_type,
                    completed: 0,
                    correct: 0,
                    totalRT: 0
                };
            }
            blockStats[trial.block_number].completed++;
            if (trial.response_correct) blockStats[trial.block_number].correct++;
            if (trial.rt) blockStats[trial.block_number].totalRT += trial.rt;
        });
        
        console.log("Block Type".padEnd(12) + "Accuracy".padEnd(12) + "Avg RT".padEnd(10) + "Trials");
        console.log("-".repeat(50));
        Object.entries(blockStats).sort((a, b) => a[0] - b[0]).forEach(([blockNum, stats]) => {
            const acc = stats.completed > 0 ? (stats.correct / stats.completed * 100).toFixed(1) : "0.0";
            const avg = stats.completed > 0 ? (stats.totalRT / stats.completed).toFixed(0) : "0";
            console.log(
                `Block ${blockNum}`.padEnd(12) +
                `${acc}%`.padEnd(12) +
                `${avg}ms`.padEnd(10) +
                `${stats.completed}/10`
            );
        });
        
        // print out the stimulus × question matrix
        console.log("\n=== STIMULUS × QUESTION MATRIX ===");
        console.log("Filename".padEnd(40) + "Emotion".padEnd(12) + "Direction".padEnd(12) + "Speed");
        console.log("-".repeat(80));
        
        Object.keys(balanceStats.stimulus_question_matrix).sort().forEach(filename => {
            const matrix = balanceStats.stimulus_question_matrix[filename];
            console.log(
                filename.padEnd(40) +
                matrix["Emotion"].toString().padEnd(12) +
                matrix["Direction"].toString().padEnd(12) +
                matrix["Speed"]
            );
        });
        
        const completeData = {
            subject_info: {
                subject_id: subjectId,
                date: new Date().toISOString(),
                session_duration: jsPsych.getTotalTime() / 1000
            },
            experiment_parameters: {
                total_trials: trialSequence.length,
                total_blocks: 27,
                trials_per_block: BIOLOGICAL_MOTION_PARAMS.trials_per_block,
                gif_folder: GIF_FOLDER,
                training_included: true,
                training_trials: 15,
                block_break_duration: BIOLOGICAL_MOTION_PARAMS.block_break_duration
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
                        structure: trial.structure,
                        speed_value: trial.speed_value,
                        mood: trial.mood,
                        orientation: trial.orientation,
                        scramble: trial.scramble,
                        blur: trial.blur
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
                completed_blocks: new Set(completedTrials.map(t => t.block_number)).size,
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
            console.log("✅ Data submitted as study result");
        });
        
        console.log("Data saved to JATOS");
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

    // -Ctrl+C
    document.addEventListener('keydown', function(event) {
        if (event.ctrlKey && event.key === 'c') {
            event.preventDefault();
            console.log("\nExperiment aborted - saving data...");
            
            // give bt of  time to finish current trial
            setTimeout(() => {
                
                const currentTrials = jsPsych.data.get().filter({task: 'main_judgment'}).count(); // if there is any ongoing trial mark it as complete
                for (let i = 0; i < currentTrials && i < trialSequence.length; i++) {
                    if (!trialSequence[i].trial_completed) {
                        trialSequence[i].trial_completed = true;
                    }
                }
                
                saveData();
                document.body.innerHTML = `
                    <div style="font-size: 24px; text-align: center; padding: 50px; color: white;">
                        <h1>Experiment Aborted</h1>
                        <p>The experiment has been stopped.</p>
                        <p>Your data has been saved.</p>
                        <p style="margin-top: 30px;">You may close this window.</p>
                    </div>
                `;
            }, 100);
        }
    });

    // create and run Timeline
    var timeline = [];
    timeline.push(instructionTimeline);

    // #resets style after page 2 of instrtuctions, so that the instructions on top of trial display correctly
    timeline.push({
        type: jsPsychHtmlKeyboardResponse,
        stimulus: '<div style="display: none;"></div>',
        trial_duration: 1,
        on_load: function() {
            const container = document.getElementById('jspsych-content');
            if (container) {
                // ONLY reset the styles your page 2 messed up
                container.style.padding = '';
                container.style.margin = '';
                container.style.maxWidth = '';
                container.style.height = '';
                container.style.position = '';
                container.style.top = '';
                container.style.left = '';
                container.style.transform = '';
                container.style.overflow = 'visible';
            }
            document.body.style.overflow = 'auto';
            document.documentElement.style.overflow = 'auto';
        }
    });


    // traingin block
    const trainingTimeline = generateTrainingTimeline();
    timeline.push({
        timeline: trainingTimeline,
        conditional_function: function() {
            return true; // always include training
        }
    });
    
    // resets style after training, just in case
    timeline.push({
        type: jsPsychHtmlKeyboardResponse,
        stimulus: '<div style="display: none;"></div>',
        trial_duration: 1,
        on_load: function() {
            const container = document.getElementById('jspsych-content');
            if (container) {
                // reset any styles from training
                container.style.padding = '';
                container.style.margin = '';
                container.style.maxWidth = '';
                container.style.overflow = 'visible';
            }
            document.body.style.overflow = 'auto';
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
    Object.keys(trialsByBlock).sort((a, b) => a - b).forEach(blockNum => {
        const blockTrials = trialsByBlock[blockNum];
        const blockType = blockTrials[0].trialData.block_type;
        
        // block instruction
        timeline.push(createBlockInstruction(parseInt(blockNum), blockType));
        
        // add trials for block
        blockTrials.forEach(({trialData, index}) => {
            timeline.push(createPLWTrial(trialData, index));
            
            // add fixation cross 
            if (index < trialSequence.length - 1) { //not after last trial
                const nextTrial = trialSequence[index + 1];
                if (nextTrial.block_number === trialData.block_number) {
                    timeline.push(fixationCross);
                }
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