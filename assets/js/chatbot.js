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
            this.sessionManager = new SessionManager();
            
            // Load saved widget state
            const savedWidgetState = this.sessionManager.getWidgetState();
            
            this.state = {
                isOpen: savedWidgetState.isOpen || false,
                isLoading: false,
                messages: [],
                currentSession: null,
                sessions: [],
                viewMode: 'chat', // 'chat' or 'list' - controls which view is shown
                showTooltip: false // Will be set in init() based on page load count and other conditions
            };
            
            this.elements = {};
            this.messageDOMCache = new Map(); // Cache message DOM elements per session
            
            this.init();
        }
        
        init() {
            this.sessionManager.initialize();
            
            // Increment page load count for welcome tooltip tracking
            this.sessionManager.incrementPageLoadCount();
            
            this.loadSession();
            
            // Set tooltip visibility based on page load count and other conditions
            const savedWidgetState = this.sessionManager.getWidgetState();
            this.state.showTooltip = this.sessionManager.shouldShowWelcomeTooltip() && 
                                   !savedWidgetState.isOpen;
            
            this.render();
            this.attachEventListeners();
            this.showWelcomeMessage();
            
            // Auto-open widget if it was previously open
            if (this.state.isOpen) {
                // Small delay to ensure DOM is ready
                setTimeout(() => {
                    this.elements.window?.classList.add('open', 'extended');
                    // Hide the open chat button since widget is open
                    if (this.elements.button) {
                        this.elements.button.style.display = 'none';
                    }
                    // Ensure messages are visible if this is a new session
                    if (this.state.messages.length > 0 && this.elements.messages && !this.elements.messages.hasChildNodes()) {
                        this.elements.messages.innerHTML = this.buildMessagesHTML();
                    }
                    this.scrollToBottom();
                }, 100);
            }
        }
        
        loadSession() {
            const session = this.sessionManager.getActiveSession();
            this.state.currentSession = session;
            this.state.sessions = this.sessionManager.getAllSessions();
            
            if (session && session.messages && session.messages.length > 0) {
                this.state.messages = session.messages;
            }
        }
        
        showWelcomeMessage() {
            if (this.state.messages.length === 0) {
                const welcomeMsg = {
                    id: 'welcome-' + Date.now(),
                    role: 'assistant',
                    content: "Welcome to the Concentrix Bot. I'm an AI bot here to connect you to the people and information at Concentrix that you need.\n\nWhat would you like to do next?",
                    timestamp: this.getCurrentTime(),
                    actions: ['Who is Concentrix?', 'Speak with a specialist', 'Learn about our careers']
                };
                this.addMessage(welcomeMsg);
                
                // Ensure the message is rendered to the DOM
                if (this.elements.messages) {
                    this.appendMessage(welcomeMsg, false);
                }
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
                    <img src="${window.helloChatbot.chatIconUrl}" />
                </button>
                
                <!-- Tooltip -->
                <div id="chatbot-tooltip" class="chatbot-tooltip ${this.state.showTooltip ? 'show' : ''}">
                    <div class="chatbot-tooltip-header">
                        <span class="chatbot-tooltip-logo"> <img src="${window.helloChatbot.concentrixLogoUrl}" width="104px" /></span>
                        <button class="chatbot-tooltip-close" aria-label="Close">×</button>
                    </div>
                    <div class="chatbot-tooltip-content">
                        <p>👋 Hi there! Want to chat about Concentrix services? I’m an AI assistant that is here to help.</p>
                    </div>
                </div>
                
                <!-- Chat Window -->
                <div id="chatbot-window" class="chatbot-window ${this.state.isOpen ? 'open' : ''}">
                    <!-- Header -->
                    <div class="chatbot-header">
                        ${this.state.viewMode === 'chat' && this.state.sessions.length > 0 ? 
                            `<button id="chatbot-back-btn" class="chatbot-back-btn" aria-label="View all chats">
                                ${this.getBackIcon()}
                            </button>` : ''}
                        <div class="chatbot-title">
                            <span class="chatbot-tooltip-logo"> <img src="${window.helloChatbot.concentrixLogoUrl}" width="104px" /> </span>
                            ${this.state.viewMode === 'chat' && this.state.currentSession?.title !== 'New Chat' ? 
                                `<div class="chatbot-session-title">${this.state.currentSession.title}</div>` : ''}
                        </div>
                        <div class="chatbot-controls">
                            ${this.state.viewMode === 'chat' ? `
                                <button id="chatbot-info-btn" class="chatbot-control-btn" aria-label="Info">
                                    ${this.getInfoIcon()}
                                </button>
                                <button id="chatbot-refresh-btn" class="chatbot-control-btn" aria-label="New chat">
                                    ${this.getRefreshIcon()}
                                </button>` : ''}
                            <button id="chatbot-minimize-btn" class="chatbot-control-btn" aria-label="Minimize">
                                ${this.getMinimizeIcon()}
                            </button>
                        </div>
                    </div>
                    
                    ${this.state.viewMode === 'chat' ? `
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
                            <div class="chatbot-input-footer"><span>Powered by </span> <span><a href="/ix-hello/">iX Hello</a></span></div>
                        </div>
                    ` : `
                        <!-- Chat List View -->
                        <div id="chatbot-list-view" class="chatbot-list-view">
                            <button id="chatbot-new-chat" class="chatbot-new-chat-btn">
                                + ${this.config.strings.newChat || 'New Chat'}
                            </button>
                            <div class="chatbot-sessions-grid">
                                ${this.buildSessionsListHTML()}
                            </div>
                        </div>
                    `}
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
            const sender = isUser ? 'You' : 'iX Hello Assistant';
            
            let html = `
                <div class="chatbot-message chatbot-message-${message.role}" data-message-id="${message.id}">
                    <div class="chatbot-message-avatar">${avatar}</div>
                    <div class="chatbot-message-content">
                        <div class="chatbot-message-header">
                            <span class="chatbot-message-sender">${sender}</span>
                            <span class="chatbot-message-time">${message.timestamp}</span>
                        </div>
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
                        <button class="chatbot-action-btn" type="button">
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
                        <div class="chatbot-message-header">
                            <span class="chatbot-message-sender">iX Hello Assistant</span>
                            <span class="chatbot-message-time">${this.getCurrentTime()}</span>
                        </div>
                        <div class="chatbot-thinking-dots">
                            <span class="chatbot-thinking-circle"></span>
                            <span class="chatbot-thinking-text">Thinking</span>
                            <span class="dot">.</span>
                            <span class="dot">.</span>
                            <span class="dot">.</span>
                        </div>
                    </div>
                </div>
            `;
        }
        
        buildSessionsListHTML() {
            if (this.state.sessions.length === 0) {
                return '<div class="chatbot-sessions-empty">No previous chats yet. Start a new conversation!</div>';
            }
            
            return this.state.sessions.map(session => {
                const isActive = session.id === this.state.currentSession?.id;
                const lastMessage = session.messages && session.messages.length > 0 ? 
                    session.messages[session.messages.length - 1] : null;
                const preview = lastMessage ? 
                    (lastMessage.role === 'user' ? 'You: ' : 'Bot: ') + 
                    lastMessage.content.substring(0, 50) + 
                    (lastMessage.content.length > 50 ? '...' : '') : 
                    'No messages yet';
                
                return `
                    <div class="chatbot-session-card ${isActive ? 'active' : ''}" 
                         data-session-id="${session.id}">
                        <div class="chatbot-session-card-header">
                            <div class="chatbot-session-card-title">${session.title}</div>
                            ${isActive ? '<span class="chatbot-session-active-badge">Current</span>' : ''}
                        </div>
                        <div class="chatbot-session-card-preview">${preview}</div>
                        <div class="chatbot-session-card-date">${this.formatDate(session.updated)}</div>
                    </div>
                `;
            }).join('');
        }
        
        cacheElements() {
            this.elements = {
                button: document.getElementById('chatbot-button'),
                window: document.getElementById('chatbot-window'),
                messages: document.getElementById('chatbot-messages'),
                input: document.getElementById('chatbot-input'),
                form: document.getElementById('chatbot-form'),
                tooltip: document.getElementById('chatbot-tooltip'),
                backBtn: document.getElementById('chatbot-back-btn'),
                infoBtn: document.getElementById('chatbot-info-btn'),
                refreshBtn: document.getElementById('chatbot-refresh-btn'),
                minimizeBtn: document.getElementById('chatbot-minimize-btn'),
                newChatBtn: document.getElementById('chatbot-new-chat'),
                listView: document.getElementById('chatbot-list-view')
            };
        }
        
        attachEventListeners() {
            // Chat button
            this.elements.button?.addEventListener('click', () => this.toggleChat());
            
            // Window controls
            this.elements.minimizeBtn?.addEventListener('click', () => this.closeChat());
            this.elements.infoBtn?.addEventListener('click', () => this.showInfo());
            this.elements.refreshBtn?.addEventListener('click', () => this.startNewChat());
            
            // Back button (to switch to list view)
            this.elements.backBtn?.addEventListener('click', () => this.switchToListView());
            
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
            
            // New chat button
            this.elements.newChatBtn?.addEventListener('click', () => {
                if (this.state.viewMode === 'list') {
                    // Create new chat and switch to chat view
                    const session = this.sessionManager.createSession();
                    this.state.currentSession = session;
                    this.state.sessions = this.sessionManager.getAllSessions();
                    this.state.messages = [];
                    this.showWelcomeMessage();
                    this.switchToChatView();
                } else {
                    this.startNewChat();
                }
            });
            
            // Tooltip close
            document.querySelector('.chatbot-tooltip-close')?.addEventListener('click', () => {
                this.state.showTooltip = false;
                this.elements.tooltip.classList.remove('show');
            });
            
            // Action button clicks
            document.addEventListener('click', (e) => {
                if (e.target.classList.contains('chatbot-action-btn')) {
                    e.preventDefault();
                    const button = e.target;
                    const action = button.textContent.trim();
                    
                    // Provide immediate visual feedback
                    this.setActionButtonLoading(button, true);
                    
                    // Disable other action buttons temporarily
                    const allActionButtons = document.querySelectorAll('.chatbot-action-btn');
                    allActionButtons.forEach(btn => {
                        if (btn !== button) {
                            btn.style.opacity = '0.4';
                            btn.disabled = true;
                        }
                    });
                    
                    // Send the action text as a message
                    this.elements.input.value = action;
                    
                    // Use a slight delay to show the loading feedback
                    setTimeout(async () => {
                        await this.handleSubmit(e);
                        
                        // Re-enable all action buttons after processing
                        allActionButtons.forEach(btn => {
                            btn.style.opacity = '';
                            btn.disabled = false;
                        });
                        this.setActionButtonLoading(button, false);
                    }, 100);
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
            
            // Hide/show the open chat button and adjust window position
            if (this.elements.button) {
                this.elements.button.style.display = this.state.isOpen ? 'none' : 'block';
            }
            
            // Add/remove extended class to fill button space
            if (this.state.isOpen) {
                this.elements.window.classList.add('extended');
            } else {
                this.elements.window.classList.remove('extended');
            }
            
            // Save the widget state
            this.sessionManager.saveWidgetState(this.state.isOpen);
            
            if (this.state.isOpen) {
                this.state.showTooltip = false;
                this.elements.tooltip?.classList.remove('show');
                this.elements.input?.focus();
                this.scrollToBottom();
            }
        }
        
        closeChat() {
            this.state.isOpen = false;
            this.elements.window.classList.remove('open', 'extended');
            
            // Show the open chat button again
            if (this.elements.button) {
                this.elements.button.style.display = 'block';
            }
            
            // Save the closed state
            this.sessionManager.saveWidgetState(false);
        }
        
        showInfo() {
            alert('Concentrix Bot v1.0\n\nPowered by AI to help you connect with Concentrix resources.');
        }
        
        startNewChat() {
            if (confirm('Start a new conversation?')) {
                // Clear the DOM cache for current session
                if (this.state.currentSession) {
                    this.clearMessageCache(this.state.currentSession.id);
                }
                
                const session = this.sessionManager.createSession();
                this.state.currentSession = session;
                this.state.sessions = this.sessionManager.getAllSessions();
                this.state.messages = [];
                
                // Force clear the messages container
                if (this.elements.messages) {
                    this.elements.messages.innerHTML = '';
                }
                
                this.showWelcomeMessage();
                
                // If we're in list view, switch to chat view
                if (this.state.viewMode === 'list') {
                    this.switchToChatView();
                } else {
                    this.updateMessagesUI();
                }
            }
        }
        
        /**
         * Get or create cached DOM for messages of a session
         */
        getCachedMessagesDOM(sessionId) {
            if (!this.messageDOMCache.has(sessionId)) {
                const fragment = document.createDocumentFragment();
                const messages = this.state.messages || [];
                
                messages.forEach(msg => {
                    const messageElement = document.createElement('div');
                    messageElement.innerHTML = this.buildMessageHTML(msg);
                    fragment.appendChild(messageElement.firstElementChild);
                });
                
                this.messageDOMCache.set(sessionId, fragment);
            }
            return this.messageDOMCache.get(sessionId);
        }
        
        /**
         * Clear cache for a specific session
         */
        clearMessageCache(sessionId) {
            this.messageDOMCache.delete(sessionId);
        }
        
        switchSession(sessionId) {
            const session = this.sessionManager.setActiveSession(sessionId);
            if (session) {
                // Store previous session ID for comparison
                const previousSessionId = this.state.currentSession?.id;
                
                this.state.currentSession = session;
                this.state.messages = session.messages || [];
                
                // Ensure we're in chat view when switching sessions
                if (this.state.viewMode === 'list') {
                    this.switchToChatView();
                } else if (this.elements.messages) {
                    // Only update messages if we're switching to a different session
                    if (previousSessionId !== sessionId) {
                        // Optimized message swapping without flickering
                        const messagesContainer = this.elements.messages;
                        
                        // Create a document fragment with all messages
                        const fragment = document.createDocumentFragment();
                        const messages = this.state.messages || [];
                        
                        if (messages.length === 0) {
                            // Just clear if no messages
                            messagesContainer.innerHTML = '';
                        } else {
                            // Build messages without flickering
                            messages.forEach(msg => {
                                // Check if message element already exists in DOM
                                const existingMsg = messagesContainer.querySelector(`[data-message-id="${msg.id}"]`);
                                if (existingMsg) {
                                    // Reuse existing element
                                    fragment.appendChild(existingMsg);
                                } else {
                                    // Create new element
                                    const messageElement = document.createElement('div');
                                    messageElement.innerHTML = this.buildMessageHTML(msg);
                                    fragment.appendChild(messageElement.firstElementChild);
                                }
                            });
                            
                            // Single DOM update to minimize reflow
                            messagesContainer.innerHTML = '';
                            messagesContainer.appendChild(fragment);
                        }
                        
                        this.scrollToBottom();
                    }
                }
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
            // Add user message with smooth animation
            const userMsg = {
                id: 'msg-' + Date.now(),
                role: 'user',
                content: text,
                timestamp: this.getCurrentTime()
            };
            
            this.addMessage(userMsg);
            this.appendMessage(userMsg);
            
            // Show loading indicator smoothly
            this.state.isLoading = true;
            this.setLoadingIndicator(true);
            
            // Try streaming first, fallback to regular if it fails
            const useStreaming = this.config.enableStreaming !== false;
            
            if (useStreaming) {
                const streamSuccess = await this.sendStreamingMessage(text);
                if (streamSuccess) {
                    return; // Streaming succeeded
                }
                // Fall back to non-streaming if streaming failed
            }
            
            try {
                // Send to server (non-streaming)
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
                    this.setLoadingIndicator(false);
                    this.appendMessage(assistantMsg);
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
                this.setLoadingIndicator(false);
                this.appendMessage(errorMsg);
            } finally {
                this.state.isLoading = false;
            }
        }
        
        /**
         * Send message using Server-Sent Events for streaming responses
         */
        async sendStreamingMessage(text) {
            return new Promise((resolve) => {
                try {
                    // Build SSE URL with parameters
                    const params = new URLSearchParams({
                        action: 'hello_chatbot_stream_message',
                        nonce: this.config.nonce,
                        message: text,
                        page_context: `On page: ${document.title} (${location.pathname})`
                    });
                    
                    const eventSource = new EventSource(`${this.config.ajaxUrl}?${params}`);
                    
                    // Create assistant message that will be updated with chunks
                    const assistantMsgId = 'msg-' + Date.now();
                    const assistantMsg = {
                        id: assistantMsgId,
                        role: 'assistant',
                        content: '',
                        timestamp: this.getCurrentTime(),
                        references: []
                    };
                    
                    let accumulatedContent = '';
                    let messageElement = null;
                    let contentElement = null;
                    let firstChunkReceived = false;
                    
                    eventSource.onmessage = (event) => {
                        try {
                            // Handle empty or malformed data gracefully
                            if (!event.data || event.data.trim() === '') {
                                return;
                            }
                            
                            const data = JSON.parse(event.data);
                            
                            if (data.error) {
                                // Error occurred
                                console.error('Streaming error:', data.error);
                                eventSource.close();
                                
                                // Remove thinking indicator if still showing
                                if (!firstChunkReceived) {
                                    this.setLoadingIndicator(false);
                                    
                                    // Add error message to state
                                    assistantMsg.content = this.config.strings.error;
                                    this.addMessage(assistantMsg);
                                    
                                    // Create and append error message element
                                    messageElement = this.appendMessage(assistantMsg);
                                } else {
                                    // Update existing message with error
                                    assistantMsg.content = this.config.strings.error;
                                    this.updateMessage(assistantMsgId, assistantMsg);
                                    if (contentElement) {
                                        const textElement = contentElement.querySelector('.chatbot-message-text');
                                        if (textElement) {
                                            textElement.innerHTML = this.formatMessage(assistantMsg.content);
                                        }
                                    }
                                }
                                
                                resolve(false); // Streaming failed
                                return;
                            }
                            
                            switch (data.type) {
                                case 'chunk':
                                    // On first chunk, remove thinking indicator and create message
                                    if (!firstChunkReceived) {
                                        firstChunkReceived = true;
                                        this.setLoadingIndicator(false);
                                        
                                        // Add message to state
                                        this.addMessage(assistantMsg);
                                        
                                        // Create and append message element
                                        messageElement = this.appendMessage(assistantMsg);
                                        contentElement = messageElement?.querySelector('.chatbot-message-content');
                                    }
                                    
                                    // Append new content chunk
                                    accumulatedContent += data.content;
                                    assistantMsg.content = accumulatedContent;
                                    
                                    // Update message in state
                                    this.updateMessage(assistantMsgId, assistantMsg);
                                    
                                    // Update DOM directly for smooth streaming (like test file)
                                    if (contentElement) {
                                        const textElement = contentElement.querySelector('.chatbot-message-text');
                                        if (textElement) {
                                            textElement.innerHTML = this.formatMessage(accumulatedContent);
                                            // Auto-scroll within message if needed
                                            textElement.scrollTop = textElement.scrollHeight;
                                        }
                                    }
                                    
                                    // Scroll to bottom to show new content
                                    this.scrollToBottom();
                                    break;
                                    
                                case 'references':
                                    // Update references
                                    assistantMsg.references = data.references || [];
                                    this.updateMessage(assistantMsgId, assistantMsg);
                                    
                                    // Add references to DOM (like test file shows references after content)
                                    if (data.references?.length > 0) {
                                        const referencesHTML = this.buildReferencesHTML(data.references);
                                        
                                        // Check if references container already exists
                                        let refsContainer = messageElement?.querySelector('.chatbot-references');
                                        if (!refsContainer) {
                                            // Create references container if it doesn't exist
                                            const textElement = contentElement.querySelector('.chatbot-message-text');
                                            if (textElement) {
                                                textElement.insertAdjacentHTML('afterend', referencesHTML);
                                            }
                                        } else {
                                            // Update existing references
                                            refsContainer.outerHTML = referencesHTML;
                                        }
                                        
                                        this.scrollToBottom();
                                    }
                                    break;
                                    
                                case 'done':
                                    // Streaming completed successfully
                                    eventSource.close();
                                    this.state.isLoading = false;
                                    
                                    // If no chunks were received, remove thinking indicator
                                    if (!firstChunkReceived) {
                                        this.setLoadingIndicator(false);
                                    }
                                    
                                    resolve(true); // Streaming succeeded
                                    break;
                            }
                        } catch (e) {
                            console.error('Error parsing SSE data:', e, 'Raw data:', event.data);
                            // Don't fail the entire stream for one bad chunk
                            // Continue processing other chunks
                        }
                    };
                    
                    eventSource.onerror = (error) => {
                        console.error('SSE connection error:', error);
                        eventSource.close();
                        this.state.isLoading = false;
                        
                        // Remove thinking indicator if still showing
                        if (!firstChunkReceived) {
                            this.setLoadingIndicator(false);
                        }
                        
                        resolve(false); // Streaming failed, will fallback
                    };
                    
                    // Close connection on timeout (60 seconds)
                    setTimeout(() => {
                        if (eventSource.readyState !== EventSource.CLOSED) {
                            eventSource.close();
                            this.state.isLoading = false;
                            
                            // Remove thinking indicator if still showing
                            if (!firstChunkReceived) {
                                this.setLoadingIndicator(false);
                            }
                            
                            resolve(false);
                        }
                    }, 60000);
                    
                } catch (error) {
                    console.error('Failed to initialize streaming:', error);
                    this.state.isLoading = false;
                    this.setLoadingIndicator(false); // Remove thinking indicator on init error
                    resolve(false); // Streaming failed, will fallback
                }
            });
        }
        
        /**
         * Update a message in the state
         */
        updateMessage(messageId, updatedMessage) {
            const session = this.state.currentSession;
            if (session) {
                const index = session.messages.findIndex(m => m.id === messageId);
                if (index !== -1) {
                    session.messages[index] = updatedMessage;
                    this.sessionManager.saveSession(session);
                }
            }
        }
        
        addMessage(message) {
            this.state.messages.push(message);
            
            // Update session
            if (this.state.currentSession) {
                // Clear cache for this session since we're adding a new message
                this.clearMessageCache(this.state.currentSession.id);
                
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
            // Only use full rebuild when necessary (initial load)
            if (!this.elements.messages.hasChildNodes()) {
                this.elements.messages.innerHTML = this.buildMessagesHTML();
            }
            this.scrollToBottom();
        }
        
        /**
         * Append a single message instantly without any animations
         */
        appendMessage(message) {
            const messageElement = document.createElement('div');
            messageElement.innerHTML = this.buildMessageHTML(message);
            const messageNode = messageElement.firstElementChild;
            
            this.elements.messages.appendChild(messageNode);
            this.scrollToBottom();
            
            return messageNode;
        }
        
        /**
         * Update a specific message element without rebuilding
         */
        updateMessageElement(messageId, updatedMessage) {
            const messageElement = this.elements.messages.querySelector(`[data-message-id="${messageId}"]`);
            if (messageElement) {
                const newElement = document.createElement('div');
                newElement.innerHTML = this.buildMessageHTML(updatedMessage);
                const newMessageNode = newElement.firstElementChild;
                
                messageElement.parentNode.replaceChild(newMessageNode, messageElement);
                return newMessageNode;
            }
        }
        
        /**
         * Set loading state for action buttons with immediate visual feedback
         */
        setActionButtonLoading(button, isLoading) {
            if (isLoading) {
                button.classList.add('loading');
                button.disabled = true;
                button.style.opacity = '0.6';
                button.style.transform = 'scale(0.98)';
            } else {
                button.classList.remove('loading');
                button.disabled = false;
                button.style.opacity = '';
                button.style.transform = '';
            }
        }
        
        /**
         * Show/hide loading indicator instantly
         */
        setLoadingIndicator(show) {
            const existingLoader = this.elements.messages.querySelector('.chatbot-thinking');
            
            if (show && !existingLoader) {
                const loaderElement = document.createElement('div');
                loaderElement.innerHTML = this.buildThinkingHTML();
                const loaderNode = loaderElement.firstElementChild;
                this.elements.messages.appendChild(loaderNode);
                this.scrollToBottom();
            } else if (!show && existingLoader) {
                existingLoader.remove();
            }
        }
        
        /**
         * Smooth transition between views without jarring rebuilds
         */
        transitionToView(newViewMode, sessionId = null) {
            if (this.state.viewMode === newViewMode) return;
            
            const container = this.elements.window;
            if (!container) return;
            
            // Add transitioning class for smooth fade
            container.classList.add('transitioning');
            container.style.opacity = '0.95';
            
            // Shorter delay for quicker transitions
            setTimeout(() => {
                if (newViewMode === 'chat' && sessionId && sessionId !== this.state.currentSession?.id) {
                    this.switchSession(sessionId);
                }
                
                this.state.viewMode = newViewMode;
                
                // Remove existing content areas
                const existingMessages = container.querySelector('#chatbot-messages');
                const existingList = container.querySelector('#chatbot-list-view');
                const existingInput = container.querySelector('.chatbot-input-area');
                
                if (newViewMode === 'list') {
                    // Remove chat view elements
                    if (existingMessages) existingMessages.remove();
                    if (existingInput) existingInput.remove();
                    
                    // Add list view if not present
                    if (!existingList) {
                        const listHTML = `
                            <div id="chatbot-list-view" class="chatbot-list-view">
                                <button id="chatbot-new-chat" class="chatbot-new-chat-btn">
                                    + ${this.config.strings.newChat || 'New Chat'}
                                </button>
                                <div class="chatbot-sessions-grid">
                                    ${this.buildSessionsListHTML()}
                                </div>
                            </div>
                        `;
                        container.querySelector('.chatbot-header').insertAdjacentHTML('afterend', listHTML);
                        
                        // Reattach event listeners
                        this.attachSessionListeners();
                        document.getElementById('chatbot-new-chat')?.addEventListener('click', () => {
                            const session = this.sessionManager.createSession();
                            this.state.currentSession = session;
                            this.state.sessions = this.sessionManager.getAllSessions();
                            this.state.messages = [];
                            this.showWelcomeMessage();
                            this.switchToChatView();
                        });
                    }
                } else if (newViewMode === 'chat') {
                    // Remove list view
                    if (existingList) existingList.remove();
                    
                    // Add chat view elements if not present
                    if (!existingMessages) {
                        const messagesHTML = `
                            <div id="chatbot-messages" class="chatbot-messages">
                                ${this.buildMessagesHTML()}
                            </div>
                        `;
                        container.querySelector('.chatbot-header').insertAdjacentHTML('afterend', messagesHTML);
                    }
                    
                    if (!existingInput) {
                        const inputHTML = `
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
                                <div class="chatbot-input-footer"><span>Powered by </span> <span><a href="/ix-hello/">iX Hello</a></span></div>
                            </div>
                        `;
                        container.insertAdjacentHTML('beforeend', inputHTML);
                    }
                    
                    // Re-cache elements and attach listeners
                    this.elements.messages = document.getElementById('chatbot-messages');
                    this.elements.form = document.getElementById('chatbot-form');
                    this.elements.input = document.getElementById('chatbot-input');
                    
                    // Reattach form listeners
                    this.elements.form?.addEventListener('submit', (e) => this.handleSubmit(e));
                    this.elements.input?.addEventListener('input', () => this.autoResizeInput());
                    this.elements.input?.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            this.handleSubmit(e);
                        }
                    });
                    
                    this.scrollToBottom();
                }
                
                // Update header
                const title = container.querySelector('.chatbot-title h3');
                if (title) {
                    title.textContent = newViewMode === 'list' ? 'Chat History' : 'concentrix Bot';
                }
                
                // Update header buttons
                const backBtn = container.querySelector('.chatbot-back-btn');
                const controls = container.querySelector('.chatbot-controls');
                
                if (newViewMode === 'list') {
                    if (backBtn) backBtn.remove();
                    // Only show minimize button in list view
                    controls.innerHTML = `
                        <button id="chatbot-minimize-btn" class="chatbot-control-btn" aria-label="Minimize">
                            ${this.getMinimizeIcon()}
                        </button>
                    `;
                } else {
                    // Add back button if not present and there are sessions
                    if (!backBtn && this.state.sessions.length > 0) {
                        const backBtnHTML = `
                            <button id="chatbot-back-btn" class="chatbot-back-btn" aria-label="View all chats">
                                ${this.getBackIcon()}
                            </button>
                        `;
                        container.querySelector('.chatbot-header').insertAdjacentHTML('afterbegin', backBtnHTML);
                    }
                    // Add control buttons for chat view
                    controls.innerHTML = `
                        <button id="chatbot-info-btn" class="chatbot-control-btn" aria-label="Info">
                            ${this.getInfoIcon()}
                        </button>
                        <button id="chatbot-refresh-btn" class="chatbot-control-btn" aria-label="New chat">
                            ${this.getRefreshIcon()}
                        </button>
                        <button id="chatbot-minimize-btn" class="chatbot-control-btn" aria-label="Minimize">
                            ${this.getMinimizeIcon()}
                        </button>
                    `;
                }
                
                // Reattach header button listeners
                document.getElementById('chatbot-minimize-btn')?.addEventListener('click', () => this.closeChat());
                document.getElementById('chatbot-back-btn')?.addEventListener('click', () => this.switchToListView());
                document.getElementById('chatbot-info-btn')?.addEventListener('click', () => this.showInfo());
                document.getElementById('chatbot-refresh-btn')?.addEventListener('click', () => this.startNewChat());
                
                // Complete transition
                container.style.opacity = '1';
                setTimeout(() => {
                    container.classList.remove('transitioning');
                }, 50);
            }, 30);
        }
        
        /**
         * Attach event listeners for session list items
         */
        attachSessionListeners() {
            const sessionCards = document.querySelectorAll('.chatbot-session-card');
            sessionCards.forEach(card => {
                card.addEventListener('click', (e) => {
                    const sessionId = card.dataset.sessionId;
                    this.switchToChatView(sessionId);
                });
            });
        }
        
        switchToListView() {
            this.transitionToView('list');
        }
        
        switchToChatView(sessionId = null) {
            this.transitionToView('chat', sessionId);
        }
        
        scrollToBottom() {
            if (this.elements.messages) {
                this.elements.messages.scrollTop = this.elements.messages.scrollHeight;
            }
        }
        
        autoResizeInput() {
            const input = this.elements.input;
            input.style.height = 'auto';
            input.style.height = Math.min(input.scrollHeight, 100) + 'px';
        }
        
        formatMessage(content) {
            // First, escape HTML to prevent XSS attacks
            const escapeHtml = (text) => {
                const div = document.createElement('div');
                div.textContent = text;
                return div.innerHTML;
            };
            
            // Store code blocks temporarily to prevent them from being processed
            const codeBlocks = [];
            let processedContent = content;
            
            // Extract and store code blocks
            processedContent = processedContent.replace(/```([\s\S]*?)```/g, (match, code) => {
                const index = codeBlocks.length;
                codeBlocks.push(`<pre><code>${escapeHtml(code.trim())}</code></pre>`);
                return `__CODE_BLOCK_${index}__`;
            });
            
            // Extract and store inline code
            processedContent = processedContent.replace(/`([^`]+)`/g, (match, code) => {
                const index = codeBlocks.length;
                codeBlocks.push(`<code>${escapeHtml(code)}</code>`);
                return `__CODE_BLOCK_${index}__`;
            });
            
            // Escape HTML in the remaining content
            processedContent = escapeHtml(processedContent);
            
            // Process markdown elements (order matters!)
            
            // Headers (h1-h6)
            processedContent = processedContent.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
            processedContent = processedContent.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
            processedContent = processedContent.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
            processedContent = processedContent.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
            processedContent = processedContent.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
            processedContent = processedContent.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');
            
            // Bold text (must come before italic to handle ***text*** correctly)
            processedContent = processedContent.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
            
            // Italic text
            processedContent = processedContent.replace(/\*([^*]+)\*/g, '<em>$1</em>');
            processedContent = processedContent.replace(/_([^_]+)_/g, '<em>$1</em>');
            
            // Links [text](url)
            processedContent = processedContent.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
            
            // Auto-link URLs (but not those already in anchor tags)
            // Using a simpler regex for better browser compatibility
            processedContent = processedContent.replace(/(^|[^"'>])(https?:\/\/[^\s<]+)(?![^<]*<\/a>)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
            
            // Lists - Process line by line for better control
            const lines = processedContent.split('\n');
            let inList = false;
            let listType = null;
            const processedLines = [];
            
            lines.forEach((line, index) => {
                // Check for unordered list items
                if (/^[\*\-•]\s+/.test(line)) {
                    if (!inList || listType !== 'ul') {
                        if (inList) processedLines.push(`</${listType}>`);
                        processedLines.push('<ul>');
                        inList = true;
                        listType = 'ul';
                    }
                    processedLines.push(`<li>${line.replace(/^[\*\-•]\s+/, '')}</li>`);
                }
                // Check for ordered list items
                else if (/^\d+\.\s+/.test(line)) {
                    if (!inList || listType !== 'ol') {
                        if (inList) processedLines.push(`</${listType}>`);
                        processedLines.push('<ol>');
                        inList = true;
                        listType = 'ol';
                    }
                    processedLines.push(`<li>${line.replace(/^\d+\.\s+/, '')}</li>`);
                }
                // Not a list item
                else {
                    if (inList) {
                        processedLines.push(`</${listType}>`);
                        inList = false;
                        listType = null;
                    }
                    processedLines.push(line);
                }
            });
            
            // Close any open list
            if (inList) {
                processedLines.push(`</${listType}>`);
            }
            
            processedContent = processedLines.join('\n');
            
            // Convert content to paragraphs instead of line breaks
            // Split on double newlines for paragraph breaks, single newlines become spaces within paragraphs
            const paragraphs = processedContent.split(/\n\n+/).filter(p => p.trim().length > 0);
            
            if (paragraphs.length > 1) {
                // Multiple paragraphs - wrap each in <p> tags
                processedContent = paragraphs.map(paragraph => {
                    const cleanParagraph = paragraph.replace(/\n/g, ' ').trim();
                    return cleanParagraph ? `<p>${cleanParagraph}</p>` : '';
                }).filter(p => p.length > 0).join('');
            } else if (paragraphs.length === 1) {
                // Single paragraph - wrap in <p> if it doesn't already contain block elements
                const hasBlockElements = /<(h[1-6]|ul|ol|pre|blockquote|div)>/i.test(processedContent);
                if (!hasBlockElements) {
                    const cleanContent = processedContent.replace(/\n/g, ' ').trim();
                    processedContent = cleanContent ? `<p>${cleanContent}</p>` : '';
                } else {
                    // Contains block elements, just clean up newlines
                    processedContent = processedContent.replace(/\n/g, ' ');
                }
            }
            
            // Restore code blocks
            codeBlocks.forEach((block, index) => {
                processedContent = processedContent.replace(`__CODE_BLOCK_${index}__`, block);
            });
            
            return processedContent;
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
            return `<span style="font-size: 12px; font-weight: 600;">Bot</span>`;
        }
        
        getUserIcon() {
            return `<span style="font-size: 12px; font-weight: 600;">You</span>`;
        }
        
        getInfoIcon() {
            return `<img src="${window.helloChatbot.infoTooltipUrl}" width="16" height="16" alt="Info" />`;
        }
        
        getRefreshIcon() {
            return `<img src="${window.helloChatbot.resetChatUrl}" width="16" height="16" alt="New chat" />`;
        }
        
        getMinimizeIcon() {
            return `<img src="${window.helloChatbot.closeWindowUrl}" width="16" height="16" alt="Minimize" />`;
        }
        
        getSendIcon() {
            return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 2L11 13" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>`;
        }
        
        getBackIcon() {
            return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>`;
        }
    }
    
    /**
     * SessionManager Class - Handles chat session persistence
     */
    class SessionManager {
        constructor() {
            this.STORAGE_KEY = 'helloChatbotSessions';
            this.WIDGET_STATE_KEY = 'helloChatbotWidgetState';
            this.PAGE_LOAD_COUNT_KEY = 'helloChatbotPageLoadCount';
            this.MAX_SESSIONS = 50;
            this.WELCOME_TOOLTIP_MAX_LOADS = 10;
        }
        
        initialize() {
            this.cleanupOldSessions();
            const data = this.getSessionsData();
            if (!data.activeSessionId || !data.sessions[data.activeSessionId]) {
                this.createSession();
            }
        }
        
        // Widget state persistence methods
        getWidgetState() {
            try {
                const state = localStorage.getItem(this.WIDGET_STATE_KEY);
                if (state) {
                    const parsed = JSON.parse(state);
                    // Check if state is not too old (e.g., within last 24 hours)
                    const hoursSinceUpdate = (Date.now() - parsed.timestamp) / (1000 * 60 * 60);
                    if (hoursSinceUpdate < 24) {
                        return parsed;
                    }
                }
            } catch (e) {
                console.warn('Could not parse widget state:', e);
            }
            return { isOpen: false, timestamp: Date.now() };
        }
        
        saveWidgetState(isOpen) {
            try {
                const state = {
                    isOpen: isOpen,
                    timestamp: Date.now()
                };
                localStorage.setItem(this.WIDGET_STATE_KEY, JSON.stringify(state));
            } catch (e) {
                console.error('Could not save widget state:', e);
            }
        }
        
        // Page load tracking methods
        getPageLoadCount() {
            try {
                const count = localStorage.getItem(this.PAGE_LOAD_COUNT_KEY);
                return count ? parseInt(count, 10) : 0;
            } catch (e) {
                console.warn('Could not get page load count:', e);
                return 0;
            }
        }
        
        incrementPageLoadCount() {
            try {
                const currentCount = this.getPageLoadCount();
                const newCount = currentCount + 1;
                localStorage.setItem(this.PAGE_LOAD_COUNT_KEY, newCount.toString());
                return newCount;
            } catch (e) {
                console.error('Could not increment page load count:', e);
                return this.getPageLoadCount();
            }
        }
        
        shouldShowWelcomeTooltip() {
            const count = this.getPageLoadCount();
            return count <= this.WELCOME_TOOLTIP_MAX_LOADS;
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