/**
 * ====================================================================
 * HUGO JUIZ 5.1 - EISENHOWER & HIERARQUIA
 * Features: Matriz Estratégica, Tabela Hierárquica, Toggle Sleep
 * ====================================================================
 */

const StudySystem = {
    config: {
        version: '5.1',
        storageKey: 'hugo_juiz_db_v5',
        viewMode: 'cards', // cards, ranking, plan, matrix
        showArchived: false
    },

    data: {
        disciplines: [],
        userSettings: { darkMode: false },
        stats: { streak: 0, lastLogin: null }
    },

    temp: { discId: null, topicId: null },

    async init() {
        console.log(`🚀 HUGO JUIZ ${this.config.version} Iniciado`);
        try {
            this.setupGlobalAccess();
            await this.loadData();
            this.setupEventListeners();
            this.updateGlobalStats();
            this.renderInterface();
        } catch (e) {
            console.error(e);
            alert('Erro ao iniciar.');
        }
    },

    setupGlobalAccess() {
        window.StudySystem = this;
        window.toggleDarkMode = () => this.toggleTheme();
        window.closeModal = () => document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
    },

    setupEventListeners() {
        const search = document.getElementById('search-input');
        if(search) search.addEventListener('input', (e) => this.renderInterface(e.target.value));
        
        // Sync checkbox visual state
        const toggle = document.getElementById('show-archived-toggle');
        if(toggle) toggle.checked = this.config.showArchived;
    },

    // ==================== DADOS ====================
    async loadData() {
        const raw = localStorage.getItem(this.config.storageKey);
        if (raw) this.data = JSON.parse(raw);
        else { this.data.disciplines = this.getInitialData(); this.saveData(); }
        if (this.data.userSettings.darkMode) document.body.classList.add('dark-mode');
    },

    saveData() {
        localStorage.setItem(this.config.storageKey, JSON.stringify(this.data));
        this.updateGlobalStats();
        this.renderInterface();
    },

    // ==================== VISUALIZAÇÃO ====================
    
    toggleShowArchived(checked) {
        this.config.showArchived = checked;
        this.renderInterface();
    },

    switchView(mode) {
        this.config.viewMode = mode;
        document.querySelectorAll('.btn-menu').forEach(b => b.classList.remove('active'));
        const btn = document.getElementById(`btn-view-${mode}`);
        if(btn) btn.classList.add('active');
        this.renderInterface();
    },

    renderInterface(filter = '') {
        const container = document.getElementById('main-content-area');
        if(!container) return;
        container.innerHTML = '';
        container.className = ''; // Reset classes

        // Filtra disciplinas (Arquivadas ou não)
        let list = this.data.disciplines.filter(d => 
            (this.config.showArchived || !d.archived) && 
            d.name.toLowerCase().includes(filter.toLowerCase())
        );

        switch (this.config.viewMode) {
            case 'cards':
                container.className = 'disciplines-grid';
                this.renderCards(container, list);
                break;
            case 'ranking':
                this.renderHierarchicalRanking(container, list);
                break;
            case 'plan':
                this.renderStudyPlan(container, list);
                break;
            case 'matrix':
                this.renderEisenhowerMatrix(container, list);
                break;
            default:
                this.renderCards(container, list);
        }
    },

    // --- 1. MODO CARDS ---
    renderCards(container, list) {
        list.sort((a, b) => b.weight - a.weight); // Peso decrescente
        
        list.forEach(d => {
            const stats = this.calculateStats(d);
            const div = document.createElement('div');
            div.className = `card discipline-card ${d.archived ? 'sleeping' : ''} ${d.weight >= 15 ? 'gourmet' : ''}`;
            div.style.borderLeftColor = d.color;
            
            div.innerHTML = `
                <div class="discipline-header">
                    <div>
                        <h3>
                            ${d.archived ? '<i class="fas fa-bed text-muted mr-2"></i>' : ''}
                            <span style="color:${d.color}">${d.name}</span>
                        </h3>
                        <div class="d-flex">
                            <span class="weight-badge" style="background:${d.color}20; color:${d.color}">Peso ${d.weight}</span>
                        </div>
                    </div>
                </div>
                <div class="mini-dashboard">
                    <div class="dash-item">
                        <span class="dash-value" style="color:${this.getColor(stats.accuracy)}">${stats.accuracy}%</span>
                        <span class="dash-label">Acertos</span>
                    </div>
                    <div class="dash-item">
                        <span class="dash-value">${stats.totalQ}</span>
                        <span class="dash-label">Questões</span>
                    </div>
                </div>
                <div class="discipline-actions">
                    <button class="btn btn-primary btn-small" onclick="StudySystem.openDetails('${d.id}')">Abrir</button>
                    <button class="btn btn-secondary btn-small" onclick="StudySystem.toggleSleep('${d.id}')" title="${d.archived ? 'Acordar' : 'Adormecer'}">
                        <i class="fas ${d.archived ? 'fa-sun' : 'fa-bed'}"></i>
                    </button>
                </div>
            `;
            container.appendChild(div);
        });
    },

    // --- 2. RANKING HIERÁRQUICO (Pai > Filhos > Netos) ---
    renderHierarchicalRanking(container, list) {
        // Ordena disciplinas por aproveitamento (Melhor -> Pior, como solicitado)
        list.sort((a,b) => (this.calculateStats(b).accuracy) - (this.calculateStats(a).accuracy));

        let html = `
            <div class="card" style="padding:0; overflow:hidden;">
            <table class="ranking-table" style="width:100%">
                <thead style="background:var(--bg-input); font-size:0.9rem;">
                    <tr>
                        <th style="padding:1rem; text-align:left">Hierarquia de Conteúdo</th>
                        <th style="width:100px; text-align:center">Questões</th>
                        <th style="width:120px; text-align:center">Aproveitamento</th>
                        <th style="width:100px; text-align:center">Ações</th>
                    </tr>
                </thead>
                <tbody>
        `;

        list.forEach(d => {
            const stats = this.calculateStats(d);
            // Linha Pai (Disciplina)
            html += `
                <tr class="hierarchy-row level-0 ${d.archived ? 'sleeping' : ''}">
                    <td style="padding:1rem; color:${d.color}">
                        <i class="fas fa-folder"></i> ${d.name}
                        ${d.archived ? '<small>(Adormecida)</small>' : ''}
                    </td>
                    <td class="text-center">${stats.totalQ}</td>
                    <td class="text-center" style="font-weight:bold; color:${this.getColor(stats.accuracy)}">${stats.accuracy}%</td>
                    <td class="text-center">
                        <button class="btn-icon" onclick="StudySystem.openDetails('${d.id}')"><i class="fas fa-edit"></i></button>
                    </td>
                </tr>
            `;

            // Flatten items para ordenação (Melhor Dominado -> Pior Dominado)
            if(d.tasks && d.tasks.length > 0) {
                // Ordenar filhos por acurácia decrescente (Melhor -> Pior)
                const sortedTasks = [...d.tasks].sort((a,b) => this.getItemAccuracy(b) - this.getItemAccuracy(a));
                
                sortedTasks.forEach(task => {
                    html += this.renderRankingRow(task, 1, d.id);
                    
                    if(task.subtasks && task.subtasks.length > 0) {
                        const sortedSubs = [...task.subtasks].sort((a,b) => this.getItemAccuracy(b) - this.getItemAccuracy(a));
                        sortedSubs.forEach(sub => {
                            html += this.renderRankingRow(sub, 2, d.id, task.id);
                        });
                    }
                });
            }
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;
    },

    renderRankingRow(item, level, discId, parentId = null) {
        const stats = item.stats || {total:0, correct:0};
        const acc = stats.total > 0 ? Math.round((stats.correct/stats.total)*100) : 0;
        
        return `
            <tr class="hierarchy-row level-${level}">
                <td style="padding:0.75rem 1rem;">
                    <div class="cell-indent">
                        <div class="indent-spacer-${level}"></div>
                        <span>${item.text || item.name}</span>
                    </div>
                </td>
                <td class="text-center text-muted" style="font-size:0.9rem">${stats.total}</td>
                <td class="text-center">
                    <span class="badge" style="background:${this.getColor(acc)}20; color:${this.getColor(acc)}">
                        ${acc}%
                    </span>
                </td>
                <td class="text-center">
                    <button class="btn-icon" onclick="StudySystem.openStatsModal('${discId}', '${item.id}')">
                        <i class="fas fa-bullseye"></i>
                    </button>
                </td>
            </tr>
        `;
    },

    // --- 3. PLANO DE ATAQUE (Apenas o que precisa estudar) ---
    renderStudyPlan(container, list) {
        let itemsToStudy = [];

        list.forEach(d => {
            const traverse = (items) => {
                if(!items) return;
                items.forEach(item => {
                    const stats = item.stats || {total:0, correct:0};
                    const acc = stats.total > 0 ? Math.round((stats.correct/stats.total)*100) : 0;
                    
                    // Critério: Nunca estudado OU Acurácia < 60%
                    if (stats.total === 0 || acc < 60) {
                        itemsToStudy.push({
                            discName: d.name,
                            discColor: d.color,
                            itemName: item.text || item.name,
                            acc: acc,
                            total: stats.total,
                            weight: d.weight,
                            itemId: item.id,
                            discId: d.id
                        });
                    }
                    if(item.subtasks) traverse(item.subtasks);
                });
            };
            traverse(d.tasks);
        });

        // Ordenar por: Peso da disciplina DESC -> Acurácia ASC (Pior primeiro)
        itemsToStudy.sort((a,b) => {
            if(b.weight !== a.weight) return b.weight - a.weight;
            return a.acc - b.acc;
        });

        let html = `
            <h3><i class="fas fa-crosshairs text-danger"></i> Tópicos Críticos & Pendentes</h3>
            <p class="text-muted mb-3">Prioridade baseada em Peso x Desempenho Ruim.</p>
            <div style="display:flex; flex-direction:column; gap:10px;">
        `;

        if(itemsToStudy.length === 0) {
            html += '<div class="card text-center"><h4>🎉 Nada pendente! Você é uma máquina!</h4></div>';
        } else {
            itemsToStudy.forEach(i => {
                html += `
                    <div class="attack-row" style="border-left-color:${i.total===0 ? 'var(--text-muted)' : 'var(--danger)'}">
                        <div>
                            <small style="color:${i.discColor}; font-weight:bold; text-transform:uppercase;">${i.discName} (Peso ${i.weight})</small>
                            <div style="font-size:1.1rem; font-weight:600;">${i.itemName}</div>
                        </div>
                        <div class="text-right">
                            <div style="font-weight:bold; font-size:1.2rem; color:${i.total===0 ? '#888' : 'var(--danger)'}">
                                ${i.total === 0 ? 'Novo' : i.acc + '%'}
                            </div>
                            <button class="btn btn-primary btn-small mt-2" onclick="StudySystem.openStatsModal('${i.discId}', '${i.itemId}')">
                                Registrar
                            </button>
                        </div>
                    </div>
                `;
            });
        }
        
        html += '</div>';
        container.innerHTML = html;
    },

    // --- 4. MATRIZ DE EISENHOWER (Algoritmo Estratégico) ---
    renderEisenhowerMatrix(container, list) {
        const matrix = { q1: [], q2: [], q3: [], q4: [] };

        list.forEach(d => {
            const stats = this.calculateStats(d); // Usa stats da disciplina inteira
            const isImportant = d.weight >= 10;
            const isUrgent = stats.accuracy < 60 || stats.totalQ === 0;

            const item = { ...d, acc: stats.accuracy };

            if (isImportant && isUrgent) matrix.q1.push(item);      // Crise
            else if (isImportant && !isUrgent) matrix.q2.push(item); // Estratégia
            else if (!isImportant && isUrgent) matrix.q3.push(item); // Ruído
            else matrix.q4.push(item);                               // Manutenção
        });

        const renderItem = (item) => `
            <div class="matrix-item" style="border-left-color:${item.color}">
                <span style="font-weight:600">${item.name}</span>
                <span class="badge" style="background:${this.getColor(item.acc)}20; color:${this.getColor(item.acc)}">${item.acc}%</span>
            </div>
        `;

        container.innerHTML = `
            <div class="matrix-grid">
                <div class="quadrant q1-crisis">
                    <div class="quadrant-header">
                        <span>🔥 Faça Agora (Q1)</span>
                        <small>Alto Peso • Baixo Desempenho</small>
                    </div>
                    ${matrix.q1.map(renderItem).join('')}
                </div>
                <div class="quadrant q2-strategy">
                    <div class="quadrant-header">
                        <span>📅 Planeje (Q2)</span>
                        <small>Alto Peso • Bom Desempenho</small>
                    </div>
                    ${matrix.q2.map(renderItem).join('')}
                </div>
                <div class="quadrant q3-noise">
                    <div class="quadrant-header">
                        <span>⚡ Rápido / Delegue (Q3)</span>
                        <small>Baixo Peso • Baixo Desempenho</small>
                    </div>
                    ${matrix.q3.map(renderItem).join('')}
                </div>
                <div class="quadrant q4-maintain">
                    <div class="quadrant-header">
                        <span>☕ Manutenção (Q4)</span>
                        <small>Baixo Peso • Bom Desempenho</small>
                    </div>
                    ${matrix.q4.map(renderItem).join('')}
                </div>
            </div>
        `;
    },

    // ==================== LÓGICA DE NEGÓCIO ====================

    // Adormecer/Acordar
    toggleSleep(id) {
        const d = this.data.disciplines.find(x => x.id === id);
        if(d) {
            d.archived = !d.archived;
            this.saveData();
            // Feedback visual se estiver ocultando
            if(d.archived && !this.config.showArchived) {
                alert('Disciplina adormecida! Ative "Mostrar Adormecidas" na sidebar para vê-la.');
            }
        }
    },

    // Stats
    calculateStats(d) {
        let totalQ = 0, totalC = 0;
        const traverse = (tasks) => {
            if(!tasks) return;
            tasks.forEach(t => {
                if(t.stats) { totalQ += (parseInt(t.stats.total)||0); totalC += (parseInt(t.stats.correct)||0); }
                if(t.subtasks) traverse(t.subtasks);
            });
        };
        traverse(d.tasks);
        const accuracy = totalQ > 0 ? Math.round((totalC / totalQ) * 100) : 0;
        return { totalQ, totalC, accuracy };
    },

    getItemAccuracy(item) {
        const s = item.stats || {total:0, correct:0};
        return s.total > 0 ? (s.correct/s.total)*100 : 0;
    },

    updateGlobalStats() {
        let q = 0, c = 0;
        this.data.disciplines.forEach(d => {
            if(!d.archived) {
                const s = this.calculateStats(d);
                q += s.totalQ; c += s.totalC;
            }
        });
        const avg = q > 0 ? Math.round((c/q)*100) : 0;
        document.getElementById('global-average').innerText = `${avg}%`;
        
        const el = document.getElementById('global-average');
        el.style.color = this.getColor(avg);
    },

    // Helpers
    getColor(acc) {
        if(acc < 50) return 'var(--danger)';
        if(acc < 80) return 'var(--warning)';
        return 'var(--success)';
    },

    // Modais e CRUD (Mantidos base, adicionados na resposta anterior)
    openDetails(id) { this.temp.discId = id; this.renderModalContent(id); document.getElementById('discipline-modal').style.display = 'flex'; },
    
    renderModalContent(id) {
        const d = this.data.disciplines.find(x => x.id === id);
        document.getElementById('disc-modal-header').innerHTML = `
            <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
                <h3 style="color:${d.color}">${d.name}</h3>
                <div style="display:flex; gap:10px">
                    <button class="btn-icon" onclick="StudySystem.addSubTopic(null, '${d.id}')" title="Novo Tópico Raiz"><i class="fas fa-plus"></i></button>
                    <button class="btn-icon" onclick="closeModal()"><i class="fas fa-times"></i></button>
                </div>
            </div>`;
        document.getElementById('modal-body').innerHTML = `<div class="todo-list-container">${this.renderTopicsRecursive(d.tasks, d.id)}</div>`;
    },

    renderTopicsRecursive(tasks, discId, level=0) {
        if(!tasks || tasks.length === 0) return '';
        let html = '';
        tasks.forEach(t => {
            const padding = level * 20;
            html += `
            <div class="topic-row" style="margin-left:${padding}px; border-left:3px solid ${level===0?'var(--primary)':'#ccc'}">
                <div class="topic-info">
                    <span class="topic-name">${t.text || t.name}</span>
                    <small class="text-muted">Questões: ${t.stats?.total||0}</small>
                </div>
                <div class="topic-actions">
                    <button class="btn-action" onclick="StudySystem.openStatsModal('${discId}', '${t.id}')"><i class="fas fa-bullseye"></i></button>
                    <button class="btn-action" onclick="StudySystem.addSubTopic('${t.id}', '${discId}')"><i class="fas fa-level-down-alt"></i></button>
                    <button class="btn-action" style="color:red" onclick="StudySystem.deleteTopic('${discId}', '${t.id}')"><i class="fas fa-trash"></i></button>
                </div>
            </div>`;
            if(t.subtasks) html += this.renderTopicsRecursive(t.subtasks, discId, level+1);
        });
        return html;
    },

    // CRUD Básicos
    addSubTopic(parentId, discId) {
        const text = prompt("Nome do Tópico:");
        if(!text) return;
        const d = this.data.disciplines.find(x => x.id === discId);
        
        if(!parentId) { // Raiz
            if(!d.tasks) d.tasks = [];
            d.tasks.push({ id: 't_'+Date.now(), text, subtasks:[], stats:{total:0,correct:0}});
        } else { // Filho/Neto
            const findAdd = (list) => {
                for(let item of list) {
                    if(item.id === parentId) {
                        if(!item.subtasks) item.subtasks = [];
                        item.subtasks.push({ id: 's_'+Date.now(), text, subtasks:[], stats:{total:0,correct:0}});
                        return true;
                    }
                    if(item.subtasks && findAdd(item.subtasks)) return true;
                }
            };
            findAdd(d.tasks);
        }
        this.saveData();
        this.renderModalContent(discId);
    },
    
    deleteTopic(dId, tId) {
        if(!confirm("Excluir?")) return;
        const d = this.data.disciplines.find(x => x.id === dId);
        const remove = (list) => {
            const idx = list.findIndex(x => x.id === tId);
            if(idx > -1) { list.splice(idx,1); return true; }
            for(let i of list) if(i.subtasks && remove(i.subtasks)) return true;
        };
        remove(d.tasks);
        this.saveData();
        this.renderModalContent(dId);
    },

    openStatsModal(dId, tId) {
        this.temp.discId = dId; this.temp.topicId = tId;
        document.getElementById('stats-modal').style.display='flex';
    },

    saveTopicStats() {
        const total = parseInt(document.getElementById('stats-total').value)||0;
        const correct = parseInt(document.getElementById('stats-correct').value)||0;
        const d = this.data.disciplines.find(x => x.id === this.temp.discId);
        
        const update = (list) => {
            for(let t of list) {
                if(t.id === this.temp.topicId) { t.stats = {total, correct}; return true; }
                if(t.subtasks && update(t.subtasks)) return true;
            }
        };
        update(d.tasks);
        this.saveData();
        document.getElementById('stats-modal').style.display='none';
    },

    // Export/Import
    exportData() {
        const a = document.createElement('a');
        a.href = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.data));
        a.download = `hugo_juiz_backup_${new Date().toISOString().slice(0,10)}.json`;
        a.click();
    },
    handleFileImport(input) {
        const reader = new FileReader();
        reader.onload = (e) => {
            this.data = JSON.parse(e.target.result);
            this.saveData();
            alert("Backup restaurado!");
        };
        reader.readAsText(input.files[0]);
    },
    openAddDisciplineModal() { document.getElementById('add-discipline-modal').style.display='flex'; },
    saveNewDiscipline() {
        const name = document.getElementById('new-disc-name').value;
        const w = document.getElementById('new-disc-weight').value;
        const c = document.getElementById('new-disc-color').value;
        this.data.disciplines.push({ id:'d_'+Date.now(), name, weight:parseInt(w), color:c, tasks:[], archived:false});
        this.saveData();
        document.getElementById('add-discipline-modal').style.display='none';
    },
    getInitialData() { return [] }
};

document.addEventListener('DOMContentLoaded', () => StudySystem.init());