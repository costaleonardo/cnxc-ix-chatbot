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
                showTooltip: false, // Will be set in init() based on page load count and other conditions
                showInfoTooltip: false, // For info button tooltip
                showRefreshTooltip: false, // For refresh button tooltip
                showMinimizeTooltip: false, // For minimize button tooltip
                showBackTooltip: false // For back button tooltip
            };
            
            this.elements = {};
            this.messageDOMCache = new Map(); // Cache message DOM elements per session

            // Transition state management
            this.transitionState = {
                isTransitioning: false,
                pendingTimeouts: [],
                currentTransition: null
            };

            // Scroll behavior tracking
            this.scrollState = {
                userHasScrolledUp: false,
                isStreaming: false,
                scrollListener: null,
                streamingTimeout: null
            };

            // Detect if device is touch-capable
            this.isTouchDevice = this.detectTouchDevice();

            this.init();
        }

        /**
         * Detect if device supports touch events
         */
        detectTouchDevice() {
            return ('ontouchstart' in window) ||
                   (navigator.maxTouchPoints > 0) ||
                   (navigator.msMaxTouchPoints > 0);
        }

        /**
         * Detect if device is mobile or tablet (viewport width <= 1024px)
         * Used to determine scroll behavior for bot responses
         */
        isMobileOrTablet() {
            return window.innerWidth <= 1024;
        }

        /**
         * Lock body scroll to prevent background page scrolling on mobile
         * Preserves scroll position to prevent layout shift
         */
        lockBodyScroll() {
            // Store current scroll position
            const scrollY = window.scrollY || window.pageYOffset;

            // Apply scroll lock class to body
            document.body.classList.add('chatbot-open-no-scroll');

            // Store scroll position for restoration later
            document.body.style.top = `-${scrollY}px`;

            // Store the scroll position in a data attribute for unlocking
            document.body.setAttribute('data-chatbot-scroll-y', scrollY);
        }

        /**
         * Unlock body scroll and restore previous scroll position
         */
        unlockBodyScroll() {
            // Get stored scroll position
            const scrollY = document.body.getAttribute('data-chatbot-scroll-y');

            // Remove scroll lock class and inline styles
            document.body.classList.remove('chatbot-open-no-scroll');
            document.body.style.top = '';

            // Restore scroll position
            if (scrollY !== null) {
                window.scrollTo(0, parseInt(scrollY, 10));
                document.body.removeAttribute('data-chatbot-scroll-y');
            }
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
                    // Lock body scroll since widget is open
                    this.lockBodyScroll();
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
                            `<div class="chatbot-back-wrapper">
                                <button id="chatbot-back-btn" class="chatbot-back-btn" aria-label="View all chats">
                                    ${this.getBackIcon()}
                                </button>
                                <!-- Back Tooltip -->
                                <div id="chatbot-back-tooltip" class="chatbot-back-tooltip ${this.state.showBackTooltip ? 'show' : ''}">
                                    <p>Chat History</p>
                                </div>
                            </div>` : ''}
                        <div class="chatbot-title">
                            <span class="chatbot-tooltip-logo"> <img src="${window.helloChatbot.concentrixLogoUrl}" width="104px" /> </span>
                            ${this.state.viewMode === 'chat' && this.state.currentSession?.title !== 'New Chat' ? 
                                `<div class="chatbot-session-title">${this.state.currentSession.title}</div>` : ''}
                        </div>
                        <div class="chatbot-controls">
                            ${this.state.viewMode === 'chat' ? `
                                <div class="chatbot-info-wrapper">
                                    <button id="chatbot-info-btn" class="chatbot-control-btn" aria-label="Info">
                                        ${this.getInfoIcon()}
                                    </button>
                                    <!-- Info Tooltip -->
                                    <div id="chatbot-info-tooltip" class="chatbot-info-tooltip ${this.state.showInfoTooltip ? 'show' : ''}">
                                        <div class="chatbot-info-tooltip-header">
                                            <h3>Powered by iX Hello</h3>
                                        </div>
                                        <div class="chatbot-info-tooltip-content">
                                            <p>This chatbot is powered by iX Hello to provide you with the answers you need to know about Concentrix.</p>
                                            <a href="/ix-hello" target="_blank" class="chatbot-info-tooltip-link">Learn more about iX Hello</a>
                                        </div>
                                    </div>
                                </div>
                                <div class="chatbot-refresh-wrapper">
                                    <button id="chatbot-refresh-btn" class="chatbot-control-btn" aria-label="New chat">
                                        ${this.getRefreshIcon()}
                                    </button>
                                    <!-- Refresh Tooltip -->
                                    <div id="chatbot-refresh-tooltip" class="chatbot-refresh-tooltip ${this.state.showRefreshTooltip ? 'show' : ''}">
                                        <p>Restart conversation</p>
                                    </div>
                                </div>` : ''}
                            <div class="chatbot-minimize-wrapper">
                                <button id="chatbot-minimize-btn" class="chatbot-control-btn" aria-label="Minimize">
                                    ${this.getMinimizeIcon()}
                                </button>
                                <!-- Minimize Tooltip -->
                                <div id="chatbot-minimize-tooltip" class="chatbot-minimize-tooltip ${this.state.showMinimizeTooltip ? 'show' : ''}">
                                    <p>Close the chat window</p>
                                </div>
                            </div>
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
                            <div class="chatbot-input-footer"><span>Powered by</span> <span><a href="/ix-hello/">iX Hello</a></span></div>
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
                        <span class="chatbot-references-toggle">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M11.9998 13.2251L8.0998 9.32506C7.91647 9.14173 7.68314 9.05006 7.3998 9.05006C7.11647 9.05006 6.88314 9.14173 6.6998 9.32506C6.51647 9.50839 6.4248 9.74173 6.4248 10.0251C6.4248 10.3084 6.51647 10.5418 6.6998 10.7251L11.2998 15.3251C11.3998 15.4251 11.5081 15.4959 11.6248 15.5376C11.7415 15.5793 11.8665 15.6001 11.9998 15.6001C12.1331 15.6001 12.2581 15.5793 12.3748 15.5376C12.4915 15.4959 12.5998 15.4251 12.6998 15.3251L17.2998 10.7251C17.4831 10.5418 17.5748 10.3084 17.5748 10.0251C17.5748 9.74173 17.4831 9.50839 17.2998 9.32506C17.1165 9.14173 16.8831 9.05006 16.5998 9.05006C16.3165 9.05006 16.0831 9.14173 15.8998 9.32506L11.9998 13.2251Z" fill="currentColor"/>
                            </svg>
                        </span>
                    </div>
                    <div class="chatbot-references-list">
                        ${references.map(ref => {
                            // Use title if available, otherwise extract from URL
                            let displayTitle = ref.title || 'Reference';

                            // If title looks like a URL, try to extract a readable name
                            if (displayTitle.startsWith('http://') || displayTitle.startsWith('https://')) {
                                try {
                                    const url = new URL(displayTitle);
                                    // Extract pathname and clean it up
                                    let path = url.pathname.replace(/^\/|\/$/g, ''); // Remove leading/trailing slashes
                                    if (path) {
                                        // Convert hyphens/underscores to spaces and capitalize
                                        displayTitle = path.split('/').pop().replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                                    } else {
                                        // Use domain name if no path
                                        displayTitle = url.hostname.replace('www.', '');
                                    }
                                } catch (e) {
                                    // If URL parsing fails, use as-is
                                }
                            }

                            return `
                            <div class="chatbot-reference-item">
                                <span class="chatbot-reference-title">${displayTitle}</span>
                                <button class="chatbot-reference-button" onclick="window.open('${ref.url}', '_blank')" title="View now">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M5 21C4.45 21 3.97917 20.8042 3.5875 20.4125C3.19583 20.0208 3 19.55 3 19V5C3 4.45 3.19583 3.97917 3.5875 3.5875C3.97917 3.19583 4.45 3 5 3H11C11.2833 3 11.5208 3.09583 11.7125 3.2875C11.9042 3.47917 12 3.71667 12 4C12 4.28333 11.9042 4.52083 11.7125 4.7125C11.5208 4.90417 11.2833 5 11 5H5V19H19V13C19 12.7167 19.0958 12.4792 19.2875 12.2875C19.4792 12.0958 19.7167 12 20 12C20.2833 12 20.5208 12.0958 20.7125 12.2875C20.9042 12.4792 21 12.7167 21 13V19C21 19.55 20.8042 20.0208 20.4125 20.4125C20.0208 20.8042 19.55 21 19 21H5ZM19 6.4L10.4 15C10.2167 15.1833 9.98333 15.275 9.7 15.275C9.41667 15.275 9.18333 15.1833 9 15C8.81667 14.8167 8.725 14.5833 8.725 14.3C8.725 14.0167 8.81667 13.7833 9 13.6L17.6 5H15C14.7167 5 14.4792 4.90417 14.2875 4.7125C14.0958 4.52083 14 4.28333 14 4C14 3.71667 14.0958 3.47917 14.2875 3.2875C14.4792 3.09583 14.7167 3 15 3H20C20.2833 3 20.5208 3.09583 20.7125 3.2875C20.9042 3.47917 21 3.71667 21 4V9C21 9.28333 20.9042 9.52083 20.7125 9.7125C20.5208 9.90417 20.2833 10 20 10C19.7167 10 19.4792 9.90417 19.2875 9.7125C19.0958 9.52083 19 9.28333 19 9V6.4Z" fill="#003D5B"/>
                                    </svg>
                                </button>
                            </div>
                        `;
                        }).join('')}
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
                infoTooltip: document.getElementById('chatbot-info-tooltip'),
                refreshTooltip: document.getElementById('chatbot-refresh-tooltip'),
                minimizeTooltip: document.getElementById('chatbot-minimize-tooltip'),
                backTooltip: document.getElementById('chatbot-back-tooltip'),
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
            this.elements.minimizeBtn?.addEventListener('click', () => {
                this.hideMinimizeTooltip();
                this.closeChat();
            });
            this.elements.refreshBtn?.addEventListener('click', () => {
                this.hideRefreshTooltip();
                this.startNewChat();
            });
            
            // Info button and tooltip handlers
            const infoWrapper = document.querySelector('.chatbot-info-wrapper');
            if (infoWrapper) {
                if (this.isTouchDevice) {
                    // On touch devices, toggle tooltip on click
                    infoWrapper.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.toggleTooltip('info');
                    });
                } else {
                    // On desktop, show on hover
                    infoWrapper.addEventListener('mouseenter', () => this.showInfoTooltip());
                    infoWrapper.addEventListener('mouseleave', () => this.hideInfoTooltip());
                }
            }

            // Refresh button and tooltip handlers (desktop only)
            const refreshWrapper = document.querySelector('.chatbot-refresh-wrapper');
            if (refreshWrapper) {
                refreshWrapper.addEventListener('mouseenter', () => this.showRefreshTooltip());
                refreshWrapper.addEventListener('mouseleave', () => this.hideRefreshTooltip());
            }

            // Minimize button and tooltip handlers (desktop only)
            const minimizeWrapper = document.querySelector('.chatbot-minimize-wrapper');
            if (minimizeWrapper) {
                minimizeWrapper.addEventListener('mouseenter', () => this.showMinimizeTooltip());
                minimizeWrapper.addEventListener('mouseleave', () => this.hideMinimizeTooltip());
            }

            // Back button and tooltip handlers (desktop only)
            const backWrapper = document.querySelector('.chatbot-back-wrapper');
            if (backWrapper) {
                backWrapper.addEventListener('mouseenter', () => this.showBackTooltip());
                backWrapper.addEventListener('mouseleave', () => this.hideBackTooltip());
            }

            // Back button (to switch to list view)
            this.elements.backBtn?.addEventListener('click', () => {
                this.hideBackTooltip();
                this.switchToListView();
            });
            
            // Form submission
            this.elements.form?.addEventListener('submit', (e) => this.handleSubmit(e));
            
            // Input auto-resize and send button state
            this.elements.input?.addEventListener('input', () => {
                this.autoResizeInput();
                this.updateSendButtonState();
            });
            
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
            
            // Tooltip click - open chatbot when clicking anywhere on tooltip
            this.elements.tooltip?.addEventListener('click', (e) => {
                // Don't open chat if clicking the close button
                if (!e.target.closest('.chatbot-tooltip-close')) {
                    this.state.showTooltip = false;
                    this.elements.tooltip.classList.remove('show');
                    if (!this.state.isOpen) {
                        this.toggleChat();
                    }
                }
            });

            // Tooltip close button
            document.querySelector('.chatbot-tooltip-close')?.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent triggering tooltip click
                this.state.showTooltip = false;
                this.elements.tooltip.classList.remove('show');
            });

            // Document-level click handler to close info tooltip when clicking outside (mobile)
            if (this.isTouchDevice) {
                document.addEventListener('click', (e) => {
                    if (this.state.showInfoTooltip) {
                        const clickedInsideWrapper = e.target.closest('.chatbot-info-wrapper');
                        const clickedInsideTooltip = e.target.closest('.chatbot-info-tooltip');

                        // If clicked outside, hide info tooltip
                        if (!clickedInsideWrapper && !clickedInsideTooltip) {
                            this.hideInfoTooltip();
                        }
                    }
                });
            }

            // Note: Scroll listener is now attached dynamically when streaming starts
            // and removed when streaming ends to prevent mobile touch interference

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

                        // Hide all quick action buttons after message is sent
                        this.hideQuickActions();

                        // Re-enable all action buttons after processing (in case they're still visible)
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
                // Reset scroll state when opening to ensure clean state
                this.resetScrollState();
                this.scrollToBottom();
                // Lock body scroll to prevent background page scrolling
                this.lockBodyScroll();
            } else {
                // Unlock body scroll when closing
                this.unlockBodyScroll();
            }
        }
        
        closeChat() {
            // Cancel any ongoing transitions first
            this.cancelPendingTransitions();

            // Reset scroll state when closing
            this.resetScrollState();

            // Clean up session card states if in list view
            if (this.state.viewMode === 'list') {
                this.cleanupSessionCardStates();
            }

            this.state.isOpen = false;
            this.elements.window.classList.remove('open', 'extended');

            // Show the open chat button again
            if (this.elements.button) {
                this.elements.button.style.display = 'block';
            }

            // Unlock body scroll when closing
            this.unlockBodyScroll();

            // Save the closed state
            this.sessionManager.saveWidgetState(false);
        }
        
        showInfoTooltip() {
            this.state.showInfoTooltip = true;
            if (this.elements.infoTooltip) {
                this.elements.infoTooltip.classList.add('show');
            }
        }
        
        hideInfoTooltip() {
            this.state.showInfoTooltip = false;
            if (this.elements.infoTooltip) {
                this.elements.infoTooltip.classList.remove('show');
            }
        }

        showRefreshTooltip() {
            this.state.showRefreshTooltip = true;
            if (this.elements.refreshTooltip) {
                this.elements.refreshTooltip.classList.add('show');
            }
        }

        hideRefreshTooltip() {
            this.state.showRefreshTooltip = false;
            if (this.elements.refreshTooltip) {
                this.elements.refreshTooltip.classList.remove('show');
            }
        }

        showMinimizeTooltip() {
            this.state.showMinimizeTooltip = true;
            if (this.elements.minimizeTooltip) {
                this.elements.minimizeTooltip.classList.add('show');
            }
        }

        hideMinimizeTooltip() {
            this.state.showMinimizeTooltip = false;
            if (this.elements.minimizeTooltip) {
                this.elements.minimizeTooltip.classList.remove('show');
            }
        }

        showBackTooltip() {
            this.state.showBackTooltip = true;
            if (this.elements.backTooltip) {
                this.elements.backTooltip.classList.add('show');
            }
        }

        hideBackTooltip() {
            this.state.showBackTooltip = false;
            if (this.elements.backTooltip) {
                this.elements.backTooltip.classList.remove('show');
            }
        }

        /**
         * Hide all tooltips - useful for mobile when tapping outside
         */
        hideAllTooltips() {
            this.hideInfoTooltip();
            this.hideRefreshTooltip();
            this.hideMinimizeTooltip();
            this.hideBackTooltip();
        }

        /**
         * Toggle tooltip visibility - used on mobile devices
         */
        toggleTooltip(type) {
            // Hide all other tooltips first
            const tooltips = ['info', 'refresh', 'minimize', 'back'];
            tooltips.forEach(t => {
                if (t !== type) {
                    const methodName = `hide${t.charAt(0).toUpperCase() + t.slice(1)}Tooltip`;
                    if (this[methodName]) {
                        this[methodName]();
                    }
                }
            });

            // Toggle the requested tooltip
            const showKey = `show${type.charAt(0).toUpperCase() + type.slice(1)}Tooltip`;
            const isCurrentlyShown = this.state[showKey];

            if (isCurrentlyShown) {
                const methodName = `hide${type.charAt(0).toUpperCase() + type.slice(1)}Tooltip`;
                this[methodName]();
            } else {
                const methodName = `show${type.charAt(0).toUpperCase() + type.slice(1)}Tooltip`;
                this[methodName]();
            }
        }

        startNewChat() {
            if (confirm('Start a new conversation?')) {
                // Reset scroll state for new chat
                this.resetScrollState();

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
            this.updateSendButtonState();

            // Hide quick actions when any message is sent
            this.hideQuickActions();

            // Send message
            await this.sendMessage(message);
        }
        
        async sendMessage(text) {
            // Reset scroll state before starting new message
            // This ensures we start with clean state for each message
            this.resetScrollState();

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
                // Update send button state when message sending completes
                this.updateSendButtonState();
            }
        }
        
        /**
         * Send message using client-side fake streaming for WP Engine compatibility
         * Fetches complete response and animates it appearing word-by-word
         */
        async sendStreamingMessage(text) {
            try {
                // Fetch complete response from server (no streaming)
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

                if (!data.success) {
                    console.error('Request failed:', data.data);
                    return false;
                }

                // Got complete response - now simulate streaming client-side
                const fullText = data.data.answer;
                const references = data.data.references || [];

                // Create assistant message that will be updated with fake chunks
                const assistantMsgId = 'msg-' + Date.now();
                const assistantMsg = {
                    id: assistantMsgId,
                    role: 'assistant',
                    content: '',
                    timestamp: this.getCurrentTime()
                };

                // Add message to state and create DOM element
                this.addMessage(assistantMsg);
                this.setLoadingIndicator(false);
                const messageElement = this.appendMessage(assistantMsg);
                const contentElement = messageElement?.querySelector('.chatbot-message-content');
                const textElement = contentElement?.querySelector('.chatbot-message-text');

                if (!textElement) {
                    console.error('Could not find text element for streaming');
                    return false;
                }

                // Scroll behavior: Mobile/tablet shows top of message, desktop scrolls to bottom
                if (this.isMobileOrTablet()) {
                    this.scrollToShowMessage(messageElement);
                } else {
                    this.scrollToBottom();
                }

                // Animate text appearing word by word
                const words = fullText.split(' ');
                let accumulatedText = '';

                // Mark that streaming has started
                this.scrollState.isStreaming = true;
                this.scrollState.userHasScrolledUp = false;

                // Attach scroll listener for this streaming session
                this.attachScrollListener();

                // Update send button state when streaming starts
                this.updateSendButtonState();

                // Failsafe: Auto-reset streaming state after 30 seconds
                // This prevents permanently stuck states if something goes wrong
                this.scrollState.streamingTimeout = setTimeout(() => {
                    console.warn('Streaming timeout reached - auto-resetting scroll state');
                    this.resetScrollState();
                    this.updateSendButtonState();
                }, 30000);

                for (let i = 0; i < words.length; i++) {
                    accumulatedText += (i > 0 ? ' ' : '') + words[i];

                    // Update message content
                    assistantMsg.content = accumulatedText;
                    this.updateMessage(assistantMsgId, assistantMsg);

                    // Update DOM with formatted content
                    textElement.innerHTML = this.formatMessage(accumulatedText);

                    // Smart scroll: Desktop auto-scrolls during streaming, mobile/tablet doesn't
                    if (!this.isMobileOrTablet()) {
                        this.scrollToBottom();
                    }

                    // Wait 50ms before showing next word (simulate streaming speed)
                    await new Promise(resolve => setTimeout(resolve, 50));
                }

                // After text completes, add references if available
                if (references && references.length > 0) {
                    // Add references to the message object
                    assistantMsg.references = references;
                    this.updateMessage(assistantMsgId, assistantMsg);

                    // Add references HTML to DOM
                    const referencesHTML = this.buildReferencesHTML(references);
                    textElement.insertAdjacentHTML('afterend', referencesHTML);

                    // Only scroll on desktop, mobile/tablet users can scroll manually
                    if (!this.isMobileOrTablet()) {
                        this.scrollToBottom();
                    }
                }

                // Final scroll: Desktop scrolls to bottom, mobile/tablet stays at current position
                if (!this.isMobileOrTablet()) {
                    this.scrollToBottom();
                }

                // Streaming finished - reset state (this will detach the scroll listener)
                this.resetScrollState();

                this.state.isLoading = false;

                // Update send button state when streaming completes
                this.updateSendButtonState();

                return true;

            } catch (error) {
                console.error('Fake streaming error:', error);
                this.state.isLoading = false;
                this.setLoadingIndicator(false);
                // Reset streaming state on error (properly cleans up listener and timeout)
                this.resetScrollState();
                // Update send button state after error
                this.updateSendButtonState();
                return false;
            }
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
                    this.sessionManager.updateSession(session.id, { messages: session.messages });
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

            // Conditional scroll: Desktop scrolls to bottom, mobile/tablet for user messages only
            if (!this.isMobileOrTablet()) {
                // Desktop: always scroll to bottom
                this.scrollToBottom();
            } else if (message.role === 'user') {
                // Mobile/tablet: scroll to bottom for user messages to show their question
                this.scrollToBottom();
            }
            // Mobile/tablet bot messages: no scroll here, handled in sendStreamingMessage()

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

            // Update send button state when loading state changes
            this.updateSendButtonState();
        }
        
        /**
         * Cancel any ongoing transitions and clean up timeouts
         */
        cancelPendingTransitions() {
            // Clear all pending timeouts
            this.transitionState.pendingTimeouts.forEach(timeoutId => {
                clearTimeout(timeoutId);
            });
            this.transitionState.pendingTimeouts = [];
            
            // Remove transitioning class if present
            const container = this.elements.window;
            if (container) {
                container.classList.remove('transitioning');
                container.style.opacity = '';
            }
            
            // Reset transition state
            this.transitionState.isTransitioning = false;
            this.transitionState.currentTransition = null;
        }
        
        /**
         * Check if widget is currently transitioning
         */
        isTransitioning() {
            return this.transitionState.isTransitioning;
        }
        
        /**
         * Clean up session card states to prevent visual lag
         */
        cleanupSessionCardStates() {
            const sessionCards = document.querySelectorAll('.chatbot-session-card');
            sessionCards.forEach(card => {
                // Force remove hover states and transitions
                card.style.transform = '';
                card.style.boxShadow = '';
            });
        }

        /**
         * Smooth transition between views without jarring rebuilds
         */
        transitionToView(newViewMode, sessionId = null) {
            if (this.state.viewMode === newViewMode) return;
            
            const container = this.elements.window;
            if (!container) return;
            
            // Cancel any existing transitions
            this.cancelPendingTransitions();
            
            // Mark as transitioning
            this.transitionState.isTransitioning = true;
            this.transitionState.currentTransition = newViewMode;
            
            // Add transitioning class for smooth fade
            container.classList.add('transitioning');
            container.style.opacity = '0.95';
            
            // Track the timeout
            const transitionTimeout = setTimeout(() => {
                // Load session data BEFORE updating viewMode to avoid race condition
                if (newViewMode === 'chat' && sessionId && sessionId !== this.state.currentSession?.id) {
                    const session = this.sessionManager.setActiveSession(sessionId);
                    if (session) {
                        this.state.currentSession = session;
                        this.state.messages = session.messages || [];
                    }
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
                    } else {
                        // Messages container exists, but we need to update its content with current session messages
                        existingMessages.innerHTML = this.buildMessagesHTML();
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
                                <div class="chatbot-input-footer"><span>Powered by</span> <span><a href="/ix-hello/">iX Hello</a></span></div>
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
                    this.elements.input?.addEventListener('input', () => {
                        this.autoResizeInput();
                        this.updateSendButtonState();
                    });
                    this.elements.input?.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            this.handleSubmit(e);
                        }
                    });

                    // CRITICAL: Reattach scroll listener after DOM replacement
                    this.attachScrollListener();

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
                        <div class="chatbot-minimize-wrapper">
                            <button id="chatbot-minimize-btn" class="chatbot-control-btn" aria-label="Minimize">
                                ${this.getMinimizeIcon()}
                            </button>
                            <!-- Minimize Tooltip -->
                            <div id="chatbot-minimize-tooltip" class="chatbot-minimize-tooltip ${this.state.showMinimizeTooltip ? 'show' : ''}">
                                <p>Close the chat window</p>
                            </div>
                        </div>
                    `;
                } else {
                    // Add back button if not present and there are sessions
                    if (!backBtn && this.state.sessions.length > 0) {
                        const backBtnHTML = `
                            <div class="chatbot-back-wrapper">
                                <button id="chatbot-back-btn" class="chatbot-back-btn" aria-label="View all chats">
                                    ${this.getBackIcon()}
                                </button>
                                <!-- Back Tooltip -->
                                <div id="chatbot-back-tooltip" class="chatbot-back-tooltip ${this.state.showBackTooltip ? 'show' : ''}">
                                    <p>Chat History</p>
                                </div>
                            </div>
                        `;
                        container.querySelector('.chatbot-header').insertAdjacentHTML('afterbegin', backBtnHTML);
                    }
                    // Add control buttons for chat view
                    controls.innerHTML = `
                        <div class="chatbot-info-wrapper">
                            <button id="chatbot-info-btn" class="chatbot-control-btn" aria-label="Info">
                                ${this.getInfoIcon()}
                            </button>
                            <!-- Info Tooltip -->
                            <div id="chatbot-info-tooltip" class="chatbot-info-tooltip ${this.state.showInfoTooltip ? 'show' : ''}">
                                <div class="chatbot-info-tooltip-header">
                                    <h3>Powered by iX Hello</h3>
                                </div>
                                <div class="chatbot-info-tooltip-content">
                                    <p>This chatbot is powered by iX Hello to provide you with the answers you need to know about Concentrix.</p>
                                    <a href="/ix-hello" target="_blank" class="chatbot-info-tooltip-link">Learn more about iX Hello</a>
                                </div>
                            </div>
                        </div>
                        <div class="chatbot-refresh-wrapper">
                            <button id="chatbot-refresh-btn" class="chatbot-control-btn" aria-label="New chat">
                                ${this.getRefreshIcon()}
                            </button>
                            <!-- Refresh Tooltip -->
                            <div id="chatbot-refresh-tooltip" class="chatbot-refresh-tooltip ${this.state.showRefreshTooltip ? 'show' : ''}">
                                <p>Restart conversation</p>
                            </div>
                        </div>
                        <div class="chatbot-minimize-wrapper">
                            <button id="chatbot-minimize-btn" class="chatbot-control-btn" aria-label="Minimize">
                                ${this.getMinimizeIcon()}
                            </button>
                            <!-- Minimize Tooltip -->
                            <div id="chatbot-minimize-tooltip" class="chatbot-minimize-tooltip ${this.state.showMinimizeTooltip ? 'show' : ''}">
                                <p>Close the chat window</p>
                            </div>
                        </div>
                    `;
                }
                
                // Update cached elements
                this.elements.infoTooltip = document.getElementById('chatbot-info-tooltip');
                this.elements.refreshTooltip = document.getElementById('chatbot-refresh-tooltip');
                this.elements.minimizeTooltip = document.getElementById('chatbot-minimize-tooltip');
                this.elements.backTooltip = document.getElementById('chatbot-back-tooltip');

                // Reattach header button listeners
                document.getElementById('chatbot-minimize-btn')?.addEventListener('click', () => {
                    this.hideMinimizeTooltip();
                    this.closeChat();
                });
                document.getElementById('chatbot-back-btn')?.addEventListener('click', () => {
                    this.hideBackTooltip();
                    this.switchToListView();
                });
                document.getElementById('chatbot-refresh-btn')?.addEventListener('click', () => {
                    this.hideRefreshTooltip();
                    this.startNewChat();
                });

                // Info button and tooltip handlers
                const infoWrapper = document.querySelector('.chatbot-info-wrapper');
                if (infoWrapper) {
                    if (this.isTouchDevice) {
                        // On touch devices, toggle tooltip on click
                        infoWrapper.addEventListener('click', (e) => {
                            e.stopPropagation();
                            this.toggleTooltip('info');
                        });
                    } else {
                        // On desktop, show on hover
                        infoWrapper.addEventListener('mouseenter', () => this.showInfoTooltip());
                        infoWrapper.addEventListener('mouseleave', () => this.hideInfoTooltip());
                    }
                }

                // Refresh button and tooltip handlers (desktop only)
                const refreshWrapper = document.querySelector('.chatbot-refresh-wrapper');
                if (refreshWrapper) {
                    refreshWrapper.addEventListener('mouseenter', () => this.showRefreshTooltip());
                    refreshWrapper.addEventListener('mouseleave', () => this.hideRefreshTooltip());
                }

                // Minimize button and tooltip handlers (desktop only)
                const minimizeWrapper = document.querySelector('.chatbot-minimize-wrapper');
                if (minimizeWrapper) {
                    minimizeWrapper.addEventListener('mouseenter', () => this.showMinimizeTooltip());
                    minimizeWrapper.addEventListener('mouseleave', () => this.hideMinimizeTooltip());
                }

                // Back button and tooltip handlers (desktop only)
                const backWrapper = document.querySelector('.chatbot-back-wrapper');
                if (backWrapper) {
                    backWrapper.addEventListener('mouseenter', () => this.showBackTooltip());
                    backWrapper.addEventListener('mouseleave', () => this.hideBackTooltip());
                }

                // Complete transition
                container.style.opacity = '1';
                const cleanupTimeout = setTimeout(() => {
                    container.classList.remove('transitioning');
                    
                    // Clear transition state
                    this.transitionState.isTransitioning = false;
                    this.transitionState.currentTransition = null;
                    
                    // Remove this timeout from tracking
                    const index = this.transitionState.pendingTimeouts.indexOf(cleanupTimeout);
                    if (index > -1) {
                        this.transitionState.pendingTimeouts.splice(index, 1);
                    }
                }, 50);
                
                // Track the cleanup timeout
                this.transitionState.pendingTimeouts.push(cleanupTimeout);
                
                // Remove the main timeout from tracking as it's completed
                const index = this.transitionState.pendingTimeouts.indexOf(transitionTimeout);
                if (index > -1) {
                    this.transitionState.pendingTimeouts.splice(index, 1);
                }
            }, 30);
            
            // Track the main timeout
            this.transitionState.pendingTimeouts.push(transitionTimeout);
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
        
        /**
         * Check if user is scrolled near the bottom of messages
         */
        isScrolledToBottom() {
            if (!this.elements.messages) return true;
            const threshold = 100; // pixels from bottom
            const position = this.elements.messages.scrollTop + this.elements.messages.clientHeight;
            const height = this.elements.messages.scrollHeight;
            return position >= height - threshold;
        }

        /**
         * Scroll to bottom only if user hasn't manually scrolled up
         * or if force is true
         */
        scrollToBottom(force = false) {
            if (!this.elements.messages) return;

            // During streaming, only auto-scroll if user is already at bottom
            if (this.scrollState.isStreaming && !force) {
                if (this.isScrolledToBottom()) {
                    this.elements.messages.scrollTop = this.elements.messages.scrollHeight;
                }
            } else {
                // Not streaming or forced - always scroll
                this.elements.messages.scrollTop = this.elements.messages.scrollHeight;
            }
        }

        /**
         * Scroll to show a specific message near the top of the viewport
         * Used on mobile/tablet to show the start of bot responses
         * @param {HTMLElement} messageElement - The message element to scroll to
         */
        scrollToShowMessage(messageElement) {
            if (!this.elements.messages || !messageElement) return;

            // Get the position of the message relative to the messages container
            const containerRect = this.elements.messages.getBoundingClientRect();
            const messageRect = messageElement.getBoundingClientRect();

            // Calculate the offset needed to position message near top (20px margin)
            const targetOffset = 20;
            const scrollOffset = messageRect.top - containerRect.top + this.elements.messages.scrollTop - targetOffset;

            // Smooth scroll to the message
            this.elements.messages.scrollTop = scrollOffset;
        }

        /**
         * Reset scroll state to initial values
         * Call this before starting new operations or when recovering from errors
         */
        resetScrollState() {
            this.scrollState.isStreaming = false;
            this.scrollState.userHasScrolledUp = false;

            // Clear any streaming timeout
            if (this.scrollState.streamingTimeout) {
                clearTimeout(this.scrollState.streamingTimeout);
                this.scrollState.streamingTimeout = null;
            }

            // CRITICAL: Remove scroll listener when not streaming
            // This prevents interference with native mobile scrolling
            if (this.scrollState.scrollListener && this.elements.messages) {
                this.elements.messages.removeEventListener('scroll', this.scrollState.scrollListener);
                this.scrollState.scrollListener = null;
            }
        }

        /**
         * Attach scroll event listener to messages container
         * Must be called whenever messages container is recreated/replaced
         */
        attachScrollListener() {
            if (!this.elements.messages) return;

            // Remove existing listener if any (prevents duplicates)
            if (this.scrollState.scrollListener) {
                this.elements.messages.removeEventListener('scroll', this.scrollState.scrollListener);
            }

            // Create and store the listener function
            this.scrollState.scrollListener = () => {
                // Only track scroll during streaming
                if (this.scrollState.isStreaming) {
                    this.scrollState.userHasScrolledUp = !this.isScrolledToBottom();
                }
            };

            // Attach the listener
            this.elements.messages.addEventListener('scroll', this.scrollState.scrollListener);
        }
        
        autoResizeInput() {
            const input = this.elements.input;
            input.style.height = 'auto';
            input.style.height = Math.min(input.scrollHeight, 100) + 'px';
        }

        updateSendButtonState() {
            const sendBtn = document.querySelector('.chatbot-send-btn');
            if (!sendBtn) return;

            const hasText = this.elements.input && this.elements.input.value.trim().length > 0;
            const isBusy = this.state.isLoading || this.scrollState.isStreaming;

            // Disable button when bot is thinking or streaming
            if (isBusy) {
                sendBtn.disabled = true;
                sendBtn.classList.remove('enabled');
            } else if (hasText) {
                sendBtn.disabled = false;
                sendBtn.classList.add('enabled');
            } else {
                sendBtn.disabled = false;
                sendBtn.classList.remove('enabled');
            }
        }

        hideQuickActions() {
            const actionContainers = document.querySelectorAll('.chatbot-actions');
            actionContainers.forEach(container => {
                container.style.display = 'none';
            });
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
                    // If we're in a list and hit a blank line, keep the list open
                    // Only close the list if we hit actual content that's not a list item
                    if (line.trim().length === 0) {
                        // Blank line - preserve it but don't close the list
                        processedLines.push(line);
                    } else {
                        // Non-blank, non-list line - close any open list
                        if (inList) {
                            processedLines.push(`</${listType}>`);
                            inList = false;
                            listType = null;
                        }
                        processedLines.push(line);
                    }
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
                    // Check if this paragraph contains block elements (lists, headers, etc.)
                    const hasBlockElements = /<(h[1-6]|ul|ol|li|pre|blockquote|div)>/i.test(paragraph);
                    if (hasBlockElements) {
                        // Don't collapse newlines for block elements - they need structure preserved
                        return paragraph.trim();
                    } else {
                        // Regular text - collapse newlines and wrap in <p>
                        const cleanParagraph = paragraph.replace(/\n/g, ' ').trim();
                        return cleanParagraph ? `<p>${cleanParagraph}</p>` : '';
                    }
                }).filter(p => p.length > 0).join('');
            } else if (paragraphs.length === 1) {
                // Single paragraph - wrap in <p> if it doesn't already contain block elements
                const hasBlockElements = /<(h[1-6]|ul|ol|li|pre|blockquote|div)>/i.test(processedContent);
                if (!hasBlockElements) {
                    const cleanContent = processedContent.replace(/\n/g, ' ').trim();
                    processedContent = cleanContent ? `<p>${cleanContent}</p>` : '';
                } else {
                    // Contains block elements - don't collapse newlines, just trim
                    processedContent = processedContent.trim();
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