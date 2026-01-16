const sources = new Set();
let isProcessing = false;

function openUploadModal() {
    document.getElementById('uploadModal').classList.remove('hidden');
}

function closeUploadModal() {
    document.getElementById('uploadModal').classList.add('hidden');
}

async function uploadFile() {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];
    if (!file) return;

    closeUploadModal();

    const formData = new FormData();
    formData.append('file', file);

    const sourcesEmpty = document.getElementById('sourcesEmpty');
    const chatEmpty = document.getElementById('chatEmpty');
    const chatHistory = document.getElementById('chatHistory');

    try {
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });
        const result = await response.json();

        if (response.ok) {
            sources.add(file.name);
            updateSourcesList();

            if (sources.size > 0) {
                sourcesEmpty.style.display = 'none';
                chatEmpty.style.display = 'none';
                chatHistory.classList.remove('hidden');
            }
        } else {
            alert('Error: ' + result.error);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Upload failed');
    }
    fileInput.value = '';
}

function updateSourcesList() {
    const list = document.getElementById('sourcesList');
    const emptyState = document.getElementById('sourcesEmpty');
    
    list.innerHTML = '';
    
    Array.from(sources).forEach(s => {
        const div = document.createElement('div');
        div.className = 'source-item';
        div.innerHTML = `
            <span class="source-icon">&#128196;</span>
            <span class="source-name">${s}</span>
        `;
        list.appendChild(div);
    });
    
    list.appendChild(emptyState);

    if (sources.size > 0) {
        emptyState.style.display = 'none';
    }
}

async function sendMessage() {
    if (isProcessing) return;
    
    const input = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    const text = input.value.trim();
    if (!text) return;

    isProcessing = true;
    input.disabled = true;
    sendBtn.disabled = true;

    addMessage('user', text);
    input.value = '';

    try {
        const response = await fetch('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: text })
        });
        const data = await response.json();

        if (data.answer) {
            addMessage('system', data.answer);
        } else {
            addMessage('system', 'Error: ' + (data.error || 'Unknown error'));
        }
    } catch (e) {
        addMessage('system', 'Failed to send message.');
    } finally {
        isProcessing = false;
        input.disabled = false;
        sendBtn.disabled = false;
        input.focus();
    }
}

function addMessage(role, text) {
    const div = document.getElementById('chatHistory');
    const msg = document.createElement('div');
    msg.className = `message ${role}`;
    
    try {
        if (role === 'system' && typeof marked !== 'undefined') {
            msg.innerHTML = marked.parse(text);
        } else {
            msg.textContent = text;
        }
    } catch (e) {
        console.error('Markdown error:', e);
        msg.textContent = text;
    }
    
    div.appendChild(msg);
    div.scrollTop = div.scrollHeight;
}

function handleEnter(e) {
    if (e.key === 'Enter' && !isProcessing) {
        sendMessage();
    }
}

async function generateAudio() {
    const btn = document.getElementById('audioBtn');
    const loading = document.getElementById('audioLoading');
    const playerContainer = document.getElementById('audioPlayerContainer');

    btn.style.display = 'none';
    loading.classList.remove('hidden');
    playerContainer.classList.add('hidden');

    try {
        const response = await fetch('/generate_audio', { method: 'POST' });
        const data = await response.json();

        if (data.audio_url) {
            const audio = document.getElementById('audioPlayer');
            audio.src = data.audio_url;
            playerContainer.classList.remove('hidden');
            audio.play();
        } else {
            alert('Error generating audio: ' + data.error);
            btn.style.display = 'block';
        }
    } catch (e) {
        alert('Request failed');
        btn.style.display = 'block';
    } finally {
        loading.classList.add('hidden');
    }
}

