/**
 * Hello Chatbot - Vanilla JavaScript Implementation
 * A lightweight, efficient chatbot without React dependencies
 */

(function() {
    'use strict';
    
    /**
     * ChatbotWidget Class - Main controller
     */
    class ChatbotWidget {
        constructor(config) {
            this.config = config;
            this.state = {
                isOpen: false,
                isLoading: false,
                messages: [],
                currentSession: null,
                sessions: [],
                showHistory: false,
                showTooltip: true
            };
            
            this.elements = {};
            this.sessionManager = new SessionManager();
            
            this.init();
        }
        
        init() {
            this.sessionManager.initialize();
            this.loadSession();
            this.render();
            this.attachEventListeners();
            this.showWelcomeMessage();
        }
        
        loadSession() {
            const session = this.sessionManager.getActiveSession();
            this.state.currentSession = session;
            this.state.sessions = this.sessionManager.getAllSessions();
            
            if (session && session.messages && session.messages.length > 0) {
                this.state.messages = session.messages;
                this.state.showTooltip = false;
            }
        }
        
        showWelcomeMessage() {
            if (this.state.messages.length === 0) {
                const welcomeMsg = {
                    id: 'welcome-' + Date.now(),
                    role: 'assistant',
                    content: this.config.welcomeMessage || 'Welcome! How can I help you today?',
                    timestamp: this.getCurrentTime()
                };
                this.addMessage(welcomeMsg);
            }
        }
        
        render() {
            const container = document.getElementById('hello-chatbot-widget');
            if (!container) return;
            
            // Set position class
            const position = container.dataset.position || 'bottom-right';
            container.className = `chatbot-widget chatbot-${position}`;
            
            // Build the widget HTML
            container.innerHTML = this.buildHTML();
            
            // Cache element references
            this.cacheElements();
        }
        
        buildHTML() {
            return `
                <!-- Chat Button -->
                <button id="chatbot-button" class="chatbot-button" aria-label="Open chat">
                    ${this.getButtonIcon()}
                </button>
                
                <!-- Tooltip -->
                <div id="chatbot-tooltip" class="chatbot-tooltip ${this.state.showTooltip ? 'show' : ''}">
                    <div class="chatbot-tooltip-header">
                        <h4>concentrix Bot</h4>
                        <button class="chatbot-tooltip-close" aria-label="Close">×</button>
                    </div>
                    <div class="chatbot-tooltip-content">
                        <p>👋 Hi there! Want to chat about Concentrix services?</p>
                    </div>
                </div>
                
                <!-- Chat Window -->
                <div id="chatbot-window" class="chatbot-window ${this.state.isOpen ? 'open' : ''}">
                    <!-- Header -->
                    <div class="chatbot-header">
                        <div class="chatbot-title">
                            <h3>concentrix Bot</h3>
                            ${this.state.currentSession?.title !== 'New Chat' ? 
                                `<div class="chatbot-session-title">${this.state.currentSession.title}</div>` : ''}
                        </div>
                        <div class="chatbot-controls">
                            <button id="chatbot-history-btn" class="chatbot-control-btn" aria-label="History">
                                ${this.getHistoryIcon()}
                            </button>
                            <button id="chatbot-refresh-btn" class="chatbot-control-btn" aria-label="New chat">
                                ${this.getRefreshIcon()}
                            </button>
                            <button id="chatbot-minimize-btn" class="chatbot-control-btn" aria-label="Minimize">
                                ${this.getMinimizeIcon()}
                            </button>
                        </div>
                    </div>
                    
                    <!-- Messages Area -->
                    <div id="chatbot-messages" class="chatbot-messages">
                        ${this.buildMessagesHTML()}
                    </div>
                    
                    <!-- Input Area -->
                    <div class="chatbot-input-area">
                        <form id="chatbot-form" class="chatbot-form">
                            <textarea 
                                id="chatbot-input" 
                                class="chatbot-input" 
                                placeholder="${this.config.strings.typeMessage}"
                                rows="1"
                            ></textarea>
                            <button type="submit" class="chatbot-send-btn" aria-label="Send">
                                ${this.getSendIcon()}
                            </button>
                        </form>
                    </div>
                </div>
                
                <!-- History Sidebar -->
                <div id="chatbot-history" class="chatbot-history ${this.state.showHistory ? 'open' : ''}">
                    <div class="chatbot-history-header">
                        <h3>Chat History</h3>
                        <button id="chatbot-history-close" class="chatbot-history-close">×</button>
                    </div>
                    <button id="chatbot-new-chat" class="chatbot-new-chat-btn">
                        + ${this.config.strings.newChat}
                    </button>
                    <div class="chatbot-history-list">
                        ${this.buildHistoryHTML()}
                    </div>
                </div>
            `;
        }
        
        buildMessagesHTML() {
            if (this.state.messages.length === 0) {
                return '';
            }
            
            return this.state.messages.map(msg => this.buildMessageHTML(msg)).join('') +
                   (this.state.isLoading ? this.buildThinkingHTML() : '');
        }
        
        buildMessageHTML(message) {
            const isUser = message.role === 'user';
            const avatar = isUser ? this.getUserIcon() : this.getBotIcon();
            
            let html = `
                <div class="chatbot-message chatbot-message-${message.role}">
                    <div class="chatbot-message-avatar">${avatar}</div>
                    <div class="chatbot-message-content">
                        <div class="chatbot-message-time">${message.timestamp}</div>
                        <div class="chatbot-message-text">${this.formatMessage(message.content)}</div>
            `;
            
            // Add references if present
            if (message.references && message.references.length > 0) {
                html += this.buildReferencesHTML(message.references);
            }
            
            // Add action buttons if present
            if (message.actions && message.actions.length > 0) {
                html += this.buildActionsHTML(message.actions);
            }
            
            html += `
                    </div>
                </div>
            `;
            
            return html;
        }
        
        buildReferencesHTML(references) {
            return `
                <div class="chatbot-references">
                    <div class="chatbot-references-header">
                        <span>${this.config.strings.references} (${references.length})</span>
                        <span class="chatbot-references-toggle">▼</span>
                    </div>
                    <div class="chatbot-references-list">
                        ${references.map(ref => `
                            <div class="chatbot-reference-item">
                                <a href="${ref.url}" target="_blank" rel="noopener">
                                    ${ref.title}
                                </a>
                                <div class="chatbot-reference-description">
                                    ${ref.description}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        
        buildActionsHTML(actions) {
            return `
                <div class="chatbot-actions">
                    ${actions.map(action => `
                        <button class="chatbot-action-btn" data-action="${action}">
                            ${action}
                        </button>
                    `).join('')}
                </div>
            `;
        }
        
        buildThinkingHTML() {
            return `
                <div class="chatbot-message chatbot-message-assistant chatbot-thinking">
                    <div class="chatbot-message-avatar">${this.getBotIcon()}</div>
                    <div class="chatbot-message-content">
                        <div class="chatbot-message-time">${this.getCurrentTime()}</div>
                        <div class="chatbot-thinking-dots">
                            <span>${this.config.strings.thinking}</span>
                            <span class="dot">.</span>
                            <span class="dot">.</span>
                            <span class="dot">.</span>
                        </div>
                    </div>
                </div>
            `;
        }
        
        buildHistoryHTML() {
            if (this.state.sessions.length === 0) {
                return '<div class="chatbot-history-empty">No chat history yet</div>';
            }
            
            return this.state.sessions.map(session => `
                <div class="chatbot-history-item ${session.id === this.state.currentSession?.id ? 'active' : ''}" 
                     data-session-id="${session.id}">
                    <div class="chatbot-history-item-title">${session.title}</div>
                    <div class="chatbot-history-item-date">${this.formatDate(session.updated)}</div>
                </div>
            `).join('');
        }
        
        cacheElements() {
            this.elements = {
                button: document.getElementById('chatbot-button'),
                window: document.getElementById('chatbot-window'),
                messages: document.getElementById('chatbot-messages'),
                input: document.getElementById('chatbot-input'),
                form: document.getElementById('chatbot-form'),
                tooltip: document.getElementById('chatbot-tooltip'),
                history: document.getElementById('chatbot-history'),
                historyBtn: document.getElementById('chatbot-history-btn'),
                refreshBtn: document.getElementById('chatbot-refresh-btn'),
                minimizeBtn: document.getElementById('chatbot-minimize-btn'),
                newChatBtn: document.getElementById('chatbot-new-chat'),
                historyClose: document.getElementById('chatbot-history-close')
            };
        }
        
        attachEventListeners() {
            // Chat button
            this.elements.button?.addEventListener('click', () => this.toggleChat());
            
            // Window controls
            this.elements.minimizeBtn?.addEventListener('click', () => this.closeChat());
            this.elements.historyBtn?.addEventListener('click', () => this.toggleHistory());
            this.elements.refreshBtn?.addEventListener('click', () => this.startNewChat());
            
            // Form submission
            this.elements.form?.addEventListener('submit', (e) => this.handleSubmit(e));
            
            // Input auto-resize
            this.elements.input?.addEventListener('input', () => this.autoResizeInput());
            
            // Enter key handling
            this.elements.input?.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.handleSubmit(e);
                }
            });
            
            // History controls
            this.elements.newChatBtn?.addEventListener('click', () => this.startNewChat());
            this.elements.historyClose?.addEventListener('click', () => this.toggleHistory());
            
            // Tooltip close
            document.querySelector('.chatbot-tooltip-close')?.addEventListener('click', () => {
                this.state.showTooltip = false;
                this.elements.tooltip.classList.remove('show');
            });
            
            // History item clicks
            document.addEventListener('click', (e) => {
                if (e.target.closest('.chatbot-history-item')) {
                    const sessionId = e.target.closest('.chatbot-history-item').dataset.sessionId;
                    this.switchSession(sessionId);
                }
                
                // Action button clicks
                if (e.target.classList.contains('chatbot-action-btn')) {
                    const action = e.target.dataset.action;
                    this.sendMessage(action);
                }
                
                // References toggle
                if (e.target.closest('.chatbot-references-header')) {
                    const refs = e.target.closest('.chatbot-references');
                    refs.classList.toggle('expanded');
                }
            });
        }
        
        toggleChat() {
            this.state.isOpen = !this.state.isOpen;
            this.elements.window.classList.toggle('open', this.state.isOpen);
            
            if (this.state.isOpen) {
                this.state.showTooltip = false;
                this.elements.tooltip?.classList.remove('show');
                this.elements.input?.focus();
                this.scrollToBottom();
            }
        }
        
        closeChat() {
            this.state.isOpen = false;
            this.elements.window.classList.remove('open');
        }
        
        toggleHistory() {
            this.state.showHistory = !this.state.showHistory;
            this.elements.history.classList.toggle('open', this.state.showHistory);
        }
        
        startNewChat() {
            if (confirm('Start a new conversation?')) {
                const session = this.sessionManager.createSession();
                this.state.currentSession = session;
                this.state.sessions = this.sessionManager.getAllSessions();
                this.state.messages = [];
                
                this.showWelcomeMessage();
                this.updateMessagesUI();
                this.updateHistoryUI();
                
                this.state.showHistory = false;
                this.elements.history.classList.remove('open');
            }
        }
        
        switchSession(sessionId) {
            const session = this.sessionManager.setActiveSession(sessionId);
            if (session) {
                this.state.currentSession = session;
                this.state.messages = session.messages || [];
                this.updateMessagesUI();
                this.updateHistoryUI();
                
                this.state.showHistory = false;
                this.elements.history.classList.remove('open');
            }
        }
        
        async handleSubmit(e) {
            e.preventDefault();
            
            const message = this.elements.input.value.trim();
            if (!message || this.state.isLoading) return;
            
            // Clear input
            this.elements.input.value = '';
            this.autoResizeInput();
            
            // Send message
            await this.sendMessage(message);
        }
        
        async sendMessage(text) {
            // Add user message
            const userMsg = {
                id: 'msg-' + Date.now(),
                role: 'user',
                content: text,
                timestamp: this.getCurrentTime()
            };
            
            this.addMessage(userMsg);
            this.state.isLoading = true;
            this.updateMessagesUI();
            
            try {
                // Send to server
                const formData = new FormData();
                formData.append('action', 'hello_chatbot_send_message');
                formData.append('nonce', this.config.nonce);
                formData.append('message', text);
                formData.append('page_context', `On page: ${document.title} (${location.pathname})`);
                
                const response = await fetch(this.config.ajaxUrl, {
                    method: 'POST',
                    body: formData
                });
                
                const data = await response.json();
                
                if (data.success) {
                    const assistantMsg = {
                        id: 'msg-' + Date.now(),
                        role: 'assistant',
                        content: data.data.answer,
                        timestamp: this.getCurrentTime(),
                        references: data.data.references || []
                    };
                    
                    this.addMessage(assistantMsg);
                } else {
                    throw new Error(data.data || 'Request failed');
                }
            } catch (error) {
                console.error('Chat error:', error);
                
                const errorMsg = {
                    id: 'msg-' + Date.now(),
                    role: 'assistant',
                    content: this.config.strings.error,
                    timestamp: this.getCurrentTime()
                };
                
                this.addMessage(errorMsg);
            } finally {
                this.state.isLoading = false;
                this.updateMessagesUI();
            }
        }
        
        addMessage(message) {
            this.state.messages.push(message);
            
            // Update session
            if (this.state.currentSession) {
                this.sessionManager.updateSession(this.state.currentSession.id, {
                    messages: this.state.messages
                });
                
                // Update title if it's the first user message
                if (message.role === 'user' && this.state.currentSession.title === 'New Chat') {
                    const title = message.content.substring(0, 30) + (message.content.length > 30 ? '...' : '');
                    this.sessionManager.renameSession(this.state.currentSession.id, title);
                    this.state.currentSession.title = title;
                }
            }
        }
        
        updateMessagesUI() {
            this.elements.messages.innerHTML = this.buildMessagesHTML();
            this.scrollToBottom();
        }
        
        updateHistoryUI() {
            const historyList = document.querySelector('.chatbot-history-list');
            if (historyList) {
                historyList.innerHTML = this.buildHistoryHTML();
            }
        }
        
        scrollToBottom() {
            setTimeout(() => {
                this.elements.messages.scrollTop = this.elements.messages.scrollHeight;
            }, 100);
        }
        
        autoResizeInput() {
            const input = this.elements.input;
            input.style.height = 'auto';
            input.style.height = Math.min(input.scrollHeight, 100) + 'px';
        }
        
        formatMessage(content) {
            return content
                .replace(/\n/g, '<br>')
                .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
        }
        
        formatDate(timestamp) {
            const date = new Date(timestamp);
            const now = new Date();
            const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
            
            if (diffDays === 0) return 'Today';
            if (diffDays === 1) return 'Yesterday';
            if (diffDays < 7) return `${diffDays} days ago`;
            return date.toLocaleDateString();
        }
        
        getCurrentTime() {
            return new Date().toLocaleTimeString([], {
                hour: 'numeric',
                minute: '2-digit'
            });
        }
        
        // Icon methods
        getButtonIcon() {
            return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M20 2H4C2.9 2 2 2.9 2 4V16C2 17.1 2.9 18 4 18H18L22 22V4C22 2.9 21.1 2 20 2Z" stroke="currentColor" stroke-width="2"/>
            </svg>`;
        }
        
        getBotIcon() {
            return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                <circle cx="9" cy="10" r="1.5" fill="currentColor"/>
                <circle cx="15" cy="10" r="1.5" fill="currentColor"/>
                <path d="M8 14C8 14 10 16 12 16C14 16 16 14 16 14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>`;
        }
        
        getUserIcon() {
            return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 12C14.2091 12 16 10.2091 16 8C16 5.79086 14.2091 4 12 4C9.79086 4 8 5.79086 8 8C8 10.2091 9.79086 12 12 12Z" fill="currentColor"/>
                <path d="M12 14C8.13401 14 5 17.134 5 21H19C19 17.134 15.866 14 12 14Z" fill="currentColor"/>
            </svg>`;
        }
        
        getHistoryIcon() {
            return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20Z" fill="currentColor"/>
                <path d="M12.5 7H11V13L16.25 16.15L17 14.92L12.5 12.25V7Z" fill="currentColor"/>
            </svg>`;
        }
        
        getRefreshIcon() {
            return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 4V1L8 5L12 9V6C15.31 6 18 8.69 18 12C18 13.01 17.75 13.97 17.3 14.8L18.76 16.26C19.54 15.03 20 13.57 20 12C20 7.58 16.42 4 12 4ZM12 18C8.69 18 6 15.31 6 12C6 10.99 6.25 10.03 6.7 9.2L5.24 7.74C4.46 8.97 4 10.43 4 12C4 16.42 7.58 20 12 20V23L16 19L12 15V18Z" fill="currentColor"/>
            </svg>`;
        }
        
        getMinimizeIcon() {
            return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="currentColor"/>
            </svg>`;
        }
        
        getSendIcon() {
            return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M2.01 21L23 12 2.01 3 2 10L17 12 2 14L2.01 21Z" fill="currentColor"/>
            </svg>`;
        }
    }
    
    /**
     * SessionManager Class - Handles chat session persistence
     */
    class SessionManager {
        constructor() {
            this.STORAGE_KEY = 'helloChatbotSessions';
            this.MAX_SESSIONS = 50;
        }
        
        initialize() {
            this.cleanupOldSessions();
            const data = this.getSessionsData();
            if (!data.activeSessionId || !data.sessions[data.activeSessionId]) {
                this.createSession();
            }
        }
        
        getSessionsData() {
            try {
                const data = localStorage.getItem(this.STORAGE_KEY);
                if (data) {
                    return JSON.parse(data);
                }
            } catch (e) {
                console.warn('Could not parse sessions data:', e);
            }
            
            return {
                sessions: {},
                activeSessionId: null,
                sessionOrder: []
            };
        }
        
        saveSessionsData(data) {
            try {
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
            } catch (e) {
                console.error('Could not save sessions:', e);
            }
        }
        
        createSession() {
            const sessionId = 'session-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
            const now = Date.now();
            
            const session = {
                id: sessionId,
                title: 'New Chat',
                messages: [],
                created: now,
                updated: now
            };
            
            const data = this.getSessionsData();
            data.sessions[sessionId] = session;
            data.activeSessionId = sessionId;
            data.sessionOrder.unshift(sessionId);
            
            // Limit sessions
            if (data.sessionOrder.length > this.MAX_SESSIONS) {
                const toRemove = data.sessionOrder.pop();
                delete data.sessions[toRemove];
            }
            
            this.saveSessionsData(data);
            return session;
        }
        
        getActiveSession() {
            const data = this.getSessionsData();
            if (data.activeSessionId && data.sessions[data.activeSessionId]) {
                return data.sessions[data.activeSessionId];
            }
            return this.createSession();
        }
        
        getAllSessions() {
            const data = this.getSessionsData();
            return Object.values(data.sessions).sort((a, b) => b.updated - a.updated);
        }
        
        setActiveSession(sessionId) {
            const data = this.getSessionsData();
            if (data.sessions[sessionId]) {
                data.activeSessionId = sessionId;
                this.saveSessionsData(data);
                return data.sessions[sessionId];
            }
            return null;
        }
        
        updateSession(sessionId, updates) {
            const data = this.getSessionsData();
            if (data.sessions[sessionId]) {
                Object.assign(data.sessions[sessionId], updates);
                data.sessions[sessionId].updated = Date.now();
                this.saveSessionsData(data);
                return data.sessions[sessionId];
            }
            return null;
        }
        
        renameSession(sessionId, newTitle) {
            return this.updateSession(sessionId, { title: newTitle });
        }
        
        deleteSession(sessionId) {
            const data = this.getSessionsData();
            if (data.sessions[sessionId]) {
                delete data.sessions[sessionId];
                const index = data.sessionOrder.indexOf(sessionId);
                if (index > -1) {
                    data.sessionOrder.splice(index, 1);
                }
                
                if (data.activeSessionId === sessionId) {
                    if (data.sessionOrder.length > 0) {
                        data.activeSessionId = data.sessionOrder[0];
                    } else {
                        return this.createSession();
                    }
                }
                
                this.saveSessionsData(data);
                return true;
            }
            return false;
        }
        
        cleanupOldSessions() {
            const data = this.getSessionsData();
            const cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000); // 30 days
            let hasChanges = false;
            
            for (const [id, session] of Object.entries(data.sessions)) {
                if (session.updated < cutoff) {
                    delete data.sessions[id];
                    const index = data.sessionOrder.indexOf(id);
                    if (index > -1) {
                        data.sessionOrder.splice(index, 1);
                    }
                    hasChanges = true;
                }
            }
            
            if (hasChanges) {
                this.saveSessionsData(data);
            }
        }
    }
    
    // Initialize when DOM is ready
    document.addEventListener('DOMContentLoaded', function() {
        if (window.helloChatbot && document.getElementById('hello-chatbot-widget')) {
            new ChatbotWidget(window.helloChatbot);
        }
    });
    
})();