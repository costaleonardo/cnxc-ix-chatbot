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
        
        // AJAX handler for testing OAuth2 connection
        add_action('wp_ajax_hello_chatbot_test_oauth', array($this, 'test_oauth_connection'));
        
        // AJAX handler for refreshing OAuth2 token
        add_action('wp_ajax_hello_chatbot_refresh_token', array($this, 'refresh_token_ajax'));
        
        // Debug endpoint to check settings
        add_action('wp_ajax_hello_chatbot_debug_settings', array($this, 'debug_settings'));
        
        // AJAX handlers for frontend chat messages (admin processes all AJAX requests)
        add_action('wp_ajax_hello_chatbot_send_message', array($this, 'handle_message'));
        add_action('wp_ajax_nopriv_hello_chatbot_send_message', array($this, 'handle_message'));
        
        // AJAX handlers for streaming messages
        add_action('wp_ajax_hello_chatbot_stream_message', array($this, 'handle_stream_message'));
        add_action('wp_ajax_nopriv_hello_chatbot_stream_message', array($this, 'handle_stream_message'));
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
        
        // OAuth2 settings
        register_setting('hello_chatbot_settings', 'chatbot_use_oauth');
        register_setting('hello_chatbot_settings', 'chatbot_oauth_client_id');
        register_setting('hello_chatbot_settings', 'chatbot_oauth_client_secret');
        register_setting('hello_chatbot_settings', 'chatbot_oauth_tenant_id');
        register_setting('hello_chatbot_settings', 'chatbot_oauth_scope');
        register_setting('hello_chatbot_settings', 'chatbot_oauth_endpoint');
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
                            <label for="chatbot_use_oauth"><?php _e('Use OAuth2 Auto-Refresh', 'hello-chatbot'); ?></label>
                        </th>
                        <td>
                            <input type="checkbox" id="chatbot_use_oauth" name="chatbot_use_oauth" 
                                   value="1" <?php checked(get_option('chatbot_use_oauth'), 1); ?> />
                            <p class="description"><?php _e('Enable automatic token refresh using OAuth2 client credentials.', 'hello-chatbot'); ?></p>
                            <div id="oauth-status" style="margin-top: 10px;">
                                <?php 
                                $token_manager = Hello_Chatbot_Token_Manager::get_instance();
                                $token_status = $token_manager->get_token_status();
                                ?>
                                <strong><?php _e('Token Status:', 'hello-chatbot'); ?></strong>
                                <span class="token-status-<?php echo esc_attr($token_status['status']); ?>">
                                    <?php echo esc_html($token_status['message']); ?>
                                    <?php if ($token_status['expires_at']): ?>
                                        (<?php echo esc_html($token_status['status'] === 'expired' ? $token_status['expired_ago'] : 'Expires in ' . $token_status['expires_in']); ?>)
                                    <?php endif; ?>
                                </span>
                            </div>
                        </td>
                    </tr>
                    
                    <tr class="oauth-settings" style="<?php echo get_option('chatbot_use_oauth') ? '' : 'display:none;'; ?>">
                        <th scope="row">
                            <label for="chatbot_oauth_client_id"><?php _e('OAuth2 Client ID', 'hello-chatbot'); ?></label>
                        </th>
                        <td>
                            <input type="text" id="chatbot_oauth_client_id" name="chatbot_oauth_client_id" 
                                   value="<?php echo esc_attr(get_option('chatbot_oauth_client_id')); ?>" 
                                   class="large-text" />
                            <p class="description"><?php _e('The OAuth2 application client ID.', 'hello-chatbot'); ?></p>
                        </td>
                    </tr>
                    
                    <tr class="oauth-settings" style="<?php echo get_option('chatbot_use_oauth') ? '' : 'display:none;'; ?>">
                        <th scope="row">
                            <label for="chatbot_oauth_client_secret"><?php _e('OAuth2 Client Secret', 'hello-chatbot'); ?></label>
                        </th>
                        <td>
                            <input type="password" id="chatbot_oauth_client_secret" name="chatbot_oauth_client_secret" 
                                   value="<?php echo esc_attr(get_option('chatbot_oauth_client_secret')); ?>" 
                                   class="large-text" />
                            <p class="description"><?php _e('The OAuth2 application client secret.', 'hello-chatbot'); ?></p>
                        </td>
                    </tr>
                    
                    <tr class="oauth-settings" style="<?php echo get_option('chatbot_use_oauth') ? '' : 'display:none;'; ?>">
                        <th scope="row">
                            <label for="chatbot_oauth_tenant_id"><?php _e('OAuth2 Tenant ID', 'hello-chatbot'); ?></label>
                        </th>
                        <td>
                            <input type="text" id="chatbot_oauth_tenant_id" name="chatbot_oauth_tenant_id" 
                                   value="<?php echo esc_attr(get_option('chatbot_oauth_tenant_id')); ?>" 
                                   class="large-text" />
                            <p class="description"><?php _e('The Azure/Microsoft tenant ID.', 'hello-chatbot'); ?></p>
                        </td>
                    </tr>
                    
                    <tr class="oauth-settings" style="<?php echo get_option('chatbot_use_oauth') ? '' : 'display:none;'; ?>">
                        <th scope="row">
                            <label for="chatbot_oauth_scope"><?php _e('OAuth2 Scope', 'hello-chatbot'); ?></label>
                        </th>
                        <td>
                            <input type="text" id="chatbot_oauth_scope" name="chatbot_oauth_scope" 
                                   value="<?php echo esc_attr(get_option('chatbot_oauth_scope')); ?>" 
                                   class="large-text" />
                            <p class="description"><?php _e('The OAuth2 scope (e.g., client_id/.default).', 'hello-chatbot'); ?></p>
                        </td>
                    </tr>
                    
                    <tr class="oauth-settings" style="<?php echo get_option('chatbot_use_oauth') ? '' : 'display:none;'; ?>">
                        <th scope="row">
                            <label for="chatbot_oauth_endpoint"><?php _e('OAuth2 Token Endpoint', 'hello-chatbot'); ?></label>
                        </th>
                        <td>
                            <input type="url" id="chatbot_oauth_endpoint" name="chatbot_oauth_endpoint" 
                                   value="<?php echo esc_attr(get_option('chatbot_oauth_endpoint')); ?>" 
                                   class="large-text" />
                            <p class="description"><?php _e('The OAuth2 token endpoint URL.', 'hello-chatbot'); ?></p>
                            <button type="button" id="test-oauth" class="button button-secondary">
                                <?php _e('Test OAuth2', 'hello-chatbot'); ?>
                            </button>
                            <button type="button" id="refresh-token" class="button button-secondary">
                                <?php _e('Refresh Token Now', 'hello-chatbot'); ?>
                            </button>
                            <span id="oauth-test-result"></span>
                        </td>
                    </tr>
                    
                    <tr>
                        <th scope="row">
                            <label for="chatbot_api_token"><?php _e('Manual Bearer Token', 'hello-chatbot'); ?></label>
                        </th>
                        <td>
                            <input type="password" id="chatbot_api_token" name="chatbot_api_token" 
                                   value="<?php echo esc_attr(get_option('chatbot_api_token')); ?>" 
                                   class="large-text" />
                            <p class="description"><?php _e('Manual authentication token (used as fallback if OAuth2 fails).', 'hello-chatbot'); ?></p>
                            <button type="button" id="test-connection" class="button button-secondary">
                                <?php _e('Test API Connection', 'hello-chatbot'); ?>
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
    
    /**
     * Test OAuth2 connection AJAX handler
     */
    public function test_oauth_connection() {
        // Verify nonce
        if (!wp_verify_nonce($_POST['nonce'], 'hello_chatbot_admin_nonce')) {
            wp_send_json_error('Invalid nonce');
        }
        
        // Check permissions
        if (!current_user_can('manage_options')) {
            wp_send_json_error('Insufficient permissions');
        }
        
        $token_manager = Hello_Chatbot_Token_Manager::get_instance();
        $result = $token_manager->test_oauth_connection();
        
        if ($result['success']) {
            wp_send_json_success($result);
        } else {
            wp_send_json_error($result['message']);
        }
    }
    
    /**
     * Refresh token AJAX handler
     */
    public function refresh_token_ajax() {
        // Verify nonce
        if (!wp_verify_nonce($_POST['nonce'], 'hello_chatbot_admin_nonce')) {
            wp_send_json_error('Invalid nonce');
        }
        
        // Check permissions
        if (!current_user_can('manage_options')) {
            wp_send_json_error('Insufficient permissions');
        }
        
        $token_manager = Hello_Chatbot_Token_Manager::get_instance();
        $token_manager->clear_token_cache(); // Clear cache to force refresh
        $new_token = $token_manager->refresh_token();
        
        if ($new_token !== false) {
            $token_status = $token_manager->get_token_status();
            wp_send_json_success(array(
                'message' => 'Token refreshed successfully!',
                'status' => $token_status
            ));
        } else {
            wp_send_json_error('Failed to refresh token. Check your OAuth2 credentials.');
        }
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
        
        // Use Token Manager to get a valid token
        $token_manager = Hello_Chatbot_Token_Manager::get_instance();
        $api_token = $token_manager->get_valid_token();
        
        
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
                'maxLength' => 800
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
        
        // Check for custom prompts with predefined responses
        $custom_responses = $this->get_custom_responses();
        if (isset($custom_responses[$message])) {
            wp_send_json_success(array(
                'answer' => $custom_responses[$message]['answer'],
                'references' => $custom_responses[$message]['references']
            ));
            return;
        }
        
        // Get API settings
        $api_endpoint = get_option('chatbot_api_endpoint');
        
        // Use Token Manager to get a valid token
        $token_manager = Hello_Chatbot_Token_Manager::get_instance();
        $api_token = $token_manager->get_valid_token();
        
        // Log current settings for debugging
        error_log("Hello Chatbot - API Endpoint: " . $api_endpoint);
        error_log("Hello Chatbot - API Token Length: " . strlen($api_token));
        error_log("Hello Chatbot - Token obtained via: " . (get_option('chatbot_use_oauth') ? 'OAuth2' : 'Manual'));
        
        if (empty($api_endpoint)) {
            wp_send_json_error('Chatbot is not configured');
        }
        
        if (empty($api_token)) {
            wp_send_json_error('Unable to obtain authentication token');
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
                'maxLength' => 800
            ),
            'useCaseMeta' => array(
                'context' => array(
                    'placeholders' => new stdClass(),
                    'PIIdata' => array(
                        'mask' => false
                    )
                ),
                'stream' => false  // Client-side fake streaming - request complete response
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
            // Filter to top 3 web-only sources
            $filtered_sources = $this->filter_references($data['sources']);

            foreach ($filtered_sources as $source) {
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
    
    /**
     * Handle streaming message request using Server-Sent Events
     */
    public function handle_stream_message() {
        // Verify nonce
        if (!isset($_GET['nonce']) || !wp_verify_nonce($_GET['nonce'], 'hello_chatbot_nonce')) {
            header('Content-Type: text/event-stream');
            header('Cache-Control: no-cache');
            echo "data: " . json_encode(array('error' => 'Invalid security token')) . "\n\n";
            exit;
        }
        
        $message = isset($_GET['message']) ? sanitize_text_field($_GET['message']) : '';
        $page_context = isset($_GET['page_context']) ? sanitize_text_field($_GET['page_context']) : '';
        
        if (empty($message)) {
            header('Content-Type: text/event-stream');
            header('Cache-Control: no-cache');
            echo "data: " . json_encode(array('error' => 'Message cannot be empty')) . "\n\n";
            exit;
        }
        
        // Set headers for SSE and disable all buffering
        header('Content-Type: text/event-stream');
        header('Cache-Control: no-cache, must-revalidate');
        header('Connection: keep-alive');
        header('X-Accel-Buffering: no'); // Disable Nginx buffering
        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Headers: Cache-Control');
        
        // Disable all output buffering for real-time streaming
        if (ob_get_level()) {
            ob_end_clean();
        }
        
        // Set unlimited execution time for streaming
        set_time_limit(0);
        
        // Check for custom prompts with predefined responses
        $custom_responses = $this->get_custom_responses();
        if (isset($custom_responses[$message])) {
            // Simulate streaming for custom responses by breaking into smaller chunks
            $full_text = $custom_responses[$message]['answer'];
            $words = explode(' ', $full_text);
            $chunk_size = 5; // Send 5 words at a time for smooth streaming
            
            for ($i = 0; $i < count($words); $i += $chunk_size) {
                $word_chunk = implode(' ', array_slice($words, $i, $chunk_size));
                if ($i + $chunk_size < count($words)) {
                    $word_chunk .= ' '; // Add space if not the last chunk
                }
                
                echo "data: " . json_encode(array(
                    'type' => 'chunk',
                    'content' => $word_chunk
                )) . "\n\n";
                flush();
                
                // Small delay to simulate smooth streaming (match test file speed)
                usleep(50000); // 50ms delay (~20 words per second)
            }
            
            // Send references
            echo "data: " . json_encode(array(
                'type' => 'references',
                'references' => $custom_responses[$message]['references']
            )) . "\n\n";
            flush();
            
            // Send completion signal
            echo "data: " . json_encode(array('type' => 'done')) . "\n\n";
            flush();
            exit;
        }
        
        // Get API settings
        $api_endpoint = get_option('chatbot_api_endpoint');
        
        // Use Token Manager to get a valid token
        $token_manager = Hello_Chatbot_Token_Manager::get_instance();
        $api_token = $token_manager->get_valid_token();
        
        // Log current settings for debugging
        error_log("Hello Chatbot Streaming - API Endpoint: " . $api_endpoint);
        error_log("Hello Chatbot Streaming - API Token Length: " . strlen($api_token));
        error_log("Hello Chatbot Streaming - Token obtained via: " . (get_option('chatbot_use_oauth') ? 'OAuth2' : 'Manual'));
        
        if (empty($api_endpoint)) {
            echo "data: " . json_encode(array('error' => 'Chatbot is not configured')) . "\n\n";
            exit;
        }
        
        if (empty($api_token)) {
            echo "data: " . json_encode(array('error' => 'Unable to obtain authentication token')) . "\n\n";
            exit;
        }
        
        // Build request body for KBot API with streaming enabled
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
                'maxLength' => 800
            ),
            'useCaseMeta' => array(
                'context' => array(
                    'placeholders' => new stdClass(),
                    'PIIdata' => array(
                        'mask' => false
                    )
                ),
                'stream' => false // Use non-streaming for complete response, simulate streaming on our end
            )
        );
        
        // Initialize cURL to get complete response first
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $api_endpoint);
        curl_setopt($ch, CURLOPT_POST, 1);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($request_body));
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HEADER, false);
        curl_setopt($ch, CURLOPT_TIMEOUT, 60);
        curl_setopt($ch, CURLOPT_HTTPHEADER, array(
            'Content-Type: application/json',
            'Accept: application/json',
            'Authorization: Bearer ' . $api_token,
            'Cache-Control: no-cache'
        ));
        
        $response = curl_exec($ch);
        $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curl_error = curl_error($ch);
        curl_close($ch);
        
        if ($response === false || !empty($curl_error)) {
            echo "data: " . json_encode(array('error' => 'Failed to connect to API: ' . $curl_error)) . "\n\n";
            flush();
            exit;
        }
        
        if ($http_code !== 200) {
            echo "data: " . json_encode(array(
                'error' => 'API returned status code: ' . $http_code,
                'debug' => array(
                    'endpoint' => $api_endpoint,
                    'token_set' => !empty($api_token),
                    'response_preview' => substr($response, 0, 200)
                )
            )) . "\n\n";
            flush();
            exit;
        }
        
        // Parse the complete response
        $json_data = json_decode($response, true);
        if (!$json_data || !isset($json_data['answer'])) {
            echo "data: " . json_encode(array('error' => 'Invalid API response format')) . "\n\n";
            flush();
            exit;
        }
        
        $answer = $json_data['answer'];
        $sources_data = isset($json_data['sources']) ? $json_data['sources'] : array();
        
        // Now simulate streaming by sending words one by one
        $words = explode(' ', $answer);
        foreach ($words as $index => $word) {
            if (trim($word)) {
                $word_to_send = ($index > 0 ? ' ' : '') . $word;
                
                $chunk_data = json_encode(array(
                    'type' => 'chunk',
                    'content' => $word_to_send
                ));
                echo "data: " . $chunk_data . "\n\n";
                flush();
                
                // Small delay for smooth streaming effect
                usleep(50000); // 50ms delay
            }
        }
        
        // Send references if we have them
        if (!empty($sources_data)) {
            // Filter to top 3 web-only sources
            $filtered_sources = $this->filter_references($sources_data);

            $references = array();
            foreach ($filtered_sources as $source) {
                $references[] = array(
                    'title' => $source['dataSource'] ?? 'Reference',
                    'url' => $source['path'] ?? '#',
                    'description' => substr($source['content'] ?? '', 0, 150) . '...'
                );
            }

            if (!empty($references)) {
                echo "data: " . json_encode(array(
                    'type' => 'references',
                    'references' => $references
                )) . "\n\n";
                flush();
            }
        }
        
        // Send completion signal
        echo "data: " . json_encode(array('type' => 'done')) . "\n\n";
        flush();
        exit;
    }
    
    /**
     * Get predefined responses for custom prompts
     */
    private function get_custom_responses() {
        return array(
            'Who is Concentrix?' => array(
                'answer' => "Concentrix is a leading global provider of customer experience (CX) solutions and technology. We help the world's best brands – across 40+ countries – improve their business performance and create better experiences for their customers.\n\nOur services include:\n• Customer support and engagement solutions\n• Digital transformation services\n• Data analytics and insights\n• Technology consulting and implementation\n• Business process optimization\n\nWe combine human expertise with advanced technology to deliver personalized, efficient customer experiences that drive business growth.",
                'references' => array(
                    array(
                        'title' => 'About Concentrix',
                        'url' => 'https://www.concentrix.com/about/',
                        'description' => 'Learn more about Concentrix, our mission, values, and global presence in customer experience solutions.'
                    ),
                    array(
                        'title' => 'Our Services',
                        'url' => 'https://www.concentrix.com/services/',
                        'description' => 'Explore our comprehensive range of customer experience and technology services.'
                    )
                )
            ),
            'Speak with a specialist' => array(
                'answer' => "I'd be happy to connect you with one of our specialists! Here are the best ways to get in touch:\n\n📞 **Phone**: Call our main line and ask to speak with a specialist about your specific needs\n\n💼 **Business Inquiries**: Visit our contact page to submit a detailed inquiry about your business requirements\n\n🌐 **Online**: Use our website's contact form to describe your needs, and we'll match you with the right specialist\n\n📧 **Email**: Send us your questions and we'll have the appropriate specialist respond within 24 hours\n\nOur specialists can help with customer experience strategy, technology solutions, digital transformation, and business process optimization. What specific area would you like to discuss?",
                'references' => array(
                    array(
                        'title' => 'Contact Us',
                        'url' => 'https://www.concentrix.com/contact/',
                        'description' => 'Get in touch with our team of specialists for personalized assistance with your business needs.'
                    ),
                    array(
                        'title' => 'Request a Consultation',
                        'url' => 'https://www.concentrix.com/contact/consultation/',
                        'description' => 'Schedule a consultation with our experts to discuss your customer experience challenges and solutions.'
                    )
                )
            ),
            'Learn about our careers' => array(
                'answer' => "Join the Concentrix team and build an exciting career in customer experience and technology! We offer opportunities worldwide across various fields:\n\n🚀 **Career Areas**:\n• Customer Support & Success\n• Technology & Engineering\n• Data Analytics & AI\n• Sales & Business Development\n• Digital Marketing\n• Operations & Project Management\n• Finance & HR\n\n✨ **Why Choose Concentrix**:\n• Global career opportunities in 40+ countries\n• Continuous learning and development programs\n• Diverse and inclusive work environment\n• Competitive benefits and compensation\n• Work-from-home and hybrid options\n• Career advancement opportunities\n\n📋 **How to Apply**:\nVisit our careers page to browse current openings, learn about our culture, and submit your application. We're always looking for talented individuals who are passionate about delivering exceptional customer experiences!",
                'references' => array(
                    array(
                        'title' => 'Careers at Concentrix',
                        'url' => 'https://www.concentrix.com/careers/',
                        'description' => 'Explore career opportunities, company culture, and benefits at Concentrix.'
                    ),
                    array(
                        'title' => 'Job Search',
                        'url' => 'https://jobs.concentrix.com/',
                        'description' => 'Search and apply for current job openings at Concentrix worldwide.'
                    ),
                    array(
                        'title' => 'Life at Concentrix',
                        'url' => 'https://www.concentrix.com/careers/life-at-concentrix/',
                        'description' => 'Discover what it\'s like to work at Concentrix, our values, and employee experiences.'
                    )
                )
            )
        );
    }

    /**
     * Filter references to exclude document types and limit to top 3
     *
     * @param array $sources Array of source objects from API
     * @return array Filtered array with max 3 web-only sources
     */
    private function filter_references($sources) {
        if (empty($sources)) {
            return array();
        }

        // Document extensions to exclude
        $excluded_extensions = array('.pdf', '.docx', '.doc', '.pptx', '.ppt', '.xlsx', '.xls');

        $filtered = array();
        foreach ($sources as $source) {
            $path = isset($source['path']) ? strtolower($source['path']) : '';

            // Skip if path contains excluded extension
            $is_excluded = false;
            foreach ($excluded_extensions as $ext) {
                if (strpos($path, $ext) !== false) {
                    $is_excluded = true;
                    break;
                }
            }

            if (!$is_excluded) {
                $filtered[] = $source;
            }

            // Stop after collecting 3 valid sources
            if (count($filtered) >= 3) {
                break;
            }
        }

        return $filtered;
    }

    /**
     * Debug settings endpoint
     */
    public function debug_settings() {
        // Check permissions
        if (!current_user_can('manage_options')) {
            wp_send_json_error('Insufficient permissions');
        }
        
        $settings = array(
            'api_endpoint' => get_option('chatbot_api_endpoint'),
            'api_token_length' => strlen(get_option('chatbot_api_token')),
            'api_token_preview' => substr(get_option('chatbot_api_token'), 0, 50) . '...',
            'enabled' => get_option('chatbot_enabled'),
            'welcome_message' => get_option('chatbot_welcome_message'),
            'position' => get_option('chatbot_position')
        );
        
        wp_send_json_success($settings);
    }
}