async function generateStudy(type) {
    if (sources.size === 0) {
        alert('Please upload a source first!');
        return;
    }

    const output = document.getElementById('studyOutput');
    
    if (type === 'flashcard') {
        output.innerHTML = '<div class="loading">Generating flashcards...</div>';
        output.scrollIntoView({ behavior: "smooth" });
    } else {
        output.innerHTML = '<div class="loading">Generating...</div>';
        output.scrollIntoView({ behavior: "smooth" });
    }

    try {
        const response = await fetch('/generate_study_aid', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type })
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to generate');
        }

        if (type === 'flowchart') {
            output.innerHTML = `<div class="mermaid">${data.content}</div>`;
            if (window.mermaid) {
                await window.mermaid.run({
                    querySelector: '#studyOutput .mermaid'
                });
            }
        } else if (type === 'flashcard') {
            output.innerHTML = '';
            
            if (Array.isArray(data) && data.length > 0) {
                openFlashcardViewer(data);
            } else {
                output.innerHTML = '<div class="error">No flashcards generated. Try again.</div>';
            }
        } else if (type === 'quiz') {
            output.innerHTML = '';
            
            if (Array.isArray(data) && data.length > 0) {
                openQuizViewer(data);
            } else {
                output.innerHTML = '<div class="error">No quiz questions generated. Try again.</div>';
            }
        }
    } catch (e) {
        console.error('Study aid error:', e);
        output.innerHTML = '<div class="error">Error generating study aid. Please try again.</div>';
    }
}


function comingSoon() {
    alert("Coming soon in this replica!");
}

// ============================================
// FLASHCARD SYSTEM
// ============================================
let flashcardData = [];
let currentFlashcardIndex = 0;
let isFlashcardFlipped = false;
let savedFlashcards = []; // Store generated flashcards

function openFlashcardViewer(cards, fromSaved = false) {
    flashcardData = cards;
    currentFlashcardIndex = 0;
    isFlashcardFlipped = false;
    
    const viewer = document.getElementById('flashcardViewer');
    const studioGrid = document.getElementById('studioGrid');
    const studioFooter = document.getElementById('studioFooter');
    const studyOutput = document.getElementById('studyOutput');
    
    // Hide other studio elements
    studioGrid.classList.add('hidden');
    studioFooter.classList.add('hidden');
    studyOutput.classList.add('hidden');
    
    // Show flashcard viewer
    viewer.classList.remove('hidden');
    
    // Get dynamic title from uploaded sources
    let flashcardTitle = 'Flashcards';
    if (sources.size > 0) {
        const firstSource = Array.from(sources)[0];
        // Remove file extension and clean up the name
        flashcardTitle = firstSource.replace(/\.(pdf|txt)$/i, '').replace(/_/g, ' ');
    }
    
    // Build flashcard UI
    viewer.innerHTML = `
        <div class="flashcard-header-studio">
            <div class="flashcard-info">
                <h3>${flashcardTitle}</h3>
                <p class="flashcard-source">Based on ${sources.size} source${sources.size > 1 ? 's' : ''}</p>
            </div>
            <button class="close-flashcard-btn" onclick="closeFlashcardViewer()">×</button>
        </div>
        
        <div class="flashcard-instructions">
            Press "Space" to flip, "←/→" to navigate
        </div>
        
        <div class="flashcard-card-wrapper">
            <button class="flashcard-nav-btn prev" id="prevBtn" onclick="previousFlashcard()">
                <span>←</span>
            </button>
            
            <div class="flashcard-card" id="flashcardCard" onclick="flipFlashcard()">
                <div class="flashcard-card-inner">
                    <div class="flashcard-card-front">
                        <div class="flashcard-content" id="flashcardQuestion"></div>
                        <div class="see-answer">See answer</div>
                    </div>
                    <div class="flashcard-card-back">
                        <div class="flashcard-content" id="flashcardAnswer"></div>
                    </div>
                </div>
            </div>
            
            <button class="flashcard-nav-btn next" id="nextBtn" onclick="nextFlashcard()">
                <span>→</span>
            </button>
        </div>
        
        <div class="flashcard-footer">
            <div class="flashcard-controls">
                <button class="flashcard-control-btn" onclick="shuffleFlashcards()" title="Shuffle">
                    <span>🔄</span>
                </button>
                <div class="flashcard-progress" id="flashcardProgress"></div>
                <button class="flashcard-control-btn" onclick="downloadFlashcards()" title="Download">
                    <span>⬇</span>
                </button>
            </div>
            
            <div class="flashcard-feedback">
                <button class="feedback-btn-studio good" onclick="markFlashcardGood()">
                    👍 Good content
                </button>
                <button class="feedback-btn-studio bad" onclick="markFlashcardBad()">
                    👎 Bad content
                </button>
            </div>
        </div>
    `;
    
    updateFlashcard();
    
    // Save flashcard if newly generated (not from saved button click)
    if (!fromSaved) {
        saveFlashcardButton(flashcardTitle, cards);
    }
}

