<?php
/**
 * Plugin Name: Hello Chatbot
 * Plugin URI: https://concentrix.com/
 * Description: A lightweight AI-powered chatbot for WordPress - no React required
 * Version: 2.0.0
 * Author: Concentrix
 * License: GPL v2 or later
 * Text Domain: hello-chatbot
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Define plugin constants
define('HELLO_CHATBOT_VERSION', '2.0.0');
define('HELLO_CHATBOT_PLUGIN_URL', plugin_dir_url(__FILE__));
define('HELLO_CHATBOT_PLUGIN_PATH', plugin_dir_path(__FILE__));
define('HELLO_CHATBOT_PLUGIN_BASENAME', plugin_basename(__FILE__));

/**
 * Main plugin class
 */
class Hello_Chatbot {
    
    private static $instance = null;
    
    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    private function __construct() {
        // Load dependencies
        $this->load_dependencies();
        
        // Initialize hooks
        add_action('init', array($this, 'init'));
        
        // Activation/deactivation hooks
        register_activation_hook(__FILE__, array($this, 'activate'));
        register_deactivation_hook(__FILE__, array($this, 'deactivate'));
    }
    
    private function load_dependencies() {
        require_once HELLO_CHATBOT_PLUGIN_PATH . 'includes/class-token-manager.php';
        require_once HELLO_CHATBOT_PLUGIN_PATH . 'includes/class-admin.php';
        require_once HELLO_CHATBOT_PLUGIN_PATH . 'includes/class-frontend.php';
    }
    
    public function init() {
        // Load text domain for translations
        load_plugin_textdomain('hello-chatbot', false, dirname(HELLO_CHATBOT_PLUGIN_BASENAME) . '/languages');
        
        // Initialize admin class (handles AJAX for both admin and frontend)
        new Hello_Chatbot_Admin();
        
        // Initialize frontend if not in admin
        if (!is_admin()) {
            new Hello_Chatbot_Frontend();
        }
    }
    
    public function activate() {
        // Set default options
        $defaults = array(
            'chatbot_enabled' => true,
            'chatbot_api_endpoint' => 'https://kbot-preprod.concentrix.com/api/v1/kb/ask?appId=aab4e255-2a10-4723-95fd-d2e77a24a545',
            'chatbot_api_token' => '',
            'chatbot_welcome_message' => 'Welcome to Concentrix Bot. How can I help you today?',
            'chatbot_position' => 'bottom-right',
            // OAuth2 configuration
            'chatbot_oauth_client_id' => '9439f615-fe1b-4af1-9c5c-bf7bd7a82774',
            'chatbot_oauth_client_secret' => '',
            'chatbot_oauth_tenant_id' => '599e51d6-2f8c-4347-8e59-1f795a51a98c',
            'chatbot_oauth_scope' => '9439f615-fe1b-4af1-9c5c-bf7bd7a82774/.default',
            'chatbot_oauth_endpoint' => 'https://login.microsoftonline.com/599e51d6-2f8c-4347-8e59-1f795a51a98c/oauth2/v2.0/token',
            'chatbot_token_expires_at' => 0,
            'chatbot_use_oauth' => true // Flag to enable OAuth2 token refresh
        );
        
        foreach ($defaults as $key => $value) {
            if (get_option($key) === false) {
                add_option($key, $value);
            }
        }
    }
    
    public function deactivate() {
        // Clean up if needed
    }
}

// Helper functions
function hello_chatbot_is_enabled() {
    return (bool) get_option('chatbot_enabled', true);
}

function hello_chatbot_get_option($key, $default = '') {
    return get_option($key, $default);
}

// Initialize plugin
Hello_Chatbot::get_instance();