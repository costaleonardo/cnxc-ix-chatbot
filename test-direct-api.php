<?php
/**
 * Test direct KBot API call to verify what the API actually returns
 */

$api_token = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsIng1dCI6IkhTMjNiN0RvN1RjYVUxUm9MSHdwSXEyNFZZZyIsImtpZCI6IkhTMjNiN0RvN1RjYVUxUm9MSHdwSXEyNFZZZyJ9.eyJhdWQiOiI5NDM5ZjYxNS1mZTFiLTRhZjEtOWM1Yy1iZjdiZDdhODI3NzQiLCJpc3MiOiJodHRwczovL3N0cy53aW5kb3dzLm5ldC81OTllNTFkNi0yZjhjLTQzNDctOGU1OS0xZjc5NWE1MWE5OGMvIiwiaWF0IjoxNzU5MTc0ODc1LCJuYmYiOjE3NTkxNzQ4NzUsImV4cCI6MTc1OTE3ODc3NSwiYWlvIjoiazJSZ1lGaGtNeU8vZU9YYWxCcjJnRFd2T2YrOUFBQT0iLCJhcHBpZCI6Ijk0MzlmNjE1LWZlMWItNGFmMS05YzVjLWJmN2JkN2E4Mjc3NCIsImFwcGlkYWNyIjoiMSIsImlkcCI6Imh0dHBzOi8vc3RzLndpbmRvd3MubmV0LzU5OWU1MWQ2LTJmOGMtNDM0Ny04ZTU5LTFmNzk1YTUxYTk4Yy8iLCJvaWQiOiJiYWZmYWY5MS03ZGZlLTQ2YTctODJiNi04ZTViNjUyODI3MmYiLCJyaCI6IjEuQVE0QTFsR2VXWXd2UjBPT1dSOTVXbEdwakJYMk9aUWJfdkZLbkZ5X2U5ZW9KM1FPQUFBT0FBLiIsInN1YiI6ImJhZmZhZjkxLTdkZmUtNDZhNy04MmI2LThlNWI2NTI4MjcyZiIsInRpZCI6IjU5OWU1MWQ2LTJmOGMtNDM0Ny04ZTU5LTFmNzk1YTUxYTk4YyIsInV0aSI6InBXekxBSzktZVV1dWRGUGdRazdBQVEiLCJ2ZXIiOiIxLjAiLCJ4bXNfZnRkIjoiVi1pMTZYTmkwR09DeVBvc05RQU12LTJKN3BibzVkUmhxMkF0ZVNtYm04MEJkWE5sWVhOMExXUnpiWE0ifQ.FUtAppCM4Lle-QmuME8fZ8cTuJwngO6a8oMiFCVYHssvhQYo5zsDUF-6QPMm7LMUCZvhokOAauJ32u-bi5zs0WWPQRaqLZD5ZvhOkm84IhO6-V6G3Gjmcr345g3puRv-Fe6YN9E5dMWOGI_wvaV_S6v5BehSHOGTkZgoT0ReQ5msE1p76RkWZbcW4G7_5-mysZ_ORXcxH_oJVUqyWWDKjAo80bZ4ImpFVG-9eab__GS884FQJresCNSbkoeznk9gkWTm79gFvV9UjaRNqhJbSwnP_wIE3PsVWST1LXzcocCaqVNx_e8KltXNBt0O2t2vivkuksKYxt5ujaI2HA8l5Q';
$api_endpoint = 'https://kbot-preprod.concentrix.com/api/v1/kb/ask?appId=aab4e255-2a10-4723-95fd-d2e77a24a545';

echo "Testing direct KBot API calls...\n";
echo "===============================\n\n";

// Test different maxLength values and streaming settings
$test_cases = [
    'streaming_800' => ['stream' => true, 'maxLength' => 800],
    'streaming_1200' => ['stream' => true, 'maxLength' => 1200],
    'no_streaming_800' => ['stream' => false, 'maxLength' => 800],
    'no_streaming_1200' => ['stream' => false, 'maxLength' => 1200],
];

foreach ($test_cases as $case_name => $settings) {
    echo "Testing: $case_name (stream: " . ($settings['stream'] ? 'true' : 'false') . ", maxLength: {$settings['maxLength']})\n";
    echo str_repeat('-', 60) . "\n";
    
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
            'maxLength' => $settings['maxLength']
        ),
        'useCaseMeta' => array(
            'context' => array(
                'placeholders' => new stdClass(),
                'PIIdata' => array(
                    'mask' => false
                )
            ),
            'stream' => $settings['stream']
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
    
    if ($settings['stream']) {
        // For streaming, capture all chunks
        $response_buffer = '';
        $chunk_count = 0;
        $final_answer = '';
        
        curl_setopt($ch, CURLOPT_WRITEFUNCTION, function($ch, $data) use (&$response_buffer, &$chunk_count, &$final_answer) {
            $chunk_count++;
            $response_buffer .= $data;
            
            // Try to decode current buffer
            $json_data = json_decode($response_buffer, true);
            if ($json_data && isset($json_data['answer'])) {
                $final_answer = $json_data['answer'];
                if ($chunk_count <= 5 || $chunk_count % 20 == 0) {
                    echo "Chunk $chunk_count - Answer length: " . strlen($json_data['answer']) . " chars\n";
                }
            }
            
            return strlen($data);
        });
        
        $result = curl_exec($ch);
        
        echo "\nFinal answer from streaming ($chunk_count chunks):\n";
        echo "Length: " . strlen($final_answer) . " characters\n";
        echo "Content: $final_answer\n";
        
    } else {
        // For non-streaming, get complete response
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        $response = curl_exec($ch);
        
        if ($response) {
            $json_data = json_decode($response, true);
            if ($json_data && isset($json_data['answer'])) {
                echo "Non-streaming answer length: " . strlen($json_data['answer']) . " characters\n";
                echo "Content: " . $json_data['answer'] . "\n";
            } else {
                echo "Failed to parse response. Raw response (first 200 chars):\n";
                echo substr($response, 0, 200) . "...\n";
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
    
    sleep(1); // Brief pause between requests
}

echo "Direct API test completed.\n";
?>