function saveFlashcardButton(title, cards) {
    // Check if already saved
    const exists = savedFlashcards.find(f => f.title === title);
    if (exists) {
        // Update existing
        exists.cards = cards;
        exists.timestamp = Date.now();
    } else {
        // Add new
        savedFlashcards.push({
            title: title,
            cards: cards,
            timestamp: Date.now()
        });
    }
    
    renderSavedFlashcards();
}

function renderSavedFlashcards() {
    renderSavedItems(); // Changed from renderSavedQuizzes
}

function openSavedFlashcard(index) {
    const flashcard = savedFlashcards[index];
    if (flashcard) {
        openFlashcardViewer(flashcard.cards, true);
    }
}

function deleteSavedFlashcard(index) {
    if (confirm('Delete this flashcard set?')) {
        savedFlashcards.splice(index, 1);
        renderSavedFlashcards();
    }
}

function getTimeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    
    if (seconds < 60) return 'just now';
    
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    
    const months = Math.floor(days / 30);
    return `${months}mo ago`;
}

function closeFlashcardViewer() {
    const viewer = document.getElementById('flashcardViewer');
    const studioGrid = document.getElementById('studioGrid');
    const studioFooter = document.getElementById('studioFooter');
    const studyOutput = document.getElementById('studyOutput');
    
    // Hide viewer
    viewer.classList.add('hidden');
    viewer.innerHTML = '';
    
    // Show studio elements again
    studioGrid.classList.remove('hidden');
    studioFooter.classList.remove('hidden');
    studyOutput.classList.remove('hidden');
    
    // Reset state
    isFlashcardFlipped = false;
}

function updateFlashcard() {
    if (flashcardData.length === 0) return;
    
    const card = flashcardData[currentFlashcardIndex];
    const questionEl = document.getElementById('flashcardQuestion');
    const answerEl = document.getElementById('flashcardAnswer');
    const progressEl = document.getElementById('flashcardProgress');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const cardElement = document.getElementById('flashcardCard');
    
    // Update content
    if (questionEl) questionEl.textContent = card.question;
    if (answerEl) answerEl.textContent = card.answer;
    
    // Update progress
    if (progressEl) {
        progressEl.textContent = `${currentFlashcardIndex + 1} / ${flashcardData.length} cards`;
    }
    
    // Update button states
    if (prevBtn) prevBtn.disabled = currentFlashcardIndex === 0;
    if (nextBtn) nextBtn.disabled = currentFlashcardIndex === flashcardData.length - 1;
    
    // Reset flip state when navigating
    if (cardElement && isFlashcardFlipped) {
        cardElement.classList.remove('flipped');
        isFlashcardFlipped = false;
    }
}

function flipFlashcard() {
    const cardElement = document.getElementById('flashcardCard');
    if (!cardElement) return;
    
    isFlashcardFlipped = !isFlashcardFlipped;
    cardElement.classList.toggle('flipped');
}

function nextFlashcard() {
    if (currentFlashcardIndex < flashcardData.length - 1) {
        currentFlashcardIndex++;
        updateFlashcard();
    }
}

function previousFlashcard() {
    if (currentFlashcardIndex > 0) {
        currentFlashcardIndex--;
        updateFlashcard();
    }
}

function shuffleFlashcards() {
    // Fisher-Yates shuffle algorithm
    for (let i = flashcardData.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [flashcardData[i], flashcardData[j]] = [flashcardData[j], flashcardData[i]];
    }
    
    currentFlashcardIndex = 0;
    updateFlashcard();
}

function downloadFlashcards() {
    console.log('Download flashcards');
    alert('Download feature coming soon!');
}

function markFlashcardGood() {
    console.log('Marked as good content');
    // You can add analytics or feedback tracking here
}

function markFlashcardBad() {
    console.log('Marked as bad content');
    // You can add analytics or feedback tracking here
}

// Keyboard navigation for flashcards
document.addEventListener('keydown', (e) => {
    const viewer = document.getElementById('flashcardViewer');
    if (!viewer || viewer.classList.contains('hidden')) return;
    
    switch(e.key) {
        case 'ArrowLeft':
            previousFlashcard();
            break;
        case 'ArrowRight':
            nextFlashcard();
            break;
        case ' ':
            e.preventDefault();
            flipFlashcard();
            break;
        case 'Escape':
            closeFlashcardViewer();
            break;
    }
});

    // ============================================
// QUIZ SYSTEM
// ============================================
let quizData = [];
let currentQuizIndex = 0;
let quizAnswers = [];
let savedQuizzes = [];

