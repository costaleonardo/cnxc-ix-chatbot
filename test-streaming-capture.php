<?php
/**
 * Capture complete streaming response to debug truncation
 */

$url = 'http://localhost:10023/wp-admin/admin-ajax.php?action=hello_chatbot_stream_message&message=what%20services%20does%20concentrix%20offer&nonce=ef9a42a73a';

echo "Capturing streaming response...\n";
echo "==============================\n\n";

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_TIMEOUT, 30);

$response_buffer = '';
$accumulated_text = '';
$chunk_count = 0;

curl_setopt($ch, CURLOPT_WRITEFUNCTION, function($ch, $data) use (&$response_buffer, &$accumulated_text, &$chunk_count) {
    $chunk_count++;
    $response_buffer .= $data;
    
    // Parse SSE data
    $lines = explode("\n", $data);
    foreach ($lines as $line) {
        if (strpos($line, 'data: ') === 0) {
            $json_str = substr($line, 6);
            $json_data = json_decode($json_str, true);
            
            if ($json_data && isset($json_data['type'])) {
                switch ($json_data['type']) {
                    case 'chunk':
                        $accumulated_text .= $json_data['content'];
                        echo "Chunk $chunk_count: " . $json_data['content'] . "\n";
                        break;
                    case 'done':
                        echo "\n=== STREAM COMPLETE ===\n";
                        echo "Final accumulated text:\n";
                        echo $accumulated_text . "\n";
                        echo "\nCharacter count: " . strlen($accumulated_text) . "\n";
                        break;
                    case 'references':
                        echo "\nReferences received: " . count($json_data['references']) . " items\n";
                        break;
                }
            }
        }
    }
    
    return strlen($data);
});

$result = curl_exec($ch);

if (curl_error($ch)) {
    echo "cURL Error: " . curl_error($ch) . "\n";
}

$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
echo "HTTP Code: $http_code\n";

curl_close($ch);

echo "\nTest completed.\n";
?>