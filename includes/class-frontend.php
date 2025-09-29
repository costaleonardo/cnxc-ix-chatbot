<?php
/**
 * Frontend functionality for Hello Chatbot
 */

if (!defined('ABSPATH')) {
    exit;
}

class Hello_Chatbot_Frontend {
    
    public function __construct() {
        add_action('wp_enqueue_scripts', array($this, 'enqueue_assets'));
        add_action('wp_footer', array($this, 'render_chatbot'));
        
        // Note: AJAX handlers are now registered in the admin class since
        // admin-ajax.php requests are processed in admin context
    }
    
    public function enqueue_assets() {
        if (!hello_chatbot_is_enabled()) {
            return;
        }
        
        // Enqueue CSS
        wp_enqueue_style(
            'hello-chatbot',
            HELLO_CHATBOT_PLUGIN_URL . 'assets/css/chatbot.css',
            array(),
            HELLO_CHATBOT_VERSION
        );
        
        // Enqueue vanilla JavaScript
        wp_enqueue_script(
            'hello-chatbot',
            HELLO_CHATBOT_PLUGIN_URL . 'assets/js/chatbot.js',
            array(),
            HELLO_CHATBOT_VERSION,
            true
        );
        
        // Localize script with settings
        wp_localize_script('hello-chatbot', 'helloChatbot', array(
            'ajaxUrl' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('hello_chatbot_nonce'),
            'position' => get_option('chatbot_position', 'bottom-right'),
            'welcomeMessage' => get_option('chatbot_welcome_message'),
            'chatIconUrl' => HELLO_CHATBOT_PLUGIN_URL . 'assets/img/chat-icon.svg',
            'enableStreaming' => true, // Enable streaming responses by default
            'strings' => array(
                'thinking' => __('Thinking...', 'hello-chatbot'),
                'error' => __('Sorry, I encountered an error. Please try again.', 'hello-chatbot'),
                'offline' => __('Chat is currently unavailable.', 'hello-chatbot'),
                'typeMessage' => __('Type a message', 'hello-chatbot'),
                'send' => __('Send', 'hello-chatbot'),
                'newChat' => __('New Chat', 'hello-chatbot'),
                'references' => __('References', 'hello-chatbot'),
                'chatHistory' => __('Chat History', 'hello-chatbot'),
                'concentrixBot' => __('concentrix Bot', 'hello-chatbot')
            )
        ));
    }
    
    public function render_chatbot() {
        if (!hello_chatbot_is_enabled()) {
            return;
        }
        
        $position = get_option('chatbot_position', 'bottom-right');
        ?>
        <!-- Hello Chatbot Widget -->
        <div id="hello-chatbot-widget" data-position="<?php echo esc_attr($position); ?>"></div>
        <?php
    }
}