function openQuizViewer(questions) {
    // Transform questions to include options if they don't have them
    quizData = questions.map(q => {
        // Always set correctAnswer from answer field (backend uses 'answer')
        q.correctAnswer = q.answer;
        
        if (!q.options) {
            // Generate 4 options with the correct answer
            q.options = generateQuizOptions(q.answer);
        }
        return q;
    });
    
    currentQuizIndex = 0;
    quizAnswers = new Array(quizData.length).fill(null);
    
    const viewer = document.getElementById('flashcardViewer');
    const studioGrid = document.getElementById('studioGrid');
    const studioFooter = document.getElementById('studioFooter');
    const studyOutput = document.getElementById('studyOutput');
    
    studioGrid.classList.add('hidden');
    studioFooter.classList.add('hidden');
    studyOutput.classList.add('hidden');
    viewer.classList.remove('hidden');
    
    let quizTitle = 'Quiz';
    if (sources.size > 0) {
        const firstSource = Array.from(sources)[0];
        quizTitle = firstSource.replace(/\.(pdf|txt)$/i, '').replace(/_/g, ' ') + ' Quiz';
    }
    
    renderQuizQuestion();
    saveQuizButton(quizTitle, quizData);
}

function generateQuizOptions(correctAnswer) {
    // This generates placeholder options - ideally backend should provide them
    return [
        correctAnswer,
        "Alternative answer 1",
        "Alternative answer 2", 
        "Alternative answer 3"
    ].sort(() => Math.random() - 0.5);
}

function renderQuizQuestion() {
    const viewer = document.getElementById('flashcardViewer');
    const question = quizData[currentQuizIndex];
    const isAnswered = quizAnswers[currentQuizIndex] !== null;
    const userAnswer = quizAnswers[currentQuizIndex];
    const isCorrect = userAnswer === question.correctAnswer;
    
    let quizTitle = 'Quiz';
    if (sources.size > 0) {
        const firstSource = Array.from(sources)[0];
        quizTitle = firstSource.replace(/\.(pdf|txt)$/i, '').replace(/_/g, ' ') + ' Quiz';
    }
    
    viewer.innerHTML = `
        <div class="quiz-header-studio">
            <div class="quiz-info">
                <h3>${quizTitle}</h3>
                <p class="quiz-source">Based on ${sources.size} source${sources.size > 1 ? 's' : ''}</p>
            </div>
            <button class="close-quiz-btn" onclick="closeQuizViewer()">×</button>
        </div>
        
        <div class="quiz-progress-bar">
            <div class="quiz-progress-text">${currentQuizIndex + 1} / ${quizData.length}</div>
            <div class="quiz-progress-track">
                <div class="quiz-progress-fill" style="width: ${((currentQuizIndex + 1) / quizData.length) * 100}%"></div>
            </div>
        </div>
        
        <div class="quiz-content-area">
            <div class="quiz-question-text">
                ${question.question}
            </div>
            
            <div class="quiz-options">
                ${(question.options || [question.answer]).map((option, idx) => {
                    const optionLetter = String.fromCharCode(65 + idx);
                    const isSelected = userAnswer === option;
                    const isThisCorrect = option === question.correctAnswer;
                    
                    let optionClass = 'quiz-option';
                    let feedbackHtml = '';
                    
                    if (isAnswered) {
                        if (isSelected && isCorrect) {
                            optionClass += ' correct-selected';
                            feedbackHtml = `
                                <div class="option-feedback correct">
                                    <span class="feedback-icon">✓</span>
                                    <span class="feedback-text">That's right!</span>
                                    <p class="feedback-explanation">${question.explanation || 'Correct answer based on the source material.'}</p>
                                </div>
                            `;
                        } else if (isSelected && !isCorrect) {
                            optionClass += ' incorrect-selected';
                            feedbackHtml = `
                                <div class="option-feedback incorrect">
                                    <span class="feedback-icon">✗</span>
                                    <span class="feedback-text">Not quite</span>
                                    <p class="feedback-explanation">${question.wrongExplanation || 'This is not the correct answer according to the source material.'}</p>
                                </div>
                            `;
                        } else if (isThisCorrect && !isCorrect) {
                            optionClass += ' correct-not-selected';
                            feedbackHtml = `
                                <div class="option-feedback correct">
                                    <span class="feedback-icon">✓</span>
                                    <span class="feedback-text">Correct answer</span>
                                    <p class="feedback-explanation">${question.explanation || 'This is the correct answer based on the source material.'}</p>
                                </div>
                            `;
                        }
                    }
                    
                    return `
                        <div class="${optionClass}" onclick="${!isAnswered ? `selectQuizAnswer('${option.replace(/'/g, "\\'")}')` : ''}">
                            <div class="option-content">
                                <span class="option-letter">${optionLetter}.</span>
                                <span class="option-text">${option}</span>
                            </div>
                            ${feedbackHtml}
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
        
        <div class="quiz-footer">
            <button class="quiz-nav-btn" ${currentQuizIndex === 0 ? 'disabled' : ''} onclick="previousQuizQuestion()">
                Previous
            </button>
            ${!isAnswered && currentQuizIndex === quizData.length - 1 ? 
                `<button class="quiz-submit-btn" onclick="finishQuiz()">Finish Quiz</button>` :
                `<button class="quiz-nav-btn primary" ${!isAnswered ? 'disabled' : ''} onclick="nextQuizQuestion()">
                    ${currentQuizIndex === quizData.length - 1 ? 'Finish' : 'Next'}
                </button>`
            }
        </div>
    `;
}

