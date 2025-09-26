<?php
/**
 * Admin functionality for Hello Chatbot
 */

if (!defined('ABSPATH')) {
    exit;
}

class Hello_Chatbot_Admin {
    
    public function __construct() {
        add_action('admin_menu', array($this, 'add_menu'));
        add_action('admin_init', array($this, 'register_settings'));
        add_action('admin_enqueue_scripts', array($this, 'enqueue_assets'));
        
        // AJAX handler for testing API connection
        add_action('wp_ajax_hello_chatbot_test_connection', array($this, 'test_api_connection'));
        
        // AJAX handlers for frontend chat messages (admin processes all AJAX requests)
        add_action('wp_ajax_hello_chatbot_send_message', array($this, 'handle_message'));
        add_action('wp_ajax_nopriv_hello_chatbot_send_message', array($this, 'handle_message'));
    }
    
    public function add_menu() {
        add_options_page(
            __('Hello Chatbot Settings', 'hello-chatbot'),
            __('Hello Chatbot', 'hello-chatbot'),
            'manage_options',
            'hello-chatbot',
            array($this, 'render_settings_page')
        );
    }
    
    public function register_settings() {
        register_setting('hello_chatbot_settings', 'chatbot_enabled');
        register_setting('hello_chatbot_settings', 'chatbot_api_endpoint');
        register_setting('hello_chatbot_settings', 'chatbot_api_token');
        register_setting('hello_chatbot_settings', 'chatbot_welcome_message');
        register_setting('hello_chatbot_settings', 'chatbot_position');
    }
    
    public function enqueue_assets($hook) {
        if ('settings_page_hello-chatbot' !== $hook) {
            return;
        }
        
        wp_enqueue_style(
            'hello-chatbot-admin',
            HELLO_CHATBOT_PLUGIN_URL . 'assets/css/admin.css',
            array(),
            HELLO_CHATBOT_VERSION
        );
        
        wp_enqueue_script(
            'hello-chatbot-admin',
            HELLO_CHATBOT_PLUGIN_URL . 'assets/js/admin.js',
            array('jquery'),
            HELLO_CHATBOT_VERSION,
            true
        );
        
        wp_localize_script('hello-chatbot-admin', 'helloChatbotAdmin', array(
            'ajaxUrl' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('hello_chatbot_admin_nonce')
        ));
    }
    
    public function render_settings_page() {
        ?>
        <div class="wrap">
            <h1><?php echo esc_html(get_admin_page_title()); ?></h1>
            
            <form method="post" action="options.php">
                <?php settings_fields('hello_chatbot_settings'); ?>
                
                <table class="form-table">
                    <tr>
                        <th scope="row">
                            <label for="chatbot_enabled"><?php _e('Enable Chatbot', 'hello-chatbot'); ?></label>
                        </th>
                        <td>
                            <input type="checkbox" id="chatbot_enabled" name="chatbot_enabled" 
                                   value="1" <?php checked(get_option('chatbot_enabled'), 1); ?> />
                            <p class="description"><?php _e('Enable or disable the chatbot widget on your website.', 'hello-chatbot'); ?></p>
                        </td>
                    </tr>
                    
                    <tr>
                        <th scope="row">
                            <label for="chatbot_api_endpoint"><?php _e('API Endpoint', 'hello-chatbot'); ?></label>
                        </th>
                        <td>
                            <input type="url" id="chatbot_api_endpoint" name="chatbot_api_endpoint" 
                                   value="<?php echo esc_attr(get_option('chatbot_api_endpoint')); ?>" 
                                   class="large-text" />
                            <p class="description"><?php _e('The KBot API endpoint URL.', 'hello-chatbot'); ?></p>
                        </td>
                    </tr>
                    
                    <tr>
                        <th scope="row">
                            <label for="chatbot_api_token"><?php _e('Bearer Token', 'hello-chatbot'); ?></label>
                        </th>
                        <td>
                            <input type="password" id="chatbot_api_token" name="chatbot_api_token" 
                                   value="<?php echo esc_attr(get_option('chatbot_api_token')); ?>" 
                                   class="large-text" />
                            <p class="description"><?php _e('Authentication token for the API.', 'hello-chatbot'); ?></p>
                            <button type="button" id="test-connection" class="button button-secondary">
                                <?php _e('Test Connection', 'hello-chatbot'); ?>
                            </button>
                            <span id="test-result"></span>
                        </td>
                    </tr>
                    
                    <tr>
                        <th scope="row">
                            <label for="chatbot_welcome_message"><?php _e('Welcome Message', 'hello-chatbot'); ?></label>
                        </th>
                        <td>
                            <textarea id="chatbot_welcome_message" name="chatbot_welcome_message" 
                                      rows="4" class="large-text"><?php echo esc_textarea(get_option('chatbot_welcome_message')); ?></textarea>
                            <p class="description"><?php _e('The initial message displayed when the chat opens.', 'hello-chatbot'); ?></p>
                        </td>
                    </tr>
                    
                    <tr>
                        <th scope="row">
                            <label for="chatbot_position"><?php _e('Widget Position', 'hello-chatbot'); ?></label>
                        </th>
                        <td>
                            <select id="chatbot_position" name="chatbot_position">
                                <option value="bottom-right" <?php selected(get_option('chatbot_position'), 'bottom-right'); ?>>
                                    <?php _e('Bottom Right', 'hello-chatbot'); ?>
                                </option>
                                <option value="bottom-left" <?php selected(get_option('chatbot_position'), 'bottom-left'); ?>>
                                    <?php _e('Bottom Left', 'hello-chatbot'); ?>
                                </option>
                            </select>
                            <p class="description"><?php _e('Choose where the chatbot widget appears on your site.', 'hello-chatbot'); ?></p>
                        </td>
                    </tr>
                </table>
                
                <?php submit_button(); ?>
            </form>
        </div>
        <?php
    }
    
