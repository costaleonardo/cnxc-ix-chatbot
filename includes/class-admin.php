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
        
        // Use the latest token provided by user for full functionality
        $api_token = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsIng1dCI6IkhTMjNiN0RvN1RjYVUxUm9MSHdwSXEyNFZZZyIsImtpZCI6IkhTMjNiN0RvN1RjYVUxUm9MSHdwSXEyNFZZZyJ9.eyJhdWQiOiI5NDM5ZjYxNS1mZTFiLTRhZjEtOWM1Yy1iZjdiZDdhODI3NzQiLCJpc3MiOiJodHRwczovL3N0cy53aW5kb3dzLm5ldC81OTllNTFkNi0yZjhjLTQzNDctOGU1OS0xZjc5NWE1MWE5OGMvIiwiaWF0IjoxNzU5MTc0ODc1LCJuYmYiOjE3NTkxNzQ4NzUsImV4cCI6MTc1OTE3ODc3NSwiYWlvIjoiazJSZ1lGaGtNeU8vZU9YYWxCcjJnRFd2T2YrOUFBQT0iLCJhcHBpZCI6Ijk0MzlmNjE1LWZlMWItNGFmMS05YzVjLWJmN2JkN2E4Mjc3NCIsImFwcGlkYWNyIjoiMSIsImlkcCI6Imh0dHBzOi8vc3RzLndpbmRvd3MubmV0LzU5OWU1MWQ2LTJmOGMtNDM0Ny04ZTU5LTFmNzk1YTUxYTk4Yy8iLCJvaWQiOiJiYWZmYWY5MS03ZGZlLTQ2YTctODJiNi04ZTViNjUyODI3MmYiLCJyaCI6IjEuQVE0QTFsR2VXWXd2UjBPT1dSOTVXbEdwakJYMk9aUWJfdkZLbkZ5X2U5ZW9KM1FPQUFBT0FBLiIsInN1YiI6ImJhZmZhZjkxLTdkZmUtNDZhNy04MmI2LThlNWI2NTI4MjcyZiIsInRpZCI6IjU5OWU1MWQ2LTJmOGMtNDM0Ny04ZTU5LTFmNzk1YTUxYTk4YyIsInV0aSI6InBXekxBSzktZVV1dWRGUGdRazdBQVEiLCJ2ZXIiOiIxLjAiLCJ4bXNfZnRkIjoiVi1pMTZYTmkwR09DeVBvc05RQU12LTJKN3BibzVkUmhxMkF0ZVNtYm04MEJkWE5sWVhOMExXUnpiWE0ifQ.FUtAppCM4Lle-QmuME8fZ8cTuJwngO6a8oMiFCVYHssvhQYo5zsDUF-6QPMm7LMUCZvhokOAauJ32u-bi5zs0WWPQRaqLZD5ZvhOkm84IhO6-V6G3Gjmcr345g3puRv-Fe6YN9E5dMWOGI_wvaV_S6v5BehSHOGTkZgoT0ReQ5msE1p76RkWZbcW4G7_5-mysZ_ORXcxH_oJVUqyWWDKjAo80bZ4ImpFVG-9eab__GS884FQJresCNSbkoeznk9gkWTm79gFvV9UjaRNqhJbSwnP_wIE3PsVWST1LXzcocCaqVNx_e8KltXNBt0O2t2vivkuksKYxt5ujaI2HA8l5Q';
        
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
        $api_token = get_option('chatbot_api_token');
        
        // Use the latest token provided by user for full functionality
        $api_token = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsIng1dCI6IkhTMjNiN0RvN1RjYVUxUm9MSHdwSXEyNFZZZyIsImtpZCI6IkhTMjNiN0RvN1RjYVUxUm9MSHdwSXEyNFZZZyJ9.eyJhdWQiOiI5NDM5ZjYxNS1mZTFiLTRhZjEtOWM1Yy1iZjdiZDdhODI3NzQiLCJpc3MiOiJodHRwczovL3N0cy53aW5kb3dzLm5ldC81OTllNTFkNi0yZjhjLTQzNDctOGU1OS0xZjc5NWE1MWE5OGMvIiwiaWF0IjoxNzU5MTc0ODc1LCJuYmYiOjE3NTkxNzQ4NzUsImV4cCI6MTc1OTE3ODc3NSwiYWlvIjoiazJSZ1lGaGtNeU8vZU9YYWxCcjJnRFd2T2YrOUFBQT0iLCJhcHBpZCI6Ijk0MzlmNjE1LWZlMWItNGFmMS05YzVjLWJmN2JkN2E4Mjc3NCIsImFwcGlkYWNyIjoiMSIsImlkcCI6Imh0dHBzOi8vc3RzLndpbmRvd3MubmV0LzU5OWU1MWQ2LTJmOGMtNDM0Ny04ZTU5LTFmNzk1YTUxYTk4Yy8iLCJvaWQiOiJiYWZmYWY5MS03ZGZlLTQ2YTctODJiNi04ZTViNjUyODI3MmYiLCJyaCI6IjEuQVE0QTFsR2VXWXd2UjBPT1dSOTVXbEdwakJYMk9aUWJfdkZLbkZ5X2U5ZW9KM1FPQUFBT0FBLiIsInN1YiI6ImJhZmZhZjkxLTdkZmUtNDZhNy04MmI2LThlNWI2NTI4MjcyZiIsInRpZCI6IjU5OWU1MWQ2LTJmOGMtNDM0Ny04ZTU5LTFmNzk1YTUxYTk4YyIsInV0aSI6InBXekxBSzktZVV1dWRGUGdRazdBQVEiLCJ2ZXIiOiIxLjAiLCJ4bXNfZnRkIjoiVi1pMTZYTmkwR09DeVBvc05RQU12LTJKN3BibzVkUmhxMkF0ZVNtYm04MEJkWE5sWVhOMExXUnpiWE0ifQ.FUtAppCM4Lle-QmuME8fZ8cTuJwngO6a8oMiFCVYHssvhQYo5zsDUF-6QPMm7LMUCZvhokOAauJ32u-bi5zs0WWPQRaqLZD5ZvhOkm84IhO6-V6G3Gjmcr345g3puRv-Fe6YN9E5dMWOGI_wvaV_S6v5BehSHOGTkZgoT0ReQ5msE1p76RkWZbcW4G7_5-mysZ_ORXcxH_oJVUqyWWDKjAo80bZ4ImpFVG-9eab__GS884FQJresCNSbkoeznk9gkWTm79gFvV9UjaRNqhJbSwnP_wIE3PsVWST1LXzcocCaqVNx_e8KltXNBt0O2t2vivkuksKYxt5ujaI2HA8l5Q';
        
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
                'maxLength' => 800
            ),
            'useCaseMeta' => array(
                'context' => array(
                    'placeholders' => new stdClass(),
                    'PIIdata' => array(
                        'mask' => false
                    )
                ),
                'stream' => true
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
        $api_token = get_option('chatbot_api_token');
        
        // Use the latest token provided by user for full functionality
        $api_token = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsIng1dCI6IkhTMjNiN0RvN1RjYVUxUm9MSHdwSXEyNFZZZyIsImtpZCI6IkhTMjNiN0RvN1RjYVUxUm9MSHdwSXEyNFZZZyJ9.eyJhdWQiOiI5NDM5ZjYxNS1mZTFiLTRhZjEtOWM1Yy1iZjdiZDdhODI3NzQiLCJpc3MiOiJodHRwczovL3N0cy53aW5kb3dzLm5ldC81OTllNTFkNi0yZjhjLTQzNDctOGU1OS0xZjc5NWE1MWE5OGMvIiwiaWF0IjoxNzU5MTc0ODc1LCJuYmYiOjE3NTkxNzQ4NzUsImV4cCI6MTc1OTE3ODc3NSwiYWlvIjoiazJSZ1lGaGtNeU8vZU9YYWxCcjJnRFd2T2YrOUFBQT0iLCJhcHBpZCI6Ijk0MzlmNjE1LWZlMWItNGFmMS05YzVjLWJmN2JkN2E4Mjc3NCIsImFwcGlkYWNyIjoiMSIsImlkcCI6Imh0dHBzOi8vc3RzLndpbmRvd3MubmV0LzU5OWU1MWQ2LTJmOGMtNDM0Ny04ZTU5LTFmNzk1YTUxYTk4Yy8iLCJvaWQiOiJiYWZmYWY5MS03ZGZlLTQ2YTctODJiNi04ZTViNjUyODI3MmYiLCJyaCI6IjEuQVE0QTFsR2VXWXd2UjBPT1dSOTVXbEdwakJYMk9aUWJfdkZLbkZ5X2U5ZW9KM1FPQUFBT0FBLiIsInN1YiI6ImJhZmZhZjkxLTdkZmUtNDZhNy04MmI2LThlNWI2NTI4MjcyZiIsInRpZCI6IjU5OWU1MWQ2LTJmOGMtNDM0Ny04ZTU5LTFmNzk1YTUxYTk4YyIsInV0aSI6InBXekxBSzktZVV1dWRGUGdRazdBQVEiLCJ2ZXIiOiIxLjAiLCJ4bXNfZnRkIjoiVi1pMTZYTmkwR09DeVBvc05RQU12LTJKN3BibzVkUmhxMkF0ZVNtYm04MEJkWE5sWVhOMExXUnpiWE0ifQ.FUtAppCM4Lle-QmuME8fZ8cTuJwngO6a8oMiFCVYHssvhQYo5zsDUF-6QPMm7LMUCZvhokOAauJ32u-bi5zs0WWPQRaqLZD5ZvhOkm84IhO6-V6G3Gjmcr345g3puRv-Fe6YN9E5dMWOGI_wvaV_S6v5BehSHOGTkZgoT0ReQ5msE1p76RkWZbcW4G7_5-mysZ_ORXcxH_oJVUqyWWDKjAo80bZ4ImpFVG-9eab__GS884FQJresCNSbkoeznk9gkWTm79gFvV9UjaRNqhJbSwnP_wIE3PsVWST1LXzcocCaqVNx_e8KltXNBt0O2t2vivkuksKYxt5ujaI2HA8l5Q';
        
        if (empty($api_endpoint)) {
            echo "data: " . json_encode(array('error' => 'Chatbot is not configured')) . "\n\n";
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
            $references = array();
            foreach ($sources_data as $source) {
                $references[] = array(
                    'title' => $source['dataSource'] ?? 'Reference',
                    'url' => $source['path'] ?? '#',
                    'description' => substr($source['content'] ?? '', 0, 150) . '...'
                );
            }
            
            echo "data: " . json_encode(array(
                'type' => 'references',
                'references' => $references
            )) . "\n\n";
            flush();
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
}