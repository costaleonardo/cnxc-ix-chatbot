/**
 * Hello Chatbot - Admin JavaScript
 * Handles settings page interactions
 */

(function($) {
    'use strict';
    
    $(document).ready(function() {
        
        // Test API Connection
        $('#test-connection').on('click', function(e) {
            e.preventDefault();
            testConnection();
        });
        
        // Test OAuth2 Connection
        $('#test-oauth').on('click', function(e) {
            e.preventDefault();
            testOAuthConnection();
        });
        
        // Refresh Token
        $('#refresh-token').on('click', function(e) {
            e.preventDefault();
            refreshToken();
        });
        
        // Auto-resize textarea
        $('#chatbot_welcome_message').on('input', function() {
            autoResizeTextarea(this);
        }).trigger('input');
        
        // Show/hide settings based on enabled state
        $('#chatbot_enabled').on('change', function() {
            toggleSettings();
        }).trigger('change');
        
        // Show/hide OAuth2 settings
        $('#chatbot_use_oauth').on('change', function() {
            toggleOAuthSettings();
        }).trigger('change');
        
    });
    
    function toggleSettings() {
        const isEnabled = $('#chatbot_enabled').is(':checked');
        const $settings = $('.form-table tr').not(':first');
        
        if (isEnabled) {
            $settings.fadeIn();
            // Also check OAuth settings
            toggleOAuthSettings();
        } else {
            $settings.fadeOut();
        }
    }
    
    function toggleOAuthSettings() {
        const useOAuth = $('#chatbot_use_oauth').is(':checked');
        const $oauthSettings = $('.oauth-settings');
        
        if (useOAuth) {
            $oauthSettings.fadeIn();
        } else {
            $oauthSettings.fadeOut();
        }
    }
    
    function testConnection() {
        const $button = $('#test-connection');
        const $result = $('#test-result');
        
        // Show loading
        $button.prop('disabled', true).text('Testing...');
        $result.text('').removeClass('success error');
        
        // Make AJAX request
        $.ajax({
            url: helloChatbotAdmin.ajaxUrl,
            type: 'POST',
            data: {
                action: 'hello_chatbot_test_connection',
                nonce: helloChatbotAdmin.nonce
            },
            timeout: 15000,
            success: function(response) {
                if (response.success) {
                    $result
                        .addClass('success')
                        .text(' ✓ ' + response.data)
                        .css('color', 'green');
                } else {
                    $result
                        .addClass('error')
                        .text(' ✗ ' + (response.data || 'Connection failed'))
                        .css('color', 'red');
                }
            },
            error: function(xhr, status, error) {
                let message = 'Connection failed';
                
                if (status === 'timeout') {
                    message = 'Connection timeout';
                } else if (xhr.responseJSON && xhr.responseJSON.data) {
                    message = xhr.responseJSON.data;
                }
                
                $result
                    .addClass('error')
                    .text(' ✗ ' + message)
                    .css('color', 'red');
            },
            complete: function() {
                $button.prop('disabled', false).text('Test API Connection');
                
                // Auto-hide result after 5 seconds
                setTimeout(function() {
                    $result.fadeOut();
                }, 5000);
            }
        });
    }
    
    function testOAuthConnection() {
        const $button = $('#test-oauth');
        const $result = $('#oauth-test-result');
        const $statusDiv = $('#oauth-status');
        
        // Show loading
        $button.prop('disabled', true).text('Testing...');
        $result.text('').removeClass('success error');
        
        // Make AJAX request
        $.ajax({
            url: helloChatbotAdmin.ajaxUrl,
            type: 'POST',
            data: {
                action: 'hello_chatbot_test_oauth',
                nonce: helloChatbotAdmin.nonce
            },
            timeout: 15000,
            success: function(response) {
                if (response.success) {
                    $result
                        .addClass('success')
                        .html(' ✓ ' + response.data.message + '<br>Expires: ' + response.data.expires_at)
                        .css('color', 'green');
                    
                    // Update status display
                    if (response.data.status) {
                        updateTokenStatus(response.data.status);
                    }
                } else {
                    $result
                        .addClass('error')
                        .text(' ✗ ' + (response.data || 'OAuth2 test failed'))
                        .css('color', 'red');
                }
            },
            error: function(xhr, status, error) {
                let message = 'OAuth2 test failed';
                
                if (status === 'timeout') {
                    message = 'Connection timeout';
                } else if (xhr.responseJSON && xhr.responseJSON.data) {
                    message = xhr.responseJSON.data;
                }
                
                $result
                    .addClass('error')
                    .text(' ✗ ' + message)
                    .css('color', 'red');
            },
            complete: function() {
                $button.prop('disabled', false).text('Test OAuth2');
                
                // Auto-hide result after 10 seconds
                setTimeout(function() {
                    $result.fadeOut();
                }, 10000);
            }
        });
    }
    
    function refreshToken() {
        const $button = $('#refresh-token');
        const $result = $('#oauth-test-result');
        const $statusDiv = $('#oauth-status');
        
        // Show loading
        $button.prop('disabled', true).text('Refreshing...');
        $result.text('').removeClass('success error');
        
        // Make AJAX request
        $.ajax({
            url: helloChatbotAdmin.ajaxUrl,
            type: 'POST',
            data: {
                action: 'hello_chatbot_refresh_token',
                nonce: helloChatbotAdmin.nonce
            },
            timeout: 15000,
            success: function(response) {
                if (response.success) {
                    $result
                        .addClass('success')
                        .text(' ✓ ' + response.data.message)
                        .css('color', 'green');
                    
                    // Update status display
                    if (response.data.status) {
                        updateTokenStatus(response.data.status);
                    }
                } else {
                    $result
                        .addClass('error')
                        .text(' ✗ ' + (response.data || 'Token refresh failed'))
                        .css('color', 'red');
                }
            },
            error: function(xhr, status, error) {
                let message = 'Token refresh failed';
                
                if (status === 'timeout') {
                    message = 'Connection timeout';
                } else if (xhr.responseJSON && xhr.responseJSON.data) {
                    message = xhr.responseJSON.data;
                }
                
                $result
                    .addClass('error')
                    .text(' ✗ ' + message)
                    .css('color', 'red');
            },
            complete: function() {
                $button.prop('disabled', false).text('Refresh Token Now');
                
                // Auto-hide result after 10 seconds
                setTimeout(function() {
                    $result.fadeOut();
                }, 10000);
            }
        });
    }
    
    function updateTokenStatus(status) {
        const $statusDiv = $('#oauth-status');
        const statusClass = 'token-status-' + status.status;
        let statusText = status.message;
        
        if (status.expires_at) {
            if (status.status === 'expired') {
                statusText += ' (' + status.expired_ago + ')';
            } else {
                statusText += ' (Expires in ' + status.expires_in + ')';
            }
        }
        
        $statusDiv.html(
            '<strong>Token Status:</strong> <span class="' + statusClass + '">' + 
            statusText + '</span>'
        );
    }
    
    function autoResizeTextarea(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = (textarea.scrollHeight + 2) + 'px';
    }
    
})(jQuery);