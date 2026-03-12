const JSON_PATH = 'https://gist.githubusercontent.com/dismal002/0b7468c8472ddb1f78071d305ff6b5ed/raw/c3eb3d73fa90e5cbfaddab6de3f3284ccf997053/gistfile1.txt';
    let agendaData = [];
    let activeDays = [];
    let activeDayIndex = 0;
    let starredSessions = JSON.parse(localStorage.getItem('wicys_starred')) || [];

    function formatTime12h(dateTimeStr) {
        const date = new Date(dateTimeStr.replace(' ', 'T'));
        return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
    }

    async function loadData() {
        try {
            const response = await fetch(JSON_PATH);
            const json = await response.json();
            const now = new Date();
            
            agendaData = [];
            activeDays = [];

            json.data.agenda.forEach(dayObj => {
                let latestSessionEnd = new Date(0);
                let daySessions = [];

                dayObj.time_ranges.forEach(range => {
                    range[1].forEach(slot => {
                        slot.forEach(item => {
                            if (item.sessions) {
                                item.sessions.forEach(s => {
                                    const sEnd = new Date(s.calendar_etime.replace(' ', 'T'));
                                    if (sEnd > latestSessionEnd) latestSessionEnd = sEnd;
                                    s.displayDate = dayObj.date;
                                    daySessions.push(s);
                                });
                            }
                        });
                    });
                });

                if (latestSessionEnd > now) {
                    activeDays.push(dayObj.date);
                    agendaData = agendaData.concat(daySessions);
                }
            });

            setupTabs();
            renderSessions();
            document.getElementById('status-msg').innerText = `Synced: ${new Date().toLocaleTimeString()}`;
        } catch (e) {
            document.getElementById('status-msg').innerText = "Sync Error.";
        }
    }

    function setupTabs() {
        const tabs = document.getElementById('day-tabs');
        tabs.innerHTML = '';
        activeDays.forEach((day, index) => {
            const tab = document.createElement('md-primary-tab');
            tab.innerText = day.split(',')[0];
            tab.active = (index === activeDayIndex);
            tab.addEventListener('click', () => { 
                activeDayIndex = index; 
                renderSessions(); 
                updateFooterButtons(); 
            });
            tabs.appendChild(tab);
        });
        updateFooterButtons();
    }

    function changeDay(delta) {
        const newIndex = activeDayIndex + delta;
        if (newIndex >= 0 && newIndex < activeDays.length) {
            activeDayIndex = newIndex;
            const tabElements = document.querySelectorAll('md-primary-tab');
            tabElements.forEach((t, i) => t.active = (i === activeDayIndex));
            renderSessions();
            updateFooterButtons();
            window.scrollTo(0,0);
        }
    }

    function updateFooterButtons() {
        document.getElementById('prev-btn').disabled = (activeDayIndex === 0);
        document.getElementById('next-btn').disabled = (activeDayIndex === activeDays.length - 1);
    }

    function toggleStar(id) {
        starredSessions = starredSessions.includes(id) ? starredSessions.filter(s => s !== id) : [...starredSessions, id];
        localStorage.setItem('wicys_starred', JSON.stringify(starredSessions));
        renderSessions();
    }

    function renderSessions() {
        const list = document.getElementById('session-list');
        list.innerHTML = '';
        const now = new Date();
        const currentTargetDay = activeDays[activeDayIndex];

        const filtered = agendaData.filter(s => {
            const endTime = new Date(s.calendar_etime.replace(' ', 'T'));
            return s.displayDate === currentTargetDay && endTime > now;
        });

        if (filtered.length === 0) {
            list.innerHTML = `<p style="text-align:center; color:#999; margin-top:40px;">Day completed.</p>`;
            return;
        }

        filtered.forEach(session => {
            const isStarred = starredSessions.includes(session.id);
            const card = document.createElement('div');
            card.className = 'session-card';
            
            card.innerHTML = `
                <div class="session-header">
                    <div class="session-title">${session.name}</div>
                    <md-icon-button onclick="toggleStar(${session.id})">
                        <span class="material-symbols-outlined" style="color:${isStarred ? '#ffd700' : '#ccc'}">
                            ${isStarred ? 'star' : 'star_outline'}
                        </span>
                    </md-icon-button>
                </div>
                <div class="session-meta">
                    <div class="meta-row">
                        <span class="material-symbols-outlined" style="font-size:18px">schedule</span>
                        ${formatTime12h(session.calendar_stime)} - ${formatTime12h(session.calendar_etime)}
                    </div>
                    <div class="meta-row">
                        <span class="material-symbols-outlined" style="font-size:18px">location_on</span>
                        ${session.place || 'TBD'}
                    </div>
                </div>
                <div class="countdown" id="count-${session.id}"></div>
                ${session.desc ? `<details><summary><span class="material-symbols-outlined">expand_more</span> Details</summary><div style="font-size:0.9rem; margin-top:8px;">${session.desc}</div></details>` : ''}
                <div style="margin-top:12px;">
                    <md-filled-button onclick="window.open('${getCalendarUrl(session)}', '_blank')">
                        <span slot="icon" class="material-symbols-outlined">calendar_add_on</span>
                        Add to Calendar
                    </md-filled-button>
                </div>
            `;
            list.appendChild(card);
        });
        updateCountdowns();
    }

    function getCalendarUrl(s) {
        const start = s.calendar_stime.replace(' ', 'T').replace(/[-:]/g, '');
        const end = s.calendar_etime.replace(' ', 'T').replace(/[-:]/g, '');
        return `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(s.name)}&dates=${start}/${end}&location=${encodeURIComponent(s.place)}`;
    }

    function updateCountdowns() {
        const now = new Date();
        agendaData.forEach(s => {
            const el = document.getElementById(`count-${s.id}`);
            if (!el) return;
            const startTime = new Date(s.calendar_stime.replace(' ', 'T'));
            const diff = startTime - now;

            if (diff <= 0) {
                el.innerText = "● HAPPENING NOW";
                el.style.color = "#1a73e8";
                el.style.background = "#e8f0fe";
            } else {
                const d = Math.floor(diff / 86400000);
                const h = Math.floor((diff % 86400000) / 3600000);
                const m = Math.floor((diff % 3600000) / 60000);
                const sRem = Math.floor((diff % 60000) / 1000);
                
                let timeStr = "Starts in: ";
                if (d > 0) timeStr += `${d}D `;
                timeStr += `${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m ${sRem.toString().padStart(2, '0')}s`;
                
                el.innerText = timeStr;
                el.style.color = "#d93025";
                el.style.background = "#fff1f0";
            }
        });
    }

    // Update every second for the new countdown format
    setInterval(updateCountdowns, 1000);
    loadData();