    public function test_api_connection() {
        // Verify nonce
        if (!wp_verify_nonce($_POST['nonce'], 'hello_chatbot_admin_nonce')) {
            wp_send_json_error('Invalid nonce');
        }
        
        // Check permissions
        if (!current_user_can('manage_options')) {
            wp_send_json_error('Insufficient permissions');
        }
        
        $api_endpoint = get_option('chatbot_api_endpoint');
        $api_token = get_option('chatbot_api_token');
        
        if (empty($api_endpoint)) {
            wp_send_json_error('API endpoint not configured');
        }
        
        // Test the connection
        $headers = array(
            'Content-Type' => 'application/json',
            'Accept' => 'application/json'
        );
        
        if (!empty($api_token)) {
            $headers['Authorization'] = 'Bearer ' . $api_token;
        }
        
        $body = json_encode(array(
            'input' => array(
                'language' => 'en',
                'data' => array(
                    'question' => 'test connection',
                    'dataGroup' => 'Website Bot',
                    'parentConversationId' => null
                )
            ),
            'output' => array(
                'language' => 'en',
                'maxLength' => 400
            ),
            'useCaseMeta' => array(
                'context' => array(
                    'placeholders' => new stdClass(),
                    'PIIdata' => array(
                        'mask' => false
                    )
                ),
                'stream' => false
            )
        ));
        
        $response = wp_remote_post($api_endpoint, array(
            'headers' => $headers,
            'body' => $body,
            'timeout' => 10
        ));
        
        if (is_wp_error($response)) {
            wp_send_json_error('Connection failed: ' . $response->get_error_message());
        }
        
        $status_code = wp_remote_retrieve_response_code($response);
        
        if ($status_code === 200) {
            wp_send_json_success('Connection successful!');
        } else {
            wp_send_json_error('API returned status code: ' . $status_code);
        }
    }
    
    public function handle_message() {
        // Verify nonce
        if (!wp_verify_nonce($_POST['nonce'], 'hello_chatbot_nonce')) {
            wp_send_json_error('Invalid security token');
        }
        
        $message = sanitize_text_field($_POST['message']);
        $page_context = isset($_POST['page_context']) ? sanitize_text_field($_POST['page_context']) : '';
        
        if (empty($message)) {
            wp_send_json_error('Message cannot be empty');
        }
        
        // Get API settings
        $api_endpoint = get_option('chatbot_api_endpoint');
        $api_token = get_option('chatbot_api_token');
        
        if (empty($api_endpoint)) {
            wp_send_json_error('Chatbot is not configured');
        }
        
        // Prepare API request
        $headers = array(
            'Content-Type' => 'application/json',
            'Accept' => 'application/json'
        );
        
        if (!empty($api_token)) {
            $headers['Authorization'] = 'Bearer ' . $api_token;
        }
        
        // Build request body for KBot API (correct format)
        $request_body = array(
            'input' => array(
                'language' => 'en',
                'data' => array(
                    'question' => $message,
                    'dataGroup' => 'Website Bot',
                    'parentConversationId' => null
                )
            ),
            'output' => array(
                'language' => 'en',
                'maxLength' => 400
            ),
            'useCaseMeta' => array(
                'context' => array(
                    'placeholders' => new stdClass(),
                    'PIIdata' => array(
                        'mask' => false
                    )
                ),
                'stream' => false
            )
        );
        
        // Debug logging
        error_log('Hello Chatbot: API Request URL: ' . $api_endpoint);
        error_log('Hello Chatbot: API Request Body: ' . json_encode($request_body));
        
        $response = wp_remote_post($api_endpoint, array(
            'headers' => $headers,
            'body' => json_encode($request_body),
            'timeout' => 30
        ));
        
        if (is_wp_error($response)) {
            error_log('Hello Chatbot: WP Error - ' . $response->get_error_message());
            wp_send_json_error('Failed to connect to chatbot service');
        }
        
        $status_code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        
        // Debug logging
        error_log('Hello Chatbot: API Response Status: ' . $status_code);
        error_log('Hello Chatbot: API Response Body: ' . $body);
        
        if ($status_code !== 200) {
            wp_send_json_error('API returned status code: ' . $status_code . '. Response: ' . $body);
        }
        
        $data = json_decode($body, true);
        
        if (empty($data)) {
            wp_send_json_error('Invalid response from chatbot service');
        }
        
        // Extract answer and references from KBot API response
        $answer = $data['answer'] ?? 'I apologize, but I could not generate a response.';
        $references = array();
        
        // KBot API returns sources in 'sources' array, not 'referenceChunks'
        if (!empty($data['sources'])) {
            foreach ($data['sources'] as $source) {
                $references[] = array(
                    'title' => $source['dataSource'] ?? 'Reference',
                    'url' => $source['path'] ?? '#',
                    'description' => substr($source['content'] ?? '', 0, 150) . '...'
                );
            }
        }
        
        wp_send_json_success(array(
            'answer' => $answer,
            'references' => $references
        ));
    }
}