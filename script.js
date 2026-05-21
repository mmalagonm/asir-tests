document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const subjectSelect = document.getElementById('subject-select');
    const testSelect = document.getElementById('test-select');
    const lessonSelect = document.getElementById('lesson-select');
    const startTestBtn = document.getElementById('start-test-btn');
    const startLessonBtn = document.getElementById('start-lesson-btn');
    const finishBtn = document.getElementById('finish-btn');
    
    const welcomeScreen = document.getElementById('welcome-screen');
    const quizContainer = document.getElementById('quiz-container');
    const resultsScreen = document.getElementById('results-screen');
    const lessonContainer = document.getElementById('lesson-container');
    
    const fluxStatusBar = document.getElementById('flux-status-bar');
    const progressBar = document.getElementById('progress-bar');
    
    // Containers for dynamic content
    const quizListContainer = document.getElementById('options-container'); // We'll use this for the whole list
    const quizTitle = document.getElementById('question-text');
    
    // Lesson specific
    const lessonTitle = document.getElementById('lesson-title');
    const lessonContent = document.getElementById('lesson-content');
    const lessonVisual = document.getElementById('lesson-visual');
    const lessonPageSelect = document.getElementById('lesson-page-select');
    const totalPagesLabel = document.getElementById('total-pages');
    const prevPageBtn = document.getElementById('prev-page-btn');
    const nextPageBtn = document.getElementById('next-page-btn');

    // Modal
    const imageModal = document.getElementById('image-modal');
    const modalImg = document.getElementById('modal-img');

    // Result elements
    const totalQuestionsSpan = document.getElementById('total-questions');
    const correctAnswersSpan = document.getElementById('correct-answers');
    const wrongAnswersSpan = document.getElementById('wrong-answers');
    const finalGradeSpan = document.getElementById('final-grade');
    const restartBtn = document.getElementById('restart-btn');

    // State
    let currentData = null; 
    let currentIndex = 0;   
    let userAnswers = [];
    let subjectPath = '';

    const fmt = (num) => num.toString().padStart(2, '0');

    const escapeHTML = (str) => {
        if (typeof str !== 'string') return str;
        return str.replace(/[&<>'"]/g, tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)).replace(/\n/g, '<br>');
    };

    // Init subjects
    Object.keys(TEST_CONFIG).forEach(subject => {
        const option = document.createElement('option');
        option.value = subject; option.textContent = subject;
        subjectSelect.appendChild(option);
    });

    subjectSelect.addEventListener('change', () => {
        const selected = subjectSelect.value;
        testSelect.innerHTML = '<option value="">SELECT TEST...</option>';
        lessonSelect.innerHTML = '<option value="">SELECT LESSON...</option>';
        if (selected) {
            const config = TEST_CONFIG[selected];
            if (config.tests.length > 0) {
                config.tests.forEach(t => {
                    const opt = document.createElement('option');
                    opt.value = t.path; opt.textContent = t.name;
                    testSelect.appendChild(opt);
                });
                testSelect.disabled = false;
            } else { testSelect.disabled = true; }
            if (config.lessons.length > 0) {
                config.lessons.forEach(l => {
                    const opt = document.createElement('option');
                    opt.value = l.path; opt.textContent = l.name;
                    lessonSelect.appendChild(opt);
                });
                lessonSelect.disabled = false;
            } else { lessonSelect.disabled = true; }
        }
    });

    testSelect.addEventListener('change', () => {
        startTestBtn.disabled = !testSelect.value;
        if (testSelect.value) { lessonSelect.value = ""; startLessonBtn.disabled = true; }
    });

    lessonSelect.addEventListener('change', () => {
        startLessonBtn.disabled = !lessonSelect.value;
        if (lessonSelect.value) { testSelect.value = ""; startTestBtn.disabled = true; }
    });

    startTestBtn.addEventListener('click', () => initiateData(testSelect.value));
    startLessonBtn.addEventListener('click', () => initiateData(lessonSelect.value));

    // --- NAVIGATION BAR (SEGMENTED) ---
    function initProgressBar(count) {
        fluxStatusBar.innerHTML = '';
        for (let i = 0; i < count; i++) {
            const seg = document.createElement('div');
            seg.className = 'progress-segment';
            seg.textContent = i + 1;
            seg.dataset.idx = i;
            seg.addEventListener('click', () => navigateTo(i));
            fluxStatusBar.appendChild(seg);
        }
    }

    function updateProgressBar() {
        const segments = fluxStatusBar.querySelectorAll('.progress-segment');
        segments.forEach((seg, i) => {
            seg.classList.remove('active', 'completed', 'correct', 'wrong');

            if (currentData.tipo === 'leccion') {
                if (i === currentIndex) seg.classList.add('active');
                else if (i < currentIndex) seg.classList.add('completed');
            } else {
                // Quiz logic
                if (userAnswers[i] !== null) {
                    const q = currentData.preguntas[i];
                    if (userAnswers[i] === q.respuesta_correcta) seg.classList.add('correct');
                    else seg.classList.add('wrong');
                }
            }
        });
    }

    function navigateTo(idx) {
        if (currentData.tipo === 'leccion') {
            currentIndex = idx;
            showLessonPage();
        } else {
            const el = document.getElementById(`q-item-${idx}`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                // Optional: visual highlight
                el.style.borderColor = 'var(--orange-accent)';
                setTimeout(() => el.style.borderColor = 'var(--border-color)', 2000);
            }
        }
    }

    async function initiateData(path) {
        subjectPath = path.substring(0, path.lastIndexOf('/') + 1);
        try {
            const resp = await fetch(path);
            currentData = await resp.json();
            if (currentData.tipo === 'leccion') {
                initProgressBar(currentData.paginas.length);
                startLesson();
            } else {
                initProgressBar(currentData.preguntas.length);
                startQuiz();
            }
        } catch (e) { alert('Error al cargar el archivo de datos.'); }
    }

    // --- QUIZ LOGIC (NEW LIST FORMAT) ---
    function startQuiz() {
        userAnswers = new Array(currentData.preguntas.length).fill(null);
        document.body.classList.remove('lesson-mode');
        welcomeScreen.classList.add('hidden');
        resultsScreen.classList.add('hidden');
        lessonContainer.classList.add('hidden');
        quizContainer.classList.remove('hidden');
        finishBtn.classList.remove('hidden');

        quizTitle.textContent = currentData.titulo;
        document.getElementById('image-container').classList.add('hidden'); 
        document.getElementById('score-display').textContent = '00';

        renderQuizList();
        updateProgressBar();
    }
    function renderQuizList() {
        quizListContainer.innerHTML = '';
        currentData.preguntas.forEach((q, qIdx) => {
            const item = document.createElement('div');
            item.className = 'mini-quiz-item';
            item.id = `q-item-${qIdx}`;
            item.style.marginBottom = '3rem';
            item.style.background = 'var(--bg-panel)';
            item.style.padding = '1.5rem';
            item.style.borderRadius = '12px';
            item.style.border = '1px solid var(--border-color)';

            let imgHtml = '';
            if (q.fichero_imagen) {
                imgHtml = `<div class="lesson-visual" style="background:#000; margin:1rem 0;"><img src="${subjectPath + q.fichero_imagen}" style="max-width:100%; cursor:zoom-in;" onclick="openModal(this.src)"></div>`;
            }

            item.innerHTML = `
                <p style="font-size:1.1rem; font-weight:bold; margin-bottom:1rem; color:var(--blue-accent);">${qIdx + 1}. ${escapeHTML(q.enunciado)}</p>
                ${imgHtml}
                <div class="mini-options" style="display:flex; flex-direction:column; gap:10px;">
                    ${Object.entries(q.opciones).map(([key, text]) => `
                        <button class="option-btn" style="font-size:0.95rem;" onclick="handleQuizSelection(this, '${key}', ${qIdx})">
                            <strong>${key.toUpperCase()}</strong>: ${escapeHTML(text)}
                        </button>
                    `).join('')}
                </div>
                <div class="mini-feedback hidden" style="margin-top:1.5rem; padding:1.2rem; background:rgba(88,166,255,0.05); border-left:4px solid var(--blue-accent); border-radius:4px;">
                    <div style="color:var(--blue-accent); font-weight:bold; font-size:0.8rem; text-transform:uppercase; margin-bottom:0.5rem;">Análisis Técnico:</div>
                    <div style="line-height:1.5;">${escapeHTML(q.retroalimentacion || 'Analizando datos...')}</div>
                </div>
            `;
            quizListContainer.appendChild(item);
        });

        const finishQuizBtn = document.createElement('button');
        finishQuizBtn.className = 'circuit-btn';
        finishQuizBtn.style.marginTop = '2rem';
        finishQuizBtn.textContent = 'ENVIAR Y VER RESULTADOS';
        finishQuizBtn.onclick = showResults;
        quizListContainer.appendChild(finishQuizBtn);
    }

    window.handleQuizSelection = (btn, key, qIdx) => {
        if (userAnswers[qIdx] !== null) return;
        userAnswers[qIdx] = key;

        const q = currentData.preguntas[qIdx];
        const container = btn.closest('.mini-quiz-item');
        const btns = container.querySelectorAll('.option-btn');
        const feedback = container.querySelector('.mini-feedback');

        // Update Temporal Coordinate Display
        const qCounter = document.getElementById('question-counter');
        if (qCounter) qCounter.textContent = fmt(qIdx + 1);

        btns.forEach(b => { 
            const bKey = b.querySelector('strong').textContent.toLowerCase();
            const correctKey = q.respuesta_correcta.toLowerCase();
            b.style.opacity = '0.4';
            b.style.pointerEvents = 'none';
            if (bKey === correctKey) {
                b.classList.add('correct');
                b.style.opacity = '1';
            }
            if (key.toLowerCase() === bKey && key.toLowerCase() !== correctKey) {
                b.classList.add('wrong');
                b.style.opacity = '1';
            }
        });

        feedback.classList.remove('hidden');        
        
        const currentScore = userAnswers.reduce((acc, a, idx) => {
            if (!a || !currentData.preguntas[idx]) return acc;
            return a.toLowerCase() === currentData.preguntas[idx].respuesta_correcta.toLowerCase() ? acc + 1 : acc;
        }, 0);
        const scoreDisplay = document.getElementById('score-display');
        if (scoreDisplay) scoreDisplay.textContent = fmt(currentScore);

        updateProgressBar();
    };

    function showResults() {
        const unanswered = userAnswers.filter(a => a === null).length;
        if (unanswered > 0 && !confirm(`Tienes ${unanswered} preguntas sin responder. ¿Deseas continuar?`)) return;

        quizContainer.classList.add('hidden');
        finishBtn.classList.add('hidden');
        resultsScreen.classList.remove('hidden');
        
        const score = userAnswers.reduce((acc, a, idx) => {
            if (!a || !currentData.preguntas[idx]) return acc;
            return a.toLowerCase() === currentData.preguntas[idx].respuesta_correcta.toLowerCase() ? acc + 1 : acc;
        }, 0);
        const total = currentData.preguntas.length;
        finalGradeSpan.textContent = ((score / total) * 10).toFixed(1);
        totalQuestionsSpan.textContent = total;
        correctAnswersSpan.textContent = score;
        wrongAnswersSpan.textContent = total - score;

        const rev = document.getElementById('review-list');
        rev.innerHTML = '';
        currentData.preguntas.forEach((q, i) => {
            const item = document.createElement('div');
            const isCorrect = userAnswers[i] && userAnswers[i].toLowerCase() === q.respuesta_correcta.toLowerCase();
            item.className = `review-item ${isCorrect ? 'correct' : 'wrong'}`;
            item.innerHTML = `<p><strong>${i + 1}. ${escapeHTML(q.enunciado)}</strong></p><p>Tu: ${userAnswers[i] ? userAnswers[i].toUpperCase() : 'N/A'} | Ok: ${q.respuesta_correcta.toUpperCase()}</p>`;
            rev.appendChild(item);
        });
        window.scrollTo(0,0);
    }

    // --- LESSON LOGIC ---
    function startLesson() {
        currentIndex = 0;
        document.body.classList.add('lesson-mode');
        welcomeScreen.classList.add('hidden');
        quizContainer.classList.add('hidden');
        resultsScreen.classList.add('hidden');
        lessonContainer.classList.remove('hidden');
        finishBtn.classList.add('hidden');
        
        lessonPageSelect.innerHTML = '';
        currentData.paginas.forEach((p, i) => {
            const opt = document.createElement('option');
            opt.value = i; opt.textContent = fmt(i + 1);
            lessonPageSelect.appendChild(opt);
        });
        showLessonPage();
    }

    function showLessonPage() {
        const page = currentData.paginas[currentIndex];
        lessonPageSelect.value = currentIndex;
        totalPagesLabel.textContent = fmt(currentData.paginas.length);

        lessonTitle.textContent = page.titulo;
        updateProgressBar();
        
        let contentHtml = page.contenido;
        if (page.preguntas_test) {
            contentHtml += '<div class="lesson-assessment" style="margin-top:2rem;">';
            page.preguntas_test.forEach((pq, qIdx) => {
                contentHtml += `
                    <div class="mini-quiz-item" style="margin-bottom:2.5rem; background:rgba(255,255,255,0.03); padding:1.5rem; border-radius:12px; border:1px solid var(--border-color);">
                        <p style="margin-bottom:1.2rem; font-weight:bold; font-size:1.1rem; color:var(--blue-accent);">${escapeHTML(pq.q)}</p>
                        <div class="mini-options" style="display:flex; flex-direction:column; gap:10px;">
                            ${pq.options.map((opt, oIdx) => `
                                <button class="option-btn mini-quiz-option" 
                                    data-o-idx="${oIdx}" 
                                    data-correct-idx="${pq.correct}">
                                    ${escapeHTML(opt)}
                                </button>
                            `).join('')}
                        </div>
                        <div class="mini-feedback hidden" style="margin-top:1.5rem; padding:1rem; background:rgba(88,166,255,0.1); border-left:4px solid var(--blue-accent); border-radius:4px;">
                            <div style="color:var(--blue-accent); font-weight:bold; font-size:0.8rem; text-transform:uppercase; margin-bottom:0.5rem;">Análisis Técnico:</div>
                            <div style="font-size:1rem; margin-bottom:0.8rem;">${escapeHTML(pq.explicacion)}</div>
                            <div style="font-style:italic; font-size:0.95rem; color:var(--text-muted);">${escapeHTML(pq.ejemplo || '')}</div>
                        </div>
                    </div>`;
            });
            contentHtml += '</div>';
        }
        lessonContent.innerHTML = contentHtml;

        lessonVisual.innerHTML = '';
        if (page.fichero_imagen) {
            const img = document.createElement('img');
            img.src = subjectPath + page.fichero_imagen;
            img.style.maxWidth = "100%";
            img.style.cursor = "zoom-in";
            img.onclick = () => openModal(img.src);
            lessonVisual.appendChild(img);
            lessonVisual.classList.remove('hidden');
        } else {
            lessonVisual.classList.add('hidden');
        }
        document.getElementById('temporal-display').scrollTo(0,0);
        prevPageBtn.classList.toggle('hidden', currentIndex === 0);
        nextPageBtn.textContent = currentIndex === currentData.paginas.length - 1 ? "FINALIZAR LECCIÓN" : "SIGUIENTE";
    }

    lessonContent.addEventListener('click', (e) => {
        const btn = e.target.closest('.mini-quiz-option');
        if (!btn) return;
        
        const oIdx = parseInt(btn.dataset.oIdx);
        const correctIdx = parseInt(btn.dataset.correctIdx);
        const container = btn.closest('.mini-quiz-item');
        const btns = container.querySelectorAll('.option-btn');
        const feedback = container.querySelector('.mini-feedback');
        
        btns.forEach(b => { 
            b.style.opacity = '0.4'; 
            b.style.pointerEvents = 'none'; 
        });
        
        btn.style.opacity = '1';
        if (oIdx === correctIdx) {
            btn.classList.add('correct');
        } else {
            btn.classList.add('wrong');
            btns[correctIdx].classList.add('correct');
            btns[correctIdx].style.opacity = '1';
        }
        feedback.classList.remove('hidden');
    });

    window.openModal = (src) => {
        modalImg.src = src;
        imageModal.classList.remove('hidden');
    };

    lessonPageSelect.addEventListener('change', () => {
        currentIndex = parseInt(lessonPageSelect.value);
        showLessonPage();
    });

    nextPageBtn.addEventListener('click', () => {
        if (currentIndex < currentData.paginas.length - 1) { currentIndex++; showLessonPage(); } else { location.reload(); }
    });

    prevPageBtn.addEventListener('click', () => {
        if (currentIndex > 0) { currentIndex--; showLessonPage(); }
    });

    imageModal.addEventListener('click', () => imageModal.classList.add('hidden'));
    restartBtn.addEventListener('click', () => location.reload());
    finishBtn.addEventListener('click', () => { if (confirm('¿Seguro que deseas finalizar y ver los resultados?')) showResults(); });

    // --- TIPS ROTATION ---
    let currentTipIndex = 0;
    const tipSubjectEl = document.getElementById('tip-subject');
    const tipRaEl = document.getElementById('tip-ra');
    const tipTextEl = document.getElementById('tip-text');

    function rotateTip() {
        if (typeof asirTips === 'undefined' || !Array.isArray(asirTips) || asirTips.length === 0) {
            if (tipSubjectEl) tipSubjectEl.textContent = "Cargando consejos...";
            return;
        }
        
        const tip = asirTips[currentTipIndex];
        if (tipSubjectEl) tipSubjectEl.textContent = tip.subject || "";
        if (tipRaEl) tipRaEl.textContent = tip.ra || "";
        if (tipTextEl) tipTextEl.textContent = tip.text || "";
        
        currentTipIndex = (currentTipIndex + 1) % asirTips.length;
    }

    // Try to initialize tips immediately and set interval
    if (typeof asirTips !== 'undefined' && asirTips.length > 0) {
        rotateTip();
        setInterval(rotateTip, 8000);
    } else {
        // Fallback for slower loads
        let retryCount = 0;
        const retryTips = setInterval(() => {
            retryCount++;
            if (typeof asirTips !== 'undefined' && asirTips.length > 0) {
                rotateTip();
                setInterval(rotateTip, 8000);
                clearInterval(retryTips);
            } else if (retryCount > 10) {
                if (tipSubjectEl) tipSubjectEl.textContent = "Error de sincronización";
                clearInterval(retryTips);
            }
        }, 1000);
    }
});
