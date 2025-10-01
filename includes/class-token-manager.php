<?php
/**
 * Token Manager for Hello Chatbot
 * Handles OAuth2 token refresh and management
 */

if (!defined('ABSPATH')) {
    exit;
}

class Hello_Chatbot_Token_Manager {
    
    private static $instance = null;
    private $token_cache = null;
    private $token_cache_time = null;
    
    /**
     * Get singleton instance
     */
    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    /**
     * Private constructor for singleton
     */
    private function __construct() {
        // Initialize token cache from database on first load
        $this->load_token_from_db();
    }
    
    /**
     * Get a valid token, refreshing if necessary
     * 
     * @return string|false Bearer token or false on failure
     */
    public function get_valid_token() {
        // Check if OAuth2 is enabled
        if (!get_option('chatbot_use_oauth', true)) {
            // Return manual token if OAuth2 is disabled
            return get_option('chatbot_api_token', '');
        }
        
        // Check if we have a cached token in memory
        if ($this->token_cache !== null && $this->is_token_valid()) {
            return $this->token_cache;
        }
        
        // Load token from database
        $this->load_token_from_db();
        
        // Check if token is valid (with 5 minute buffer for safety)
        if ($this->is_token_valid()) {
            return $this->token_cache;
        }
        
        // Token is expired or will expire soon, refresh it
        $new_token = $this->refresh_token();
        
        if ($new_token !== false) {
            return $new_token;
        }
        
        // If OAuth2 refresh failed, fall back to manual token if available
        $manual_token = get_option('chatbot_api_token', '');
        if (!empty($manual_token)) {
            error_log('Hello Chatbot: OAuth2 token refresh failed, falling back to manual token');
            return $manual_token;
        }
        
        error_log('Hello Chatbot: No valid token available');
        return false;
    }
    
    /**
     * Check if the current token is valid
     * 
     * @return bool
     */
    private function is_token_valid() {
        if (empty($this->token_cache)) {
            return false;
        }
        
        $expires_at = get_option('chatbot_token_expires_at', 0);
        if ($expires_at === 0) {
            return false;
        }
        
        // Check if token expires in more than 5 minutes (300 seconds buffer)
        $current_time = time();
        $buffer_time = 300; // 5 minutes
        
        return ($expires_at - $buffer_time) > $current_time;
    }
    
    /**
     * Load token from database
     */
    private function load_token_from_db() {
        $this->token_cache = get_option('chatbot_api_token', '');
        $this->token_cache_time = get_option('chatbot_token_expires_at', 0);
    }
    
    /**
     * Refresh the OAuth2 token
     * 
     * @return string|false New token or false on failure
     */
    public function refresh_token() {
        $client_id = get_option('chatbot_oauth_client_id', '');
        $client_secret = get_option('chatbot_oauth_client_secret', '');
        $tenant_id = get_option('chatbot_oauth_tenant_id', '');
        $scope = get_option('chatbot_oauth_scope', '');
        $oauth_endpoint = get_option('chatbot_oauth_endpoint', '');
        
        // Validate OAuth2 configuration
        if (empty($client_id) || empty($client_secret) || empty($oauth_endpoint)) {
            error_log('Hello Chatbot: OAuth2 configuration incomplete');
            return false;
        }
        
        // Prepare OAuth2 request
        $request_body = array(
            'client_id' => $client_id,
            'client_secret' => $client_secret,
            'scope' => $scope,
            'grant_type' => 'client_credentials'
        );
        
        $response = wp_remote_post($oauth_endpoint, array(
            'headers' => array(
                'Content-Type' => 'application/x-www-form-urlencoded'
            ),
            'body' => $request_body,
            'timeout' => 15
        ));
        
        if (is_wp_error($response)) {
            error_log('Hello Chatbot: OAuth2 token refresh failed - ' . $response->get_error_message());
            return false;
        }
        
        $status_code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        
        if ($status_code !== 200) {
            error_log('Hello Chatbot: OAuth2 token refresh returned status ' . $status_code);
            error_log('Hello Chatbot: OAuth2 response - ' . substr($body, 0, 500));
            return false;
        }
        
        $token_data = json_decode($body, true);
        
        if (empty($token_data) || !isset($token_data['access_token'])) {
            error_log('Hello Chatbot: Invalid OAuth2 response format');
            return false;
        }
        
        // Extract token and expiration
        $access_token = $token_data['access_token'];
        $expires_in = isset($token_data['expires_in']) ? intval($token_data['expires_in']) : 3600;
        $expires_at = time() + $expires_in;
        
        // Save token to database
        $this->save_token($access_token, $expires_at);
        
        // Log successful refresh
        error_log('Hello Chatbot: OAuth2 token refreshed successfully. Expires at: ' . date('Y-m-d H:i:s', $expires_at));
        
        return $access_token;
    }
    
    /**
     * Save token and expiration to database
     * 
     * @param string $token
     * @param int $expires_at Unix timestamp
     */
    private function save_token($token, $expires_at) {
        update_option('chatbot_api_token', $token);
        update_option('chatbot_token_expires_at', $expires_at);
        
        // Update cache
        $this->token_cache = $token;
        $this->token_cache_time = $expires_at;
    }
    
    /**
     * Test OAuth2 configuration
     * 
     * @return array Result with success status and message
     */
    public function test_oauth_connection() {
        $result = $this->refresh_token();
        
        if ($result !== false) {
            $expires_at = get_option('chatbot_token_expires_at', 0);
            return array(
                'success' => true,
                'message' => 'OAuth2 connection successful! Token obtained.',
                'expires_at' => date('Y-m-d H:i:s', $expires_at),
                'expires_in' => $expires_at - time() . ' seconds'
            );
        } else {
            return array(
                'success' => false,
                'message' => 'OAuth2 connection failed. Please check your credentials.'
            );
        }
    }
    
    /**
     * Clear cached token (useful for testing)
     */
    public function clear_token_cache() {
        $this->token_cache = null;
        $this->token_cache_time = null;
        update_option('chatbot_token_expires_at', 0);
    }
    
    /**
     * Get token status for admin display
     * 
     * @return array Token status information
     */
    public function get_token_status() {
        $expires_at = get_option('chatbot_token_expires_at', 0);
        $current_time = time();
        
        if ($expires_at === 0) {
            return array(
                'status' => 'none',
                'message' => 'No OAuth2 token available',
                'expires_at' => null
            );
        }
        
        if ($expires_at < $current_time) {
            return array(
                'status' => 'expired',
                'message' => 'Token expired',
                'expires_at' => date('Y-m-d H:i:s', $expires_at),
                'expired_ago' => human_time_diff($expires_at, $current_time) . ' ago'
            );
        }
        
        $time_remaining = $expires_at - $current_time;
        
        if ($time_remaining < 300) { // Less than 5 minutes
            return array(
                'status' => 'expiring_soon',
                'message' => 'Token expiring soon',
                'expires_at' => date('Y-m-d H:i:s', $expires_at),
                'expires_in' => human_time_diff($current_time, $expires_at)
            );
        }
        
        return array(
            'status' => 'valid',
            'message' => 'Token is valid',
            'expires_at' => date('Y-m-d H:i:s', $expires_at),
            'expires_in' => human_time_diff($current_time, $expires_at)
        );
    }
}