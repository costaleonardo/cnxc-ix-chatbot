<?php
/**
 * Debug current plugin settings
 */

// Load WordPress environment
require_once(__DIR__ . '/../../../wp-config.php');
require_once(ABSPATH . 'wp-load.php');

echo "Plugin Settings Debug\n";
echo "====================\n\n";

echo "API Endpoint: " . get_option('chatbot_api_endpoint') . "\n";
echo "API Token (first 50 chars): " . substr(get_option('chatbot_api_token'), 0, 50) . "...\n";
echo "Token Length: " . strlen(get_option('chatbot_api_token')) . " characters\n";
echo "Plugin Enabled: " . (get_option('chatbot_enabled') ? 'Yes' : 'No') . "\n";
echo "Welcome Message: " . get_option('chatbot_welcome_message') . "\n";
echo "Position: " . get_option('chatbot_position') . "\n";

// Test if token looks valid (JWT format)
$token = get_option('chatbot_api_token');
if (!empty($token)) {
    $parts = explode('.', $token);
    echo "Token Format: " . (count($parts) == 3 ? 'Valid JWT (3 parts)' : 'Invalid format') . "\n";
} else {
    echo "Token Format: Empty or not set\n";
}

echo "\nDone.\n";
?>