function selectQuizAnswer(answer) {
    quizAnswers[currentQuizIndex] = answer;
    renderQuizQuestion();
}

function nextQuizQuestion() {
    if (currentQuizIndex < quizData.length - 1) {
        currentQuizIndex++;
        renderQuizQuestion();
    } else {
        finishQuiz();
    }
}

function previousQuizQuestion() {
    if (currentQuizIndex > 0) {
        currentQuizIndex--;
        renderQuizQuestion();
    }
}

function finishQuiz() {
    const correctCount = quizAnswers.filter((ans, idx) => ans === quizData[idx].correctAnswer).length;
    const wrongCount = quizAnswers.filter((ans, idx) => ans !== null && ans !== quizData[idx].correctAnswer).length;
    const skippedCount = quizAnswers.filter(ans => ans === null).length;
    const accuracy = Math.round((correctCount / quizData.length) * 100);
    
    const viewer = document.getElementById('flashcardViewer');
    
    let quizTitle = 'Quiz';
    if (sources.size > 0) {
        const firstSource = Array.from(sources)[0];
        quizTitle = firstSource.replace(/\.(pdf|txt)$/i, '').replace(/_/g, ' ') + ' Quiz';
    }
    
    viewer.innerHTML = `
        <div class="quiz-header-studio">
            <div class="quiz-info">
                <h3>${quizTitle}</h3>
                <p class="quiz-source">Based on ${sources.size} source${sources.size > 1 ? 's' : ''}</p>
            </div>
            <button class="close-quiz-btn" onclick="closeQuizViewer()">×</button>
        </div>
        
        <div class="quiz-complete-screen">
            <h2>You did it! Quiz Complete.</h2>
            
            <div class="quiz-stats">
                <div class="quiz-stat-card">
                    <div class="stat-label">Score</div>
                    <div class="stat-value">${correctCount} / ${quizData.length}</div>
                </div>
                <div class="quiz-stat-card">
                    <div class="stat-label">Accuracy</div>
                    <div class="stat-value">${accuracy}%</div>
                </div>
                <div class="quiz-stat-details">
                    <div class="stat-detail">
                        <span class="stat-detail-label">Right</span>
                        <span class="stat-detail-value">${correctCount}</span>
                    </div>
                    <div class="stat-detail">
                        <span class="stat-detail-label">Wrong</span>
                        <span class="stat-detail-value">${wrongCount}</span>
                    </div>
                    <div class="stat-detail">
                        <span class="stat-detail-label">Skipped</span>
                        <span class="stat-detail-value">${skippedCount}</span>
                    </div>
                </div>
            </div>
            
            <div class="quiz-complete-actions">
                <button class="quiz-action-btn secondary" onclick="reviewQuiz()">Review Quiz</button>
                <button class="quiz-action-btn primary" onclick="retakeQuiz()">Retake Quiz</button>
            </div>
        </div>
    `;
}

function reviewQuiz() {
    currentQuizIndex = 0;
    renderQuizQuestion();
}

function retakeQuiz() {
    quizAnswers = new Array(quizData.length).fill(null);
    currentQuizIndex = 0;
    renderQuizQuestion();
}

