<?php
/**
 * Test KBot API complete response to verify streaming functionality
 * This script will fetch the complete response to understand the full content
 */

// New Bearer token provided by user
$api_token = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsIng1dCI6IkhTMjNiN0RvN1RjYVUxUm9MSHdwSXEyNFZZZyIsImtpZCI6IkhTMjNiN0RvN1RjYVUxUm9MSHdwSXEyNFZZZyJ9.eyJhdWQiOiJodHRwczovL2Rldi1jb25jZW50cml4LWNvcmVzZXJ2aWNlcy5henVyZXdlYnNpdGVzLm5ldCIsImlzcyI6Imh0dHBzOi8vc3RzLndpbmRvd3MubmV0LzY4OWNkYzIyLTQ4ODEtNGJkMy04YmEzLWZhNjE2NDdhMzNmNy8iLCJpYXQiOjE3MjcyOTE1NDMsIm5iZiI6MTcyNzI5MTU0MywiZXhwIjoxNzI3NTUwNzQzLCJhaW8iOiJFMlpnWUJEU21INjNyUDIvMWw4c2h2ZDIrOUJNQUE9PSIsImFwcGlkIjoiNWZmNmYxM2YtNWJhZS00NDNlLWI1ZDEtNzM4MmY3YmM4NDEwIiwiYXBwaWRhY3IiOiIxIiwiaWRwIjoiaHR0cHM6Ly9zdHMud2luZG93cy5uZXQvNjg5Y2RjMjItNDg4MS00YmQzLThiYTMtZmE2MTY0N2EzM2Y3LyIsIm9pZCI6IjA5MmRkOGM4LTk5Y2ItNGM2ZC1iZGEyLWFhMjNhMTg1NjE1ZiIsInJoIjoiMC5BYUFFSWZ5WGFvR0hzMHlMb19waFpIb3o5ejhBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNaQUEuIiwic3ViIjoiMDkyZGQ4YzgtOTljYi00YzZkLWJkYTItYWEyM2ExODU2MTVmIiwidGVuYW50aWQiOiI2ODljZGMyMi00ODgxLTRiZDMtOGJhMy1mYTYxNjQ3YTMzZjciLCJ1dGkiOiJEYjMwUFB2azhVeWV5dm1JSmlYQUFBIiwidmVyIjoiMS4wIn0.HK5zE9QJJkrPMi9VNT9ZL3OuEJYJGdcKJjj8Rt2R7SPDq23WsLvjzg7Np6qjLqG6gOQsNE8Q6QOAVwjcJdFbSl4RHrfX_3aMVDtb-OqOZZLh1G4aPXbzWn_CQdkZpHd68QFmNGQShJPWpKZ3vNWMlU8BHJKhPzXLz7nCBpjO0_i6n2Vwy-eoO8oKfkqD7vGo-N6yGsJhL8M5B6wJZWxrZAqOoGZFsXb4Kd-6x8J7L5y9o4n3v7nCW2H1pEqXZfMZJg7xE6VwW-Fp0S9hzOcAz8qMW6Q5jH-Rk3u9L8N7V2C1yY3a6fX';
$api_endpoint = 'https://kbot-preprod.concentrix.com/api/v1/kb/ask?appId=aab4e255-2a10-4723-95fd-d2e77a24a545';

echo "Testing KBot API complete response...\n";
echo "==================================\n\n";

// Test both streaming and non-streaming to compare
$test_cases = [
    'streaming' => true,
    'non-streaming' => false
];

foreach ($test_cases as $case_name => $use_streaming) {
    echo "Testing: $case_name\n";
    echo str_repeat('-', 30) . "\n";
    
    // Build request body
    $request_body = array(
        'input' => array(
            'language' => 'en',
            'data' => array(
                'question' => 'what services does concentrix provide',
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
            'stream' => $use_streaming
        )
    );
    
    // Initialize cURL
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $api_endpoint);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($request_body));
    curl_setopt($ch, CURLOPT_HTTPHEADER, array(
        'Content-Type: application/json',
        'Authorization: Bearer ' . $api_token
    ));
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    
    if ($use_streaming) {
        // For streaming, capture all chunks
        $response_buffer = '';
        $chunk_count = 0;
        
        curl_setopt($ch, CURLOPT_WRITEFUNCTION, function($ch, $data) use (&$response_buffer, &$chunk_count) {
            $chunk_count++;
            $response_buffer .= $data;
            
            // Try to decode current buffer
            $json_data = json_decode($response_buffer, true);
            if ($json_data && isset($json_data['answer'])) {
                echo "Chunk $chunk_count - Answer length: " . strlen($json_data['answer']) . " chars\n";
                if ($chunk_count <= 3 || $chunk_count % 10 == 0) {
                    echo "Preview: " . substr($json_data['answer'], 0, 100) . "...\n";
                }
            }
            
            return strlen($data);
        });
        
        $result = curl_exec($ch);
        
        echo "\nFinal accumulated response:\n";
        $final_json = json_decode($response_buffer, true);
        if ($final_json && isset($final_json['answer'])) {
            echo "Complete answer length: " . strlen($final_json['answer']) . " characters\n";
            echo "Complete answer:\n" . $final_json['answer'] . "\n";
            
            if (isset($final_json['sources'])) {
                echo "\nSources count: " . count($final_json['sources']) . "\n";
            }
        } else {
            echo "Raw response buffer:\n" . substr($response_buffer, 0, 500) . "...\n";
        }
        
    } else {
        // For non-streaming, get complete response
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        $response = curl_exec($ch);
        
        if ($response) {
            $json_data = json_decode($response, true);
            if ($json_data && isset($json_data['answer'])) {
                echo "Non-streaming answer length: " . strlen($json_data['answer']) . " characters\n";
                echo "Non-streaming answer:\n" . $json_data['answer'] . "\n";
            } else {
                echo "Non-streaming raw response:\n" . substr($response, 0, 500) . "...\n";
            }
        }
    }
    
    // Check for cURL errors
    if (curl_error($ch)) {
        echo "cURL Error: " . curl_error($ch) . "\n";
    }
    
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    echo "HTTP Code: $http_code\n\n";
    
    curl_close($ch);
}

echo "Test completed.\n";
?>