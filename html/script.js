/**
 * ====================================================================
 * HUGO JUIZ 7.0.1 - ULTIMATE EDITION (FIXED)
 * Correção: Função renderRanking restaurada
 * ====================================================================
 */

const StudySystem = {
    config: {
        version: '7.0.1',
        storageKey: 'hugo_juiz_db_v7',
        viewMode: 'cards', // cards, neuro, matrix, ranking
        showArchived: false,
        inputWeight: { active: 1.0, passive: 0.5 }
    },

    data: {
        disciplines: [],
        userSettings: { darkMode: false },
        stats: { streak: 0, lastLogin: null }
    },

    temp: { discId: null, topicId: null },

    async init() {
        console.log(`🚀 HUGO JUIZ ${this.config.version} Iniciado`);
        this.setupGlobalAccess();
        await this.loadData();
        this.setupEventListeners();
        this.applyTheme();
        this.updateGlobalStats();
        this.renderInterface();
    },

    setupGlobalAccess() {
        window.StudySystem = this;
        window.toggleDarkMode = () => this.toggleTheme();
        window.closeModal = () => document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
    },

    setupEventListeners() {
        const search = document.getElementById('search-input');
        if(search) search.addEventListener('input', (e) => this.renderInterface(e.target.value));
        
        // Listener de Erro no Modal Stats
        const totalIn = document.getElementById('stats-total');
        const correctIn = document.getElementById('stats-correct');
        const errorGroup = document.getElementById('error-diagnosis-group');
        
        const checkError = () => {
            const t = parseInt(totalIn.value) || 0;
            const c = parseInt(correctIn.value) || 0;
            if(t > 0 && c < t) errorGroup.classList.remove('hidden');
            else errorGroup.classList.add('hidden');
        };
        
        if(totalIn) {
            totalIn.addEventListener('input', checkError);
            correctIn.addEventListener('input', checkError);
        }
    },

    async loadData() {
        const raw = localStorage.getItem(this.config.storageKey);
        if (raw) this.data = JSON.parse(raw);
        else { this.data.disciplines = []; this.saveData(); }
    },

    saveData() {
        localStorage.setItem(this.config.storageKey, JSON.stringify(this.data));
        this.updateGlobalStats();
        // Não re-renderiza tudo se estiver apenas num modal
        const statsModal = document.getElementById('stats-modal');
        if (!statsModal || statsModal.style.display !== 'flex') {
             this.renderInterface();
        }
    },

    // ==================== VISUALIZAÇÃO ====================

    switchView(mode) {
        this.config.viewMode = mode;
        document.querySelectorAll('.btn-menu').forEach(b => b.classList.remove('active'));
        const btn = document.getElementById(`btn-view-${mode}`);
        if(btn) btn.classList.add('active');
        this.renderInterface();
    },

    toggleShowArchived(checked) {
        this.config.showArchived = checked;
        this.renderInterface();
    },

    renderInterface(filter = '') {
        const container = document.getElementById('main-content-area');
        const hero = document.getElementById('neuro-hero');
        if(!container) return;

        container.innerHTML = '';
        if(hero) hero.classList.add('hidden');

        let list = this.data.disciplines.filter(d => 
            (this.config.showArchived || !d.archived) && 
            d.name.toLowerCase().includes(filter.toLowerCase())
        );

        switch (this.config.viewMode) {
            case 'neuro':
                if(hero) hero.classList.remove('hidden');
                this.renderNeuroDecision(container);
                break;
            case 'matrix':
                this.renderEisenhowerMatrix(container, list);
                break;
            case 'ranking':
                this.renderRanking(container, list); // Agora esta função existe!
                break;
            default: // cards
                this.renderCards(container, list);
        }
    },

    // --- CARDS ---
    renderCards(container, list) {
        container.className = 'disciplines-grid';
        list.sort((a,b) => b.weight - a.weight);
        
        if(list.length === 0) {
            container.innerHTML = `<div class="text-center w-100" style="grid-column:1/-1"><h3>Nenhuma disciplina encontrada. Crie ou Importe!</h3></div>`;
            return;
        }

        list.forEach(d => {
            const stats = this.getStats(d);
            const div = document.createElement('div');
            div.className = `discipline-card ${d.archived?'sleeping':''} ${d.weight>=15?'gourmet':''}`;
            div.style.borderLeftColor = d.color;
            
            div.innerHTML = `
                <div class="discipline-header">
                    <div>
                        <h3>${d.archived?'<i class="fas fa-bed"></i> ':''}<span style="color:${d.color}">${d.name}</span></h3>
                        <span style="font-size:0.8rem; background:${d.color}20; color:${d.color}; padding:2px 8px; border-radius:4px">Peso ${d.weight}</span>
                    </div>
                    <button class="btn-icon" style="color:var(--danger)" onclick="StudySystem.deleteDiscipline('${d.id}')" title="Excluir"><i class="fas fa-trash"></i></button>
                </div>
                <div class="mini-dashboard">
                    <div class="dash-item"><span class="dash-value" style="color:${this.getColor(stats.acc)}">${stats.acc}%</span><small>Domínio</small></div>
                    <div class="dash-item"><span class="dash-value">${stats.total}</span><small>Questões</small></div>
                </div>
                <div class="discipline-actions" style="display:flex; gap:10px; margin-top:10px">
                    <button class="btn btn-primary w-100" onclick="StudySystem.openDetails('${d.id}')">Abrir</button>
                    <button class="btn btn-secondary" onclick="StudySystem.toggleSleep('${d.id}')"><i class="fas ${d.archived?'fa-sun':'fa-bed'}"></i></button>
                </div>
            `;
            container.appendChild(div);
        });
    },

    // --- RANKING GERAL (A FUNÇÃO QUE FALTAVA) ---
    renderRanking(container, list) {
        container.className = '';
        list.sort((a,b) => b.weight - a.weight);

        let html = `
            <div class="card" style="padding:0; overflow:hidden;">
            <table style="width:100%; border-collapse: collapse;">
                <thead style="background:var(--bg-input); font-weight:bold; border-bottom:2px solid var(--border-color);">
                    <tr>
                        <th style="padding:15px; text-align:left;">Hierarquia de Estudo</th>
                        <th style="text-align:center;">Método</th>
                        <th style="text-align:center;">Retenção</th>
                        <th style="text-align:center;">Ação</th>
                    </tr>
                </thead>
                <tbody>
        `;

        if (list.length === 0) {
            html += `<tr><td colspan="4" class="text-center" style="padding:20px;">Sem dados.</td></tr>`;
        }

        list.forEach(d => {
            const stats = this.getStats(d);
            // Linha da Disciplina
            html += `
                <tr style="background:var(--bg-input); border-top:1px solid var(--border-color);">
                    <td style="padding:12px; font-weight:bold; color:${d.color}">
                        <i class="fas fa-folder-open"></i> ${d.name} <small class="text-muted">(Peso ${d.weight})</small>
                    </td>
                    <td class="text-center">-</td>
                    <td class="text-center" style="font-weight:bold; color:${this.getColor(stats.acc)}">${stats.acc}%</td>
                    <td class="text-center">
                        <button class="btn-icon" onclick="StudySystem.openDetails('${d.id}')"><i class="fas fa-list"></i></button>
                    </td>
                </tr>
            `;

            // Linhas dos Tópicos (Recursivo)
            if (d.tasks && d.tasks.length > 0) {
                html += this.renderRankingRows(d.tasks, d.id, 1);
            }
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;
    },

    renderRankingRows(tasks, dId, level) {
        if (!tasks) return '';
        return tasks.map(t => {
            const s = t.stats || { total: 0, correct: 0, inputType: 'passive' };
            const acc = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
            
            const badgeClass = s.inputType === 'active' 
                ? 'background:#e3f2fd; color:#1565c0;' 
                : 'background:#f5f5f5; color:#616161;';
            const badgeText = s.inputType === 'active' ? 'Ativo' : 'Passivo';

            return `
                <tr style="border-bottom:1px solid var(--border-color); background:var(--bg-card);">
                    <td style="padding:8px 12px; padding-left:${level * 30}px;">
                        <span style="color:var(--border-color); margin-right:5px;">↳</span> ${t.text}
                    </td>
                    <td class="text-center">
                        <span style="font-size:0.75rem; padding:2px 6px; border-radius:4px; ${badgeClass}">${badgeText}</span>
                    </td>
                    <td class="text-center" style="color:${this.getColor(acc)}">
                        ${acc}% <small class="text-muted">(${s.total}q)</small>
                    </td>
                    <td class="text-center">
                        <button class="btn-icon" onclick="StudySystem.openStatsModal('${dId}', '${t.id}')"><i class="fas fa-bullseye"></i></button>
                    </td>
                </tr>
                ${this.renderRankingRows(t.subtasks, dId, level + 1)}
            `;
        }).join('');
    },

    // --- MATRIZ EISENHOWER ---
    renderEisenhowerMatrix(container, list) {
        container.className = '';
        const matrix = { q1: [], q2: [], q3: [], q4: [] };
        
        list.forEach(d => {
            const traverse = (tasks) => {
                if(!tasks) return;
                tasks.forEach(t => {
                    const s = t.stats || {total:0, correct:0};
                    const acc = s.total > 0 ? (s.correct/s.total)*100 : 0;
                    const isUrgent = acc < 60 || s.total === 0;
                    const isImportant = d.weight >= 10;
                    
                    const item = { name: t.text, discName: d.name, color: d.color, acc: Math.round(acc) };
                    
                    if(isImportant && isUrgent) matrix.q1.push(item);
                    else if(isImportant && !isUrgent) matrix.q2.push(item);
                    else if(!isImportant && isUrgent) matrix.q3.push(item);
                    else matrix.q4.push(item);
                    
                    if(t.subtasks) traverse(t.subtasks);
                });
            };
            traverse(d.tasks);
        });

        const renderItems = (items) => items.map(i => `
            <div class="matrix-item" style="border-left-color:${i.color}">
                <div><b>${i.name}</b><br><small style="color:${i.color}">${i.discName}</small></div>
                <span style="font-weight:bold; color:${this.getColor(i.acc)}">${i.acc}%</span>
            </div>
        `).join('');

        container.innerHTML = `
            <div class="matrix-grid">
                <div class="quadrant q1"><h4 style="color:var(--danger)">🔥 Faça Agora (Q1)</h4>${renderItems(matrix.q1)}</div>
                <div class="quadrant q2"><h4 style="color:var(--primary)">📅 Planeje (Q2)</h4>${renderItems(matrix.q2)}</div>
                <div class="quadrant q3"><h4 style="color:var(--warning)">⚡ Delegue/Rápido (Q3)</h4>${renderItems(matrix.q3)}</div>
                <div class="quadrant q4"><h4 style="color:var(--success)">☕ Manutenção (Q4)</h4>${renderItems(matrix.q4)}</div>
            </div>
        `;
    },

    // --- NEURO DECISÃO ---
    renderNeuroDecision(container) {
        container.className = '';
        const topics = this.getAllTopicsWithScore();
        const top5 = topics.slice(0, 5);
        
        const recs = document.getElementById('neuro-recommendations');
        recs.innerHTML = top5.length ? '' : '<p>Nada pendente. Adicione conteúdo.</p>';
        
        top5.forEach(i => {
             const div = document.createElement('div');
             div.className = 'card mb-3';
             div.style.borderLeft = `5px solid ${i.discipline.color}`;
             div.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center">
                    <div>
                        <small style="color:${i.discipline.color}; font-weight:bold">${i.discipline.name}</small>
                        <h4>${i.topic.text}</h4>
                        <small class="text-muted"><i class="fas fa-brain"></i> Score: ${i.score}</small>
                    </div>
                    <button class="btn btn-primary" onclick="StudySystem.openStatsModal('${i.discipline.id}', '${i.topic.id}')">Estudar</button>
                </div>
             `;
             recs.appendChild(div);
        });
        
        // Lista completa abaixo
        container.innerHTML = `<div class="card"><h3 class="mb-3">Fila de Prioridade Cognitiva</h3>
            <table style="width:100%">
                ${topics.map(t => `<tr><td style="padding:8px; border-bottom:1px solid #eee">${t.topic.text}</td><td class="text-right"><b>${t.score}</b></td></tr>`).join('')}
            </table>
        </div>`;
    },

    // ==================== DETALHES & ÁRVORE (HIERARQUIA) ====================

    openDetails(id) {
        this.temp.discId = id;
        this.renderModalContent(id);
        document.getElementById('discipline-modal').style.display = 'flex';
    },

    renderModalContent(id) {
        const d = this.data.disciplines.find(x => x.id === id);
        if(!d) return;

        const header = document.getElementById('disc-modal-header');
        header.innerHTML = `
            <div>
                <h2 style="color:${d.color}">${d.name}</h2>
                <div class="d-flex gap-2">
                    <input type="color" value="${d.color}" onchange="StudySystem.updateDiscProp('${d.id}', 'color', this.value)" style="width:40px;height:30px">
                    <input type="number" value="${d.weight}" onchange="StudySystem.updateDiscProp('${d.id}', 'weight', this.value)" style="width:60px" title="Peso">
                </div>
            </div>
            <button class="btn-icon" onclick="closeModal()"><i class="fas fa-times"></i></button>
        `;

        const body = document.getElementById('modal-body');
        body.innerHTML = `
            <div class="d-flex gap-2 mb-3">
                <input type="text" id="add-root-topic" placeholder="Novo Tópico Raiz..." onkeypress="if(event.key==='Enter') StudySystem.addTopic(null, '${d.id}')">
                <button class="btn btn-primary" onclick="StudySystem.addTopic(null, '${d.id}')"><i class="fas fa-plus"></i></button>
            </div>
            <div id="tree-container">
                ${this.renderTree(d.tasks, d.id)}
            </div>
        `;
    },

    // Renderização Recursiva com TODOS os botões
    renderTree(tasks, dId, level = 0) {
        if (!tasks || tasks.length === 0) return '';
        
        return tasks.map(t => {
            const s = t.stats || {total:0, correct:0};
            const acc = s.total > 0 ? Math.round((s.correct/s.total)*100) : 0;
            const inputIcon = s.inputType === 'active' ? '🔥' : (s.inputType === 'passive' ? '📖' : '⚪');
            
            return `
            <div class="tree-node tree-level-${level}">
                <div style="flex:1">
                    <span style="font-weight:500">${t.text}</span>
                    <div style="font-size:0.8rem; color:var(--text-muted)">
                        ${inputIcon} ${s.total} Qts | ${acc}% Acertos
                    </div>
                </div>
                <div style="display:flex; gap:5px;">
                    <button class="btn-icon" onclick="StudySystem.openStatsModal('${dId}', '${t.id}')" title="Registrar"><i class="fas fa-bullseye"></i></button>
                    <button class="btn-icon" onclick="StudySystem.addTopic('${t.id}', '${dId}')" title="Adicionar Filho"><i class="fas fa-plus"></i></button>
                    <button class="btn-icon" onclick="StudySystem.editTopic('${dId}', '${t.id}')" title="Editar Nome"><i class="fas fa-pen"></i></button>
                    <button class="btn-icon" style="color:var(--danger)" onclick="StudySystem.deleteTopic('${dId}', '${t.id}')" title="Excluir"><i class="fas fa-trash"></i></button>
                </div>
            </div>
            ${this.renderTree(t.subtasks, dId, level + 1)}
            `;
        }).join('');
    },

    // ==================== CRUD OPERAÇÕES ====================

    updateDiscProp(id, prop, val) {
        const d = this.data.disciplines.find(x => x.id === id);
        if(d) {
            d[prop] = prop === 'weight' ? parseInt(val) : val;
            this.saveData();
            this.renderInterface();
        }
    },

    deleteDiscipline(id) {
        if(confirm("Tem certeza que deseja EXCLUIR esta disciplina e todo o histórico?")) {
            this.data.disciplines = this.data.disciplines.filter(x => x.id !== id);
            this.saveData();
            this.renderInterface();
        }
    },

    addTopic(parentId, dId) {
        const d = this.data.disciplines.find(x => x.id === dId);
        let text = '';
        
        if (!parentId) {
            const input = document.getElementById('add-root-topic');
            text = input.value;
            if(!text) return;
            input.value = '';
        } else {
            text = prompt("Nome do Subtópico:");
            if(!text) return;
        }

        const newTopic = {
            id: 't_' + Date.now() + Math.random().toString(36).substr(2,4),
            text: text,
            subtasks: [],
            stats: { total:0, correct:0, inputType:'passive' }
        };

        if(!parentId) {
            if(!d.tasks) d.tasks = [];
            d.tasks.push(newTopic);
        } else {
            const findAndPush = (list) => {
                for(let item of list) {
                    if(item.id === parentId) {
                        if(!item.subtasks) item.subtasks = [];
                        item.subtasks.push(newTopic);
                        return true;
                    }
                    if(item.subtasks && findAndPush(item.subtasks)) return true;
                }
            };
            findAndPush(d.tasks);
        }
        
        this.saveData();
        this.renderModalContent(dId);
    },

    editTopic(dId, tId) {
        const d = this.data.disciplines.find(x => x.id === dId);
        const findAndEdit = (list) => {
            for(let item of list) {
                if(item.id === tId) {
                    const newName = prompt("Novo nome:", item.text);
                    if(newName) {
                        item.text = newName;
                        return true;
                    }
                }
                if(item.subtasks && findAndEdit(item.subtasks)) return true;
            }
        };
        if(findAndEdit(d.tasks)) {
            this.saveData();
            this.renderModalContent(dId);
        }
    },

    deleteTopic(dId, tId) {
        if(!confirm("Excluir tópico?")) return;
        const d = this.data.disciplines.find(x => x.id === dId);
        
        const removeRecursive = (list) => {
            const idx = list.findIndex(x => x.id === tId);
            if(idx > -1) {
                list.splice(idx, 1);
                return true;
            }
            for(let item of list) {
                if(item.subtasks && removeRecursive(item.subtasks)) return true;
            }
            return false;
        };
        
        if(removeRecursive(d.tasks)) {
            this.saveData();
            this.renderModalContent(dId);
        }
    },

    // ==================== STATS MODAL ====================

    openStatsModal(dId, tId) {
        this.temp.discId = dId; this.temp.topicId = tId;
        document.getElementById('stats-total').value = '';
        document.getElementById('stats-correct').value = '';
        document.getElementById('stats-modal').style.display = 'flex';
    },

    saveTopicStats() {
        const total = parseInt(document.getElementById('stats-total').value) || 0;
        const correct = parseInt(document.getElementById('stats-correct').value) || 0;
        const inputType = document.getElementById('stats-method').value;
        const errorType = document.getElementById('stats-error-type').value;

        const d = this.data.disciplines.find(x => x.id === this.temp.discId);
        const update = (list) => {
            for(let t of list) {
                if(t.id === this.temp.topicId) {
                    if(!t.stats) t.stats = { total:0, correct:0 };
                    t.stats.total = (t.stats.total||0) + total;
                    t.stats.correct = (t.stats.correct||0) + correct;
                    t.stats.inputType = inputType;
                    t.stats.lastErrorType = (total > correct) ? errorType : null;
                    t.lastStudyDate = new Date();
                    return true;
                }
                if(t.subtasks && update(t.subtasks)) return true;
            }
        };
        update(d.tasks);
        this.saveData();
        document.getElementById('stats-modal').style.display = 'none';
    },

    // ==================== SMART IMPORT (Backend Integrado) ====================
    
    openSmartImportModal() {
        document.getElementById('smart-import-modal').style.display = 'flex';
    },

    processSmartImport() {
        const name = document.getElementById('smart-name').value;
        const text = document.getElementById('smart-text').value;
        
        if(!name || !text) return alert("Preencha nome e texto");

        // Lógica de limpeza (Regex)
        let cleanText = text.replace(/\n/g, ';').replace(/\s+/g, ' ');
        const items = cleanText.split(/[,;•]|\.\s+/).map(t => t.trim())
            .filter(i => i.length > 3 && !i.match(/^\d+$/));
        
        const tasks = items.map(t => ({
            id: 't_'+Date.now()+Math.random(),
            text: t.replace(/^[\d\.\-\)\s]+/, '').charAt(0).toUpperCase() + t.slice(1),
            subtasks: [],
            stats: {total:0, correct:0, inputType:'passive'}
        }));

        this.data.disciplines.push({
            id: 'd_'+Date.now(),
            name: name,
            weight: parseInt(document.getElementById('smart-weight').value) || 10,
            color: document.getElementById('smart-color').value,
            archived: false,
            tasks: tasks
        });

        this.saveData();
        document.getElementById('smart-import-modal').style.display = 'none';
        alert("Importado com sucesso!");
    },

    // ==================== HELPERS ====================

    getStats(d) {
        let t=0, c=0;
        const scan = (list) => {
            if(list) list.forEach(x => {
                if(x.stats) { t += (x.stats.total||0); c += (x.stats.correct||0); }
                if(x.subtasks) scan(x.subtasks);
            });
        };
        scan(d.tasks);
        return { total: t, acc: t>0 ? Math.round((c/t)*100) : 0 };
    },

    getColor(acc) {
        if(acc < 50) return 'var(--danger)';
        if(acc < 80) return 'var(--warning)';
        return 'var(--success)';
    },

    toggleTheme() {
        this.data.userSettings.darkMode = !this.data.userSettings.darkMode;
        this.applyTheme();
        this.saveData();
    },

    applyTheme() {
        if(this.data.userSettings.darkMode) document.body.classList.add('dark-mode');
        else document.body.classList.remove('dark-mode');
    },

    toggleSleep(id) {
        const d = this.data.disciplines.find(x => x.id === id);
        d.archived = !d.archived;
        this.saveData();
        this.renderInterface();
    },

    openAddDisciplineModal() { document.getElementById('add-discipline-modal').style.display = 'flex'; },
    saveNewDiscipline() {
        const n = document.getElementById('new-disc-name').value;
        if(n) {
            this.data.disciplines.push({
                id: 'd_'+Date.now(),
                name: n,
                weight: parseInt(document.getElementById('new-disc-weight').value),
                color: document.getElementById('new-disc-color').value,
                tasks: [],
                archived: false
            });
            this.saveData();
            document.getElementById('add-discipline-modal').style.display = 'none';
        }
    },
    
    // Neuro Score Calc
    getAllTopicsWithScore() {
        let all = [];
        this.data.disciplines.forEach(d => {
            if(d.archived && !this.config.showArchived) return;
            const scan = (list) => {
                if(list) list.forEach(t => {
                    // Score = (Peso*2) + (100-Acc) + (Dias sem ver)
                    const acc = t.stats?.total > 0 ? (t.stats.correct/t.stats.total)*100 : 0;
                    const days = (new Date() - (new Date(t.lastStudyDate || 0))) / (1000*3600*24);
                    const score = (d.weight*2) + (100-acc) + (Math.min(days,30)*2);
                    all.push({topic:t, discipline:d, score: Math.round(score)});
                    if(t.subtasks) scan(t.subtasks);
                });
            };
            scan(d.tasks);
        });
        return all.sort((a,b) => b.score - a.score);
    },

    generateInterleavedSession() {
        const ranked = this.getAllTopicsWithScore();
        let session = [];
        let used = new Set();
        for(let item of ranked) {
            if(session.length >= 3) break;
            if(!used.has(item.discipline.id)) { session.push(item); used.add(item.discipline.id); }
        }
        if(session.length===0) return alert("Adicione mais disciplinas para intercalar.");
        
        const container = document.getElementById('main-content-area');
        container.innerHTML = `
            <div class="card" style="border:2px solid var(--ai-color)">
                <h2 class="text-center mb-4" style="color:var(--ai-color)">Sessão Intercalada</h2>
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(250px, 1fr)); gap:15px">
                    ${session.map(i => `
                        <div class="card text-center" style="border-top:5px solid ${i.discipline.color}">
                            <h4 style="color:${i.discipline.color}">${i.discipline.name}</h4>
                            <h3>${i.topic.text}</h3>
                            <button class="btn btn-primary w-100 mt-3" onclick="StudySystem.openStatsModal('${i.discipline.id}', '${i.topic.id}')">Iniciar</button>
                        </div>
                    `).join('')}
                </div>
                <button class="btn btn-outline mt-3 w-100" onclick="StudySystem.renderInterface()">Voltar</button>
            </div>
        `;
    },

    updateGlobalStats() {
        let t=0, c=0;
        this.data.disciplines.forEach(d => {
            const s = this.getStats(d);
            t += s.total; c += (s.total * (s.acc/100)); // Aproximação ponderada
        });
        const global = t>0 ? Math.round((c/t)*100) : 0;
        const el = document.getElementById('global-retention');
        if(el) {
            el.innerText = `${global}%`;
            el.style.color = this.getColor(global);
        }
    },

    exportData() {
        const a = document.createElement('a');
        a.href = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.data));
        a.download = "hugo_juiz_backup.json";
        a.click();
    },
    
    handleFileImport(input) {
        const reader = new FileReader();
        reader.onload = (e) => {
            this.data = JSON.parse(e.target.result);
            this.saveData();
            alert("Backup Restaurado!");
            this.renderInterface();
        };
        reader.readAsText(input.files[0]);
    }
};

document.addEventListener('DOMContentLoaded', () => StudySystem.init());