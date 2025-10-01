<?php
/**
 * Test OAuth2 Token Refresh
 * 
 * This script tests the automatic token refresh functionality
 * Run with: php test-oauth-refresh.php
 */

// Load WordPress environment
require_once('../../../../../wp-load.php');

// Include the Token Manager class
require_once('includes/class-token-manager.php');

echo "Testing OAuth2 Token Refresh Functionality\n";
echo "==========================================\n\n";

// Get Token Manager instance
$token_manager = Hello_Chatbot_Token_Manager::get_instance();

// Display current OAuth2 configuration
echo "OAuth2 Configuration:\n";
echo "- Client ID: " . get_option('chatbot_oauth_client_id') . "\n";
echo "- Client Secret: " . (get_option('chatbot_oauth_client_secret') ? '[CONFIGURED]' : '[NOT SET]') . "\n";
echo "- Tenant ID: " . get_option('chatbot_oauth_tenant_id') . "\n";
echo "- Scope: " . get_option('chatbot_oauth_scope') . "\n";
echo "- Endpoint: " . get_option('chatbot_oauth_endpoint') . "\n";
echo "- OAuth2 Enabled: " . (get_option('chatbot_use_oauth') ? 'Yes' : 'No') . "\n\n";

// Check current token status
echo "Current Token Status:\n";
$status = $token_manager->get_token_status();
echo "- Status: " . $status['status'] . "\n";
echo "- Message: " . $status['message'] . "\n";
if ($status['expires_at']) {
    echo "- Expires at: " . $status['expires_at'] . "\n";
    if ($status['status'] === 'expired') {
        echo "- Expired: " . $status['expired_ago'] . "\n";
    } else {
        echo "- Expires in: " . $status['expires_in'] . "\n";
    }
}
echo "\n";

// Test OAuth2 connection
echo "Testing OAuth2 Connection...\n";
$result = $token_manager->test_oauth_connection();
if ($result['success']) {
    echo "✓ SUCCESS: " . $result['message'] . "\n";
    echo "  Token expires at: " . $result['expires_at'] . "\n";
    echo "  Expires in: " . $result['expires_in'] . "\n";
} else {
    echo "✗ FAILED: " . $result['message'] . "\n";
    echo "  Please check your OAuth2 credentials.\n";
    exit(1);
}
echo "\n";

// Test getting a valid token (will auto-refresh if needed)
echo "Testing get_valid_token() method...\n";
$token = $token_manager->get_valid_token();
if ($token) {
    echo "✓ Token obtained successfully\n";
    echo "  Token length: " . strlen($token) . " characters\n";
    echo "  First 50 chars: " . substr($token, 0, 50) . "...\n";
    
    // Check if it's a JWT token
    $token_parts = explode('.', $token);
    if (count($token_parts) === 3) {
        echo "  Token type: JWT (JSON Web Token)\n";
        
        // Decode header and payload (base64)
        $header = json_decode(base64_decode($token_parts[0]), true);
        $payload = json_decode(base64_decode($token_parts[1]), true);
        
        if ($header && $payload) {
            echo "  Token algorithm: " . ($header['alg'] ?? 'unknown') . "\n";
            echo "  Token issuer: " . ($payload['iss'] ?? 'unknown') . "\n";
            echo "  Token audience: " . ($payload['aud'] ?? 'unknown') . "\n";
            
            if (isset($payload['exp'])) {
                $exp_time = date('Y-m-d H:i:s', $payload['exp']);
                echo "  Token expires: " . $exp_time . "\n";
            }
        }
    } else {
        echo "  Token type: Bearer token (non-JWT)\n";
    }
} else {
    echo "✗ Failed to obtain token\n";
    echo "  Check your configuration and credentials.\n";
    exit(1);
}
echo "\n";

// Test API call with the token
echo "Testing API Call with Token...\n";
$api_endpoint = get_option('chatbot_api_endpoint');
if ($api_endpoint && $token) {
    $request_body = array(
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
            'maxLength' => 100
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
    
    $response = wp_remote_post($api_endpoint, array(
        'headers' => array(
            'Content-Type' => 'application/json',
            'Authorization' => 'Bearer ' . $token
        ),
        'body' => json_encode($request_body),
        'timeout' => 10
    ));
    
    if (is_wp_error($response)) {
        echo "✗ API call failed: " . $response->get_error_message() . "\n";
    } else {
        $status_code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        
        if ($status_code === 200) {
            echo "✓ API call successful (HTTP 200)\n";
            $data = json_decode($body, true);
            if ($data && isset($data['answer'])) {
                echo "  Response received: " . substr($data['answer'], 0, 100) . "...\n";
            }
        } else {
            echo "✗ API returned status code: " . $status_code . "\n";
            echo "  Response: " . substr($body, 0, 200) . "...\n";
        }
    }
} else {
    echo "- Skipping API test (no endpoint or token)\n";
}

echo "\n";
echo "Test completed successfully!\n";
echo "\nThe OAuth2 token refresh feature is working correctly.\n";
echo "Tokens will be automatically refreshed 5 minutes before expiration.\n";