function closeQuizViewer() {
    const viewer = document.getElementById('flashcardViewer');
    const studioGrid = document.getElementById('studioGrid');
    const studioFooter = document.getElementById('studioFooter');
    const studyOutput = document.getElementById('studyOutput');
    
    viewer.classList.add('hidden');
    viewer.innerHTML = '';
    studioGrid.classList.remove('hidden');
    studioFooter.classList.remove('hidden');
    studyOutput.classList.remove('hidden');
}

function saveQuizButton(title, questions) {
    const exists = savedQuizzes.find(q => q.title === title);
    if (exists) {
        exists.questions = questions;
        exists.timestamp = Date.now();
    } else {
        savedQuizzes.push({
            title: title,
            questions: questions,
            timestamp: Date.now()
        });
    }
    renderSavedItems();
}

function renderSavedItems() {
    const studioFooter = document.getElementById('studioFooter');
    
    if (savedQuizzes.length === 0 && savedFlashcards.length === 0 && savedSlides.length === 0 && savedVideos.length === 0) {
        studioFooter.innerHTML = '<p>Studio output will be saved here.</p>';
        return;
    }
    
    let html = '';
    
    // Render saved quizzes
    savedQuizzes.forEach((quiz, index) => {
        const timeAgo = getTimeAgo(quiz.timestamp);
        html += `
            <div class="saved-flashcard-item" onclick="openSavedQuiz(${index})">
                <div class="saved-flashcard-icon">📝</div>
                <div class="saved-flashcard-info">
                    <div class="saved-flashcard-title">${quiz.title}</div>
                    <div class="saved-flashcard-meta">${sources.size} source · ${timeAgo}</div>
                </div>
                <button class="saved-flashcard-menu" onclick="event.stopPropagation(); deleteSavedQuiz(${index})">⋮</button>
            </div>
        `;
    });
    
    // Render saved flashcards
    savedFlashcards.forEach((flashcard, index) => {
        const timeAgo = getTimeAgo(flashcard.timestamp);
        html += `
            <div class="saved-flashcard-item" onclick="openSavedFlashcard(${index})">
                <div class="saved-flashcard-icon">🗂️</div>
                <div class="saved-flashcard-info">
                    <div class="saved-flashcard-title">${flashcard.title}</div>
                    <div class="saved-flashcard-meta">${sources.size} source · ${timeAgo}</div>
                </div>
                <button class="saved-flashcard-menu" onclick="event.stopPropagation(); deleteSavedFlashcard(${index})">⋮</button>
            </div>
        `;
    });
    
    // Render saved slides
    savedSlides.forEach((slide, index) => {
        const timeAgo = getTimeAgo(slide.timestamp);
        html += `
            <div class="saved-flashcard-item" onclick="openSavedSlide(${index})">
                <div class="saved-flashcard-icon">🎞️</div>
                <div class="saved-flashcard-info">
                    <div class="saved-flashcard-title">${slide.title}</div>
                    <div class="saved-flashcard-meta">${sources.size} source · ${timeAgo}</div>
                </div>
                <button class="saved-flashcard-menu" onclick="event.stopPropagation(); deleteSavedSlide(${index})">⋮</button>
            </div>
        `;
    });
    
    // Render saved videos
    savedVideos.forEach((video, index) => {
        const timeAgo = getTimeAgo(video.timestamp);
        const durationMin = Math.round(video.duration / 60);
        html += `
            <div class="saved-flashcard-item" onclick="openSavedVideo(${index})">
                <div class="saved-flashcard-icon">🎬</div>
                <div class="saved-flashcard-info">
                    <div class="saved-flashcard-title">${video.title}</div>
                    <div class="saved-flashcard-meta">${sources.size} source · ${durationMin}min · ${timeAgo}</div>
                </div>
                <button class="saved-flashcard-menu" onclick="event.stopPropagation(); deleteSavedVideo(${index})">⋮</button>
            </div>
        `;
    });
    
    studioFooter.innerHTML = html;
}

function openSavedQuiz(index) {
    const quiz = savedQuizzes[index];
    if (quiz) {
        openQuizViewer(quiz.questions);
    }
}

function deleteSavedQuiz(index) {
    if (confirm('Delete this quiz?')) {
        savedQuizzes.splice(index, 1);
        renderSavedItems();
    }
}

// ============================================
// SLIDE DECK SYSTEM
// ============================================
let savedSlides = [];

async function generateSlides() {
    if (sources.size === 0) {
        alert('Please upload a source first!');
        return;
    }

    const output = document.getElementById('studyOutput');
    output.innerHTML = '<div class="loading">Generating presentation...</div>';
    output.scrollIntoView({ behavior: "smooth" });

    try {
        const response = await fetch('/generate_slides', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to generate slides');
        }

        // Get title from source
        let slideTitle = 'Presentation';
        if (sources.size > 0) {
            const firstSource = Array.from(sources)[0];
            slideTitle = firstSource.replace(/\.(pdf|txt)$/i, '').replace(/_/g, ' ');
        }

        // Save the slide deck
        saveSlideButton(slideTitle, data.download_url);
        
        output.innerHTML = '<div class="success">✓ Presentation generated successfully! Check saved items below.</div>';

    } catch (e) {
        console.error('Slide generation error:', e);
        output.innerHTML = '<div class="error">Error generating slides. Please try again.</div>';
    }
}

function saveSlideButton(title, downloadUrl) {
    const exists = savedSlides.find(s => s.title === title);
    if (exists) {
        exists.downloadUrl = downloadUrl;
        exists.timestamp = Date.now();
    } else {
        savedSlides.push({
            title: title,
            downloadUrl: downloadUrl,
            timestamp: Date.now()
        });
    }
    renderSavedItems();
}

function openSavedSlide(index) {
    const slide = savedSlides[index];
    if (slide && slide.downloadUrl) {
        const link = document.createElement('a');
        link.href = slide.downloadUrl;
        link.download = slide.title + '.pptx';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

function deleteSavedSlide(index) {
    if (confirm('Delete this presentation?')) {
        savedSlides.splice(index, 1);
        renderSavedItems();
    }
}

// ============================================
// VIDEO OVERVIEW SYSTEM
// ============================================
let savedVideos = [];

async function generateVideo() {
    if (sources.size === 0) {
        alert('Please upload a source first!');
        return;
    }

    const output = document.getElementById('studyOutput');
    output.innerHTML = '<div class="loading">Generating video overview... This may take 2-3 minutes.</div>';
    output.scrollIntoView({ behavior: "smooth" });

    try {
        const response = await fetch('/generate_video', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to generate video');
        }

        // Get title from source
        let videoTitle = 'Video Overview';
        if (sources.size > 0) {
            const firstSource = Array.from(sources)[0];
            videoTitle = firstSource.replace(/\.(pdf|txt)$/i, '').replace(/_/g, ' ');
        }

        // Save the video
        saveVideoButton(videoTitle, data.video_url, data.duration);
        
        output.innerHTML = `
            <div class="success">
                ✓ Video generated successfully! 
                <br><small>${Math.round(data.duration / 60)} minutes · ${data.slides_count} slides</small>
                <br><br>
                <video controls style="width: 100%; max-width: 500px; border-radius: 8px; margin-top: 10px;">
                    <source src="${data.video_url}" type="video/mp4">
                </video>
            </div>
        `;

    } catch (e) {
        console.error('Video generation error:', e);
        output.innerHTML = '<div class="error">Error generating video. Please try again.</div>';
    }
}

function saveVideoButton(title, videoUrl, duration) {
    const exists = savedVideos.find(v => v.title === title);
    if (exists) {
        exists.videoUrl = videoUrl;
        exists.duration = duration;
        exists.timestamp = Date.now();
    } else {
        savedVideos.push({
            title: title,
            videoUrl: videoUrl,
            duration: duration,
            timestamp: Date.now()
        });
    }
    renderSavedItems();
}

function openSavedVideo(index) {
    const video = savedVideos[index];
    if (video && video.videoUrl) {
        // Open video in a modal or new tab
        const output = document.getElementById('studyOutput');
        output.innerHTML = `
            <div class="video-player-container">
                <h3>${video.title}</h3>
                <video controls style="width: 100%; border-radius: 8px;">
                    <source src="${video.videoUrl}" type="video/mp4">
                </video>
                <div style="margin-top: 10px; text-align: center;">
                    <a href="${video.videoUrl}" download="${video.title}.mp4" class="quiz-action-btn primary">
                        Download Video
                    </a>
                </div>
            </div>
        `;
        output.scrollIntoView({ behavior: "smooth" });
    }
}

function deleteSavedVideo(index) {
    if (confirm('Delete this video?')) {
        savedVideos.splice(index, 1);
        renderSavedItems();